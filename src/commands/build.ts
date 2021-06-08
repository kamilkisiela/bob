import * as rollup from "rollup";
import generatePackageJson from "rollup-plugin-generate-package-json";
import {autoExternal} from "../rollup-plugins/auto-external";
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

const DIST_DIR = "dist";

interface PackageInfo {
  packagePath: string;
  cwd: string;
  pkg: any;
  fullName: string;
}

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
      config.dists = config.dists || [
        {
          distDir: DIST_DIR,
          distPath: ''
        }
      ];
      if (args.single) {
        await buildSingle({ distDir: DIST_DIR });
        return;
      }

      const limit = pLimit(4);
      const packages = await globby("packages/**/package.json", {
        cwd: process.cwd(),
        absolute: true,
        ignore: ["**/node_modules/**", ...config.dists.map(({ distDir }) => `**/${distDir}/**`)],
      });

      const packageInfoList: PackageInfo[] = await Promise.all(
          packages.map(packagePath => limit(async () => {
            const cwd = packagePath.replace("/package.json", "");
            const pkg = await fs.readJSON(resolve(cwd, 'package.json'));
            const fullName: string = pkg.name;
            return { packagePath, cwd, pkg, fullName };
        }))
      );

      for (const { distDir, distPath } of config.dists) {
        await Promise.all(
          packageInfoList.map(({ packagePath, cwd, pkg, fullName }) =>
            limit(() => build({ packagePath, cwd, pkg, fullName, config, reporter, distDir, distPath, packageInfoList }))
          )
        );
      }
    },
  };
});

async function buildSingle({ distDir, distPath = '' }: { distDir: string; distPath?: string; }) {
  const cwd = process.cwd();
  const packagePath = join(process.cwd(), "package.json");
  const pkg = await fs.readJSON(packagePath);

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
      autoExternal({
        packageJSONPath: packagePath,
      }),
      typescript(),
      generatePackageJson({
        baseContents: rewritePackageJson(pkg, distPath),
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
      file: join(distDir, "index.js"),
      format: "cjs" as const,
    },
    {
      ...commonOutputOptions,
      file: join(distDir, "index.mjs"),
      format: "esm" as const,
    },
  ];

  await Promise.all(
    generates.map(async (outputOptions) => {
      await bundle.write(outputOptions);
    })
  );

  // move README.md and LICENSE
  await copyToDist(
    cwd,
    ["README.md", "LICENSE"].concat(buildOptions?.copy || []),
    DIST_DIR + distPath
  );
}

async function build(
{ packagePath, cwd, pkg, fullName, config, reporter, distDir, distPath = '', packageInfoList }: { packagePath: string; cwd: string; pkg: any; fullName: string; config: BobConfig; reporter: Consola; distDir: string; distPath?: string; packageInfoList: PackageInfo[] },
) {
  const scope = config.scope;

  if ((config.ignore || []).includes(fullName)) {
    reporter.warn(`Ignored ${fullName}`);
    return;
  }

  const name = fullName.replace(`${scope}/`, distPath);

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
        packageJSONPath: packagePath,
      }),
      generatePackageJson({
        baseContents: rewritePackageJson(pkg, distPath),
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
      file: join(bobProjectDir, "index.js"),
      format: "cjs" as const,
    },
    {
      ...commonOutputOptions,
      file: join(bobProjectDir, "index.mjs"),
      format: "esm" as const,
    },
  ];

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
              packageJSONPath: packagePath,
            }),
          ],
          inlineDynamicImports: true,
        };

        const bundle = await rollup.rollup(inputOptions);

        await bundle.write({
          banner: `#!/usr/bin/env node`,
          preferConst: true,
          sourcemap: options.sourcemap,
          file: join(bobProjectDir, pkg.bin[alias].replace(`${DIST_DIR}/`, "")),
          format: "cjs",
        });
      })
    );
  }

  // remove <project>/dist
  await fs.remove(join(cwd, DIST_DIR + distPath));

  // fix distPath import in extra dists
  function replaceAll(str: string, from: string, to: string) {
    return str.split(from).join(to);
  }
  if (distPath) {
    await Promise.all(
      generates.map(({ file }) => limit(async () => {
        let content = await fs.readFile(file, 'utf8');
        for (const { fullName } of packageInfoList) {
          content = replaceAll(content, `'${fullName}'`, `'${fullName}${distPath}'`);
        }
        await fs.writeFile(file, content, { encoding: 'utf8', flag: 'w' });
      }))
    )
  }
  
  // move bob/<project-name> to <project>/dist
  await fs.move(bobProjectDir, join(cwd, DIST_DIR + distPath));
  // move README.md and LICENSE
  await copyToDist(
    cwd,
    ["README.md", "LICENSE"].concat(pkg.buildOptions?.copy || []),
    DIST_DIR + distPath
  );

  reporter.success(`Built ${pkg.name}`);
}

function rewritePackageJson(pkg: Record<string, any>, distPath: string) {
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

  newPkg.name += distPath;
  newPkg.main = "index.js";
  newPkg.module = "index.mjs";
  newPkg.typings = "index.d.ts";
  newPkg.typescript = {
    definition: newPkg.typings,
  };

  if (pkg.bin) {
    newPkg.bin = {};

    for (const alias in pkg.bin) {
      newPkg.bin[alias] = pkg.bin[alias].replace(`${DIST_DIR}/`, "");
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

  expect("main", `${DIST_DIR}/index.js`);
  expect("module", `${DIST_DIR}/index.mjs`);
  expect("typings", `${DIST_DIR}/index.d.ts`);
  expect("typescript.definition", `${DIST_DIR}/index.d.ts`);

  expect("exports['.'].require", `./${DIST_DIR}/index.js`);
  expect("exports['.'].default", `./${DIST_DIR}/index.mjs`);

  expect("exports['./*'].require", `./${DIST_DIR}/*.js`);
  expect("exports['./*'].default", `./${DIST_DIR}/*.mjs`);
}

async function copyToDist(cwd: string, files: string[], distDir: string) {
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
