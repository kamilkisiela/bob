import * as rollup from "rollup";
import generatePackageJson from "rollup-plugin-generate-package-json";
import autoExternal from "rollup-plugin-auto-external";
import resolveNode from "@rollup/plugin-node-resolve";
import typescript from "rollup-plugin-typescript2";
import globby from "globby";
import pLimit from "p-limit";
import fs from "fs-extra";
import { resolve, join } from "path";
import get from "lodash.get";

import { createCommand } from "../command";
import { Consola } from "consola";

// TODO: validate tsconfig.json (outDir, paths etc)
// TODO: validate package.json and main/module etc

interface BuildOptions {
  external?: string[];
  copy?: string[];
  bin?: Record<string, { input: string; sourcemap?: boolean }>;
}

const distDir = "dist";

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
          limit(() => build(packagePath, config.scope, reporter))
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

  const buildOptions: BuildOptions = pkg.buildOptions;

  const extraInputOptions: Partial<rollup.RollupOptions> = {};

  if (buildOptions.external) {
    extraInputOptions.external = buildOptions.external;
  }

  const inputOptions = {
    input: "src/index.ts",
    plugins: [
      resolveNode(),
      autoExternal({
        packagePath,
        builtins: true,
        dependencies: true,
        peerDependencies: true,
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

async function build(packagePath: string, scope: string, reporter: Consola) {
  const cwd = packagePath.replace("/package.json", "");
  const pkg = await readPackageJson(cwd);
  const name = pkg.name.replace(`${scope}/`, "");

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

  const inputOptions = {
    input: inputFile,
    plugins: [
      resolveNode(),
      autoExternal({
        packagePath,
        builtins: true,
        dependencies: true,
        peerDependencies: true,
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
            autoExternal({
              packagePath,
              builtins: true,
              dependencies: true,
              peerDependencies: true,
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
    "repository",
    "homepage",
    "keywords",
    "author",
    "license",
    "engines",
  ];

  fields.forEach((field) => {
    if (pkg[field]) {
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
    expect("exports.require", pkg.main);
    expect("exports.default", `${distDir}/index.mjs`);
  }
}

function copyToDist(cwd: string, files: string[]) {
  return Promise.all(
    files.map(async (file) => {
      if (await fs.pathExists(join(cwd, file))) {
        await fs.copyFile(join(cwd, file), join(cwd, distDir, file));
      }
    })
  );
}
