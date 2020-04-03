import { BobConfig } from "./../config";
import { promisify } from "util";
import { execSync } from "child_process";
import spawn from 'cross-spawn';
import minimatch from "minimatch";

import { createCommand } from "../command";

export interface Package {
  location: string;
  dependencies: string[];
  dirty: boolean;
}
export type Packages = Record<string, Package>;

export const affectedCommand = createCommand<
  {},
  {
    command: string;
  }
>(api => {
  const { config, reporter } = api;

  return {
    command: "affected <command>",
    describe: "Runs a command only for affected packages",
    builder(yargs) {
      return yargs.positional("command", {
        describe: "Name of the command",
        type: "string",
        demandOption: true
      });
    },
    async handler(args) {
      const commandName = args.command;
      const commandFactory = config?.run?.[commandName];
      const ignored = config.ignore || [];

      if (!commandFactory) {
        // Better error - example config
        throw new Error(
          `Command ${commandName} not found. Define it in bob.config.js`
        );
      }

      const { affected, packages } = getAffectedPackages({
        config,
        ignored
      });

      if (!affected.length) {
        reporter.success("Nothing is affected");
        return;
      }

      reporter.info(
        [
          `Affected packages: `,
          affected.map(name => ` - ${name}`).join("\n"),
          "\n\n"
        ].join("\n")
      );

      const input = {
        names: affected,
        paths: affected.map(name => packages[name].location)
      };

      const [bin, rest] = commandFactory(input);

      await promisify(spawn)(bin, rest, {
        stdio: "inherit"
      });
    }
  };
});

export function getAffectedPackages({
  config,
  ignored
}: {
  config: BobConfig;
  ignored: string[];
}) {
  if (!config.track || config.track.length === 0) {
    throw new Error(`Define files to track`);
  }

  if (!config.against) {
    throw new Error(
      `Define 'against' in config. In most cases set it to 'origin/master`
    );
  }

  const packages = getPackages(ignored);
  const changedFiles = getChangedFilesList(config.against);

  const projectTracks = config.track.filter(file => file.includes("<project>"));
  const nonProjectTracks = config.track.filter(
    file => !file.includes("<project>")
  );
  // TODO: .concat("bob.config.js");
  const nonProjectChanges = changedFiles.filter(file =>
    nonProjectTracks.includes(file)
  );

  if (!nonProjectChanges.length) {
    changedFiles.forEach(file => {
      for (const packageName in packages) {
        if (packages.hasOwnProperty(packageName)) {
          const { location } = packages[packageName];

          if (file.includes(location)) {
            const tracks: string[] = projectTracks.map(path =>
              path.replace("<project>", location)
            );

            if (tracks.some(pattern => minimatch(file, pattern))) {
              packages[packageName].dirty = true;
            }
          }
        }
      }
    });
  } else {
    for (const packageName in packages) {
      if (packages.hasOwnProperty(packageName)) {
        packages[packageName].dirty = true;
      }
    }
  }

  const affected = Object.keys(packages).filter(name => {
    const { dirty, dependencies } = packages[name];

    return dirty || dependencies.some(dep => packages[dep].dirty);
  });

  return {
    affected,
    packages
  };
}

function getChangedFilesList(against: string): string[] {
  const revision = execSync(`git merge-base ${against} -- HEAD`, {
    encoding: "utf-8"
  });
  const cmd = execSync(`git diff --name-only ${revision}`, {
    encoding: "utf-8"
  });

  return cmd.split("\n").filter(file => Boolean(file));
}

export function getPackages(ignored: string[]): Packages {
  const info = execSync("yarn workspaces info", {
    encoding: "utf-8"
  });

  const startsAt = info.indexOf("{");
  const endsAt = info.lastIndexOf("}");

  const workspaces: Record<
    string,
    { location: string; workspaceDependencies: string[] }
  > = JSON.parse(info.substr(startsAt, endsAt - startsAt + 1));

  const packages: Packages = {};

  function collectDependencies(name: string, dependencies: string[]) {
    workspaces[name].workspaceDependencies.forEach(dep => {
      if (!dependencies.includes(dep)) {
        dependencies.push(dep);
        collectDependencies(dep, dependencies);
      }
    });
  }

  for (const packageName in workspaces) {
    if (
      workspaces.hasOwnProperty(packageName) &&
      !ignored.includes(packageName)
    ) {
      const { location } = workspaces[packageName];

      packages[packageName] = {
        location,
        dependencies: [],
        dirty: false
      };

      collectDependencies(packageName, packages[packageName].dependencies);

      packages[packageName].dependencies = packages[
        packageName
      ].dependencies.filter((name, i, all) => all.indexOf(name) === i);
    }
  }

  return packages;
}
