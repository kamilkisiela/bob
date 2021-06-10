import globby from "globby";
import pLimit from "p-limit";
import fs from "fs-extra";
import { resolve, join } from "path";
import { execSync } from "child_process";
import { Consola } from "consola";
import { paramCase } from "param-case";

import { createCommand } from "../command";
import { BobConfig } from "../config";
import { DIST_DIR } from "./build";

export const packFlatCommand = createCommand<
  {},
  {
    commit: string;
  }
>((api) => {
  const { config, reporter } = api;

  return {
    command: "pack-flat",
    describe: "Pack flat",
    builder(yargs) {
      return yargs.options({
        commit: {
          describe: "Commit hash",
          type: "string",
          demandOption: true,
        },
      });
    },
    async handler(args) {
      const limit = pLimit(4);
      const commit = args.commit;
      const packages = await globby("packages/**/package.json", {
        cwd: process.cwd(),
        absolute: true,
        ignore: ["**/node_modules/**", `**/${DIST_DIR}/**`],
      });

      await Promise.all(
        packages.map((packagePath) =>
          limit(() => pack(packagePath, commit, config, reporter))
        )
      );
    },
  };
});

async function pack(packagePath: string, commit: string, config: BobConfig, reporter: Consola) {
  const cwd = packagePath.replace("/package.json", "");
  const pkg = await fs.readJSON(packagePath);
  const fullName: string = pkg.name;

  if ((config.ignore || []).includes(fullName)) {
    reporter.warn(`Ignored ${fullName}`);
    return;
  }

  const projectDistDir = join(cwd, DIST_DIR);
  const bobDir = resolve(process.cwd(), ".bob-packed");

  // replace version to 0.0.0-canary-${commit}
  const distPkg = await fs.readJSON(join(projectDistDir, 'package.json'));
  const version = `0.0.0-canary-${commit}`;
  distPkg.version = version;
  await fs.writeFile(join(projectDistDir, 'package.json'), JSON.stringify(distPkg, null, 2), {
    encoding: 'utf-8'
  });

  // pack
  execSync(`cd ${projectDistDir} && npm pack`, {
    encoding: "utf-8",
  });

  // move tarball
  const tarballName = paramCase(fullName) + `-${version}.tgz`;
  const tarballPath = join(projectDistDir, tarballName);
  await fs.move(tarballPath, join(bobDir, tarballName));
  
  reporter.success(`Packed flat ${pkg.name}`);
}
