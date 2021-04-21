import globby from "globby";
import pLimit from "p-limit";
import fs from "fs-extra";
import { resolve, join } from "path";
import { Consola } from "consola";
import ncc from "@vercel/ncc";
import { exec } from "child_process";

import { createCommand } from "../command";
import { BobConfig } from "../config";

// adds #!/usr/bin/env node
// cleans up package.json (removes dependencies etc)

export const distDir = "dist";

interface BuildOptions {
  bin?: string;
}

export const runifyCommand = createCommand<{}, {}>((api) => {
  const { config, reporter } = api;

  return {
    command: "runify",
    describe: "Runify",
    async handler() {
      const limit = pLimit(1);
      const packages = await globby("packages/**/package.json", {
        cwd: process.cwd(),
        absolute: true,
        ignore: ["**/node_modules/**", `**/${distDir}/**`],
      });

      await Promise.all(
        packages.map((packagePath) =>
          limit(() => runify(packagePath, config, reporter))
        )
      );
    },
  };
});

async function runify(
  packagePath: string,
  config: BobConfig,
  reporter: Consola
) {
  const cwd = packagePath.replace("/package.json", "");
  const pkg = await readPackageJson(cwd);
  const fullName: string = pkg.name;

  if ((config.ignore || []).includes(fullName)) {
    reporter.warn(`Ignored ${fullName}`);
    return;
  }

  if (isNext(pkg)) {
    await buildNext(cwd);
    await rewritePackageJson(pkg, cwd, (newPkg) => ({
      ...newPkg,
      dependencies: {
        next: pkg.dependencies?.next ?? pkg.devDependencies?.next,
      },
    }));
  } else {
    const buildOptions: BuildOptions = pkg.buildOptions || {};
    await compile(cwd, buildOptions?.bin ?? "src/index.ts");
    await rewritePackageJson(pkg, cwd);
  }

  reporter.success(`Built ${pkg.name}`);
}

export async function readPackageJson(baseDir: string) {
  return JSON.parse(
    await fs.readFile(resolve(baseDir, "package.json"), {
      encoding: "utf-8",
    })
  );
}

async function rewritePackageJson(
  pkg: Record<string, any>,
  cwd: string,
  modify?: (pkg: any) => any
) {
  let newPkg: Record<string, any> = {
    bin: "index.js",
  };
  const fields = ["name", "version", "description"];

  fields.forEach((field) => {
    if (typeof pkg[field] !== "undefined") {
      newPkg[field] = pkg[field];
    }
  });

  if (modify) {
    newPkg = modify(newPkg);
  }

  await fs.writeFile(
    join(cwd, "dist/package.json"),
    JSON.stringify(newPkg, null, 2),
    {
      encoding: "utf-8",
    }
  );
}

function isNext(pkg: any): boolean {
  return pkg?.dependencies?.next || pkg?.devDependencies?.next;
}

async function buildNext(cwd: string) {
  await new Promise((resolve, reject) => {
    const child = exec(`cd ${cwd} && next build`, {
      encoding: "utf-8",
    });
    child.on("exit", resolve);
    child.on("error", reject);
  });

  await fs.mkdirp(join(cwd, "dist"));
  await fs.copy(join(cwd, ".next"), join(cwd, "dist/.next"));
  await fs.writeFile(
    join(cwd, "dist/index.js"),
    [
      `#!/usr/bin/env node`,
      `process.on('SIGTERM', () => process.exit(0))`,
      `process.on('SIGINT', () => process.exit(0))`,
      `require('next/dist/cli/next-start').nextStart(process.argv.slice(2))`,
    ].join("\n")
  );
}

async function compile(cwd: string, entryPoint: string) {
  const { code, map } = await ncc(join(cwd, entryPoint), {
    cache: false,
    sourceMap: true,
  });

  await fs.mkdirp(join(cwd, "dist"));
  await Promise.all([
    fs.writeFile(join(cwd, "dist/index.js"), code, {
      encoding: "utf-8",
    }),
    fs.writeFile(join(cwd, "dist/index.js.map"), map, {
      encoding: "utf-8",
    }),
  ]);
}
