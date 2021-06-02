import * as rollup from "rollup";
import generatePackageJson from "rollup-plugin-generate-package-json";
import nodeExternals from "rollup-plugin-node-externals";
import resolveNode from "@rollup/plugin-node-resolve";
import typescript from "rollup-plugin-typescript2";
import globby from "globby";
import pLimit from "p-limit";
import fs from "fs-extra";
import { resolve, join, dirname } from "path";
import { Consola } from "consola";
import get from "lodash.get";
import mkdirp from 'mkdirp';

import { createCommand } from "../command";
import { BobConfig } from "../config";

interface BuildOptions {
  external?: string[];
  copy?: string[];
  bin?: Record<string, { input: string; sourcemap?: boolean }>;
}

export const distDir = "dist";

export const buildCommand = createCommand<
  {},
  {
    single?: boolean;
  }
>((api) => {
  const { config, reporter } = api;

  return {
    command: "build",
    describe: "Build",
    builder(yargs) {
      return yargs.options({
        single: {
          describe: "Single package (THE OPOSITE OF MONOREPO)",
          type: "boolean",
        },
      });
    },
    async handler(args) {
      if (args.single) {
        await buildSingle();
        return;
      }

      const limit = pLimit(4);
      const packages = await globby("packages/**/package.json", {
        cwd: process.cwd(),
        absolute: true,
        ignore: ["**/node_modules/**", `**/${distDir}/**`],
      });

      await Promise.all(
        packages.map((packagePath) =>
          limit(() => build(packagePath, config, reporter))
        )
      );
    },
  };
});

async function buildSingle() {
  const cwd = process.cwd();
  const packagePath = join(process.cwd(), "package.json");
  const pkg = await readPackageJson(cwd);

  validatePackageJson(pkg);

  const buildOptions: BuildOptions = pkg.buildOptions || {};

  const extraInputOptions: Partial<rollup.RollupOptions> = {};

  if (buildOptions.external) {
    extraInputOptions.external = buildOptions.external;
  }

  const inputOptions = {
    input: "src/index.ts",
    plugins: [
      resolveNode(),
      nodeExternals({
        packagePath,
        builtins: true,
        deps: true,
        peerDeps: true,
      }),
      typescript(),
      generatePackageJson({
        baseContents: rewritePackageJson(pkg),
        additionalDependencies: Object.keys(pkg.dependencies || {}),
      }),
    ],
    inlineDynamicImports: true,
    ...extraInputOptions,
  };

  // create a bundle
  const bundle = await rollup.rollup(inputOptions);

  // generates

  const commonOutputOptions = {
    preferConst: true,
    sourcemap: true,
  };

  const generates = [
    {
      ...commonOutputOptions,
      file: join(distDir, "index.cjs.js"),
      format: "cjs" as const,
    },
    {
      ...commonOutputOptions,
      file: join(distDir, "index.esm.js"),
      format: "esm" as const,
    },
  ];

  if (pkg.exports) {
    generates.push({
      ...commonOutputOptions,
      file: join(distDir, "index.mjs"),
      format: "esm" as const,
    });
  }

  await Promise.all(
    generates.map(async (outputOptions) => {
      await bundle.write(outputOptions);
    })
  );

  // move README.md and LICENSE
  await copyToDist(
    cwd,
    ["README.md", "LICENSE"].concat(buildOptions?.copy || [])
  );
}

async function build(
  packagePath: string,
  config: BobConfig,
  reporter: Consola
) {
  const scope = config.scope;
  const cwd = packagePath.replace("/package.json", "");
  const pkg = await readPackageJson(cwd);
  const fullName: string = pkg.name;

  if ((config.ignore || []).includes(fullName)) {
    reporter.warn(`Ignored ${fullName}`);
    return;
  }

  const name = fullName.replace(`${scope}/`, "");

  validatePackageJson(pkg);

  const distProjectDir = cwd.replace("packages", distDir);
  const distProjectSrcDir = resolve(distProjectDir, "src");

  const bobDir = resolve(process.cwd(), ".bob");
  const bobProjectDir = resolve(bobDir, name);
  const buildOptions: BuildOptions = pkg.buildOptions || {};

  // remove bob/<project-name>
  await fs.remove(bobProjectDir);

  const inputFile = resolve(distProjectSrcDir, "index.js");

  const extraInputOptions: Partial<rollup.RollupOptions> = {};

  if (buildOptions.external) {
    extraInputOptions.external = buildOptions.external;
  }

  console.log(packagePath)

  const inputOptions = {
    input: inputFile,
    plugins: [
      resolveNode(),
      nodeExternals({
        packagePath,
        builtins: true,
        deps: true,
        peerDeps: true,
      }),
      generatePackageJson({
        baseContents: rewritePackageJson(pkg),
        additionalDependencies: Object.keys(pkg.dependencies || {}),
      }),
    ],
    inlineDynamicImports: true,
    ...extraInputOptions,
  };

  // create a bundle
  const bundle = await rollup.rollup(inputOptions);

  // generates

  const commonOutputOptions = {
    preferConst: true,
    sourcemap: true,
  };

  const generates = [
    {
      ...commonOutputOptions,
      file: join(bobProjectDir, "index.cjs.js"),
      format: "cjs" as const,
    },
    {
      ...commonOutputOptions,
      file: join(bobProjectDir, "index.esm.js"),
      format: "esm" as const,
    },
  ];

  if (pkg.exports) {
    generates.push({
      ...commonOutputOptions,
      file: join(distDir, "index.mjs"),
      format: "esm" as const,
    });
  }

  const declarations = await globby("**/*.d.ts", {
    cwd: distProjectSrcDir,
    ignore: ["**/node_modules/**"],
  });

  const limit = pLimit(200);

  await Promise.all(
    generates.map(async (outputOptions) => {
      await bundle.write(outputOptions);
    })
  );

  await Promise.all(
    declarations.map((file) =>
      limit(() =>
        fs.copy(join(distProjectSrcDir, file), join(bobProjectDir, file))
      )
    )
  );

  if (buildOptions?.bin) {
    await Promise.all(
      Object.keys(buildOptions.bin).map(async (alias) => {
        const options = buildOptions.bin![alias];
        const binPath = resolve(
          distProjectSrcDir,
          options.input.replace("src/", "").replace(".ts", ".js")
        );
        const inputOptions = {
          input: binPath,
          plugins: [
            resolveNode(),
            nodeExternals({
              packagePath,
              builtins: true,
              deps: true,
              peerDeps: true,
            }),
          ],
          inlineDynamicImports: true,
        };

        const bundle = await rollup.rollup(inputOptions);

        await bundle.write({
          banner: `#!/usr/bin/env node`,
          preferConst: true,
          sourcemap: options.sourcemap,
          file: join(bobProjectDir, pkg.bin[alias].replace(`${distDir}/`, "")),
          format: "cjs",
        });
      })
    );
  }

  // remove <project>/dist
  await fs.remove(join(cwd, distDir));
  // move bob/<project-name> to <project>/dist
  await fs.move(bobProjectDir, join(cwd, distDir));
  // move README.md and LICENSE
  await copyToDist(
    cwd,
    ["README.md", "LICENSE"].concat(pkg.buildOptions?.copy || [])
  );

  reporter.success(`Built ${pkg.name}`);
}

//

export async function readPackageJson(baseDir: string) {
  return JSON.parse(
    await fs.readFile(resolve(baseDir, "package.json"), {
      encoding: "utf-8",
    })
  );
}

function rewritePackageJson(pkg: Record<string, any>) {
  const newPkg: Record<string, any> = {};
  const fields = [
    "name",
    "version",
    "description",
    "sideEffects",
    "peerDependencies",
    "dependencies",
    "optionalDependencies",
    "repository",
    "homepage",
    "keywords",
    "author",
    "license",
    "engines",
  ];

  fields.forEach((field) => {
    if (typeof pkg[field] !== "undefined") {
      newPkg[field] = pkg[field];
    }
  });

  newPkg.main = "index.cjs.js";
  newPkg.module = "index.esm.js";
  newPkg.typings = "index.d.ts";
  newPkg.typescript = {
    definition: newPkg.typings,
  };

  if (pkg.bin) {
    newPkg.bin = {};

    for (const alias in pkg.bin) {
      newPkg.bin[alias] = pkg.bin[alias].replace(`${distDir}/`, "");
    }
  }

  return newPkg;
}

export function validatePackageJson(pkg: any) {
  function expect(key: string, expected: string) {
    const received = get(pkg, key);

    if (expected !== received) {
      throw new Error(
        `${pkg.name}: "${key}" equals "${received}", should be "${expected}"`
      );
    }
  }

  expect("main", `${distDir}/index.cjs.js`);
  expect("module", `${distDir}/index.esm.js`);
  expect("typings", `${distDir}/index.d.ts`);
  expect("typescript.definition", `${distDir}/index.d.ts`);

  if (pkg.exports) {
    expect("exports.require",  `./${pkg.main}`);
    expect("exports.default", `./${distDir}/index.mjs`);
  }
}

async function copyToDist(cwd: string, files: string[]) {
  const allFiles = await globby(files, { cwd });

  return Promise.all(
    allFiles.map(async (file) => {
      if (await fs.pathExists(join(cwd, file))) {
        const sourcePath = join(cwd, file);
        const destPath = join(cwd, distDir, file.replace('src/', ''));
        await mkdirp(dirname(destPath));
        await fs.copyFile(sourcePath, destPath);
      }
    })
  );
}
