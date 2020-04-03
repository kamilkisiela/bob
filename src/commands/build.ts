import * as rollup from "rollup";
import generatePackageJson from "rollup-plugin-generate-package-json";
import autoExternal from "rollup-plugin-auto-external";
import resolveNode from "@rollup/plugin-node-resolve";
import globby from "globby";
import pLimit from "p-limit";
import fs from "fs-extra";
import { resolve, join } from "path";
import get from "lodash.get";

import { createCommand } from "../command";
import { Consola } from "consola";

// TODO: validate tsconfig.json (outDir, paths etc)
// TODO: validate package.json and main/module etc

export const buildCommand = createCommand(api => {
  const { config, reporter } = api;

  return {
    command: "build",
    describe: "Build",
    async handler() {
      const limit = pLimit(4);
      const packages = await globby("packages/**/package.json", {
        cwd: process.cwd(),
        absolute: true,
        ignore: ["**/node_modules/**", `**/${distDir}/**`]
      });

      await Promise.all(
        packages.map(packagePath =>
          limit(() => build(packagePath, config.scope, reporter))
        )
      );
    }
  };
});

const distDir = "dist";

async function build(packagePath: string, scope: string, reporter: Consola) {
  const cwd = packagePath.replace("/package.json", "");
  const pkg = await readPackageJson(cwd);
  const name = pkg.name.replace(`${scope}/`, "");

  validatePackageJson(pkg);

  const distProjectDir = cwd.replace("packages", distDir);
  const distProjectSrcDir = resolve(distProjectDir, "src");

  const bobDir = resolve(process.cwd(), ".bob");
  const bobProjectDir = resolve(bobDir, name);

  // remove bob/<project-name>
  await fs.remove(bobProjectDir);

  const inputFile = resolve(distProjectSrcDir, "index.js");

  const inputOptions = {
    input: inputFile,
    plugins: [
      resolveNode(),
      autoExternal({
        packagePath,
        builtins: true,
        dependencies: true,
        peerDependencies: true
      }),
      generatePackageJson({
        baseContents: rewritePackageJson(pkg),
        additionalDependencies: Object.keys(pkg.dependencies || {})
      })
    ],
    inlineDynamicImports: true
  };

  // create a bundle
  const bundle = await rollup.rollup(inputOptions);

  // generates

  const commonOutputOptions = {
    preferConst: true,
    sourcemap: true
  };

  const generates = [
    {
      ...commonOutputOptions,
      file: join(bobProjectDir, "index.cjs.js"),
      format: "cjs" as const
    },
    {
      ...commonOutputOptions,
      file: join(bobProjectDir, "index.esm.js"),
      format: "esm" as const
    }
  ];

  const declarations = await globby("*.d.ts", {
    cwd: distProjectSrcDir,
    ignore: ["**/node_modules/**"]
  });

  const limit = pLimit(200);

  await Promise.all(
    generates.map(async outputOptions => {
      await bundle.write(outputOptions);
    })
  );

  await Promise.all(
    declarations.map(file =>
      limit(() =>
        fs.copy(join(distProjectSrcDir, file), join(bobProjectDir, file))
      )
    )
  );

  if (pkg.buildOptions.bin) {
    await Promise.all(
      Object.keys(pkg.buildOptions.bin).map(async alias => {
        const options = pkg.buildOptions.bin[alias];
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
              peerDependencies: true
            })
          ],
          inlineDynamicImports: true
        };

        const bundle = await rollup.rollup(inputOptions);

        await bundle.write({
          banner: `#!/usr/bin/env node`,
          preferConst: true,
          sourcemap: options.sourcemap,
          file: join(bobProjectDir, pkg.bin[alias].replace(`${distDir}/`, "")),
          format: "cjs"
        });
      })
    );
  }

  // remove <project>/dist
  await fs.remove(join(cwd, distDir));
  // move bob/<project-name> to <project>/dist
  await fs.move(bobProjectDir, join(cwd, distDir));

  reporter.success(`Built ${pkg.name}`);
}

//

async function readPackageJson(baseDir: string) {
  return JSON.parse(
    await fs.readFile(resolve(baseDir, "package.json"), {
      encoding: "utf-8"
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
    "engines"
  ];

  fields.forEach(field => {
    if (pkg[field]) {
      newPkg[field] = pkg[field];
    }
  });

  newPkg.main = "index.cjs.js";
  newPkg.module = "index.esm.js";
  newPkg.typings = "index.d.ts";
  newPkg.typescript = {
    definition: newPkg.typings
  };

  if (pkg.bin) {
    newPkg.bin = {};

    for (const alias in pkg.bin) {
      newPkg.bin[alias] = pkg.bin[alias].replace(`${distDir}/`, "");
    }
  }

  return newPkg;
}

function validatePackageJson(pkg: any) {
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
}
