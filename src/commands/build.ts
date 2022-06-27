import * as assert from "assert";
import execa from "execa";
import * as fse from "fs-extra";
import globby from "globby";
import pLimit from "p-limit";
import { resolve, join, dirname } from "path";
import { Consola } from "consola";
import get from "lodash.get";
import mkdirp from "mkdirp";

import { createCommand } from "../command";
import { BobConfig } from "../config";
import { rewriteExports } from "../utils/rewrite-exports";
import { presetFields } from "./bootstrap";

interface BuildOptions {
  external?: string[];
  copy?: string[];
  bin?: Record<string, { input: string; sourcemap?: boolean }>;
}

export const DIST_DIR = "dist";

interface PackageInfo {
  packagePath: string;
  cwd: string;
  pkg: any;
  fullName: string;
}

/**
 * A list of files that we don't need need within the published package.
 * Also known as test files :)
 * This list is derived from scouting various of our repositories.
 */
const filesToExcludeFromDist = [
  "**/test/**",
  "**/tests/**",
  "**/*.spec.*",
  "**/*.test.*",
  "**/dist",
  "**/temp",
];

const moduleMappings = {
  esm: "es2022",
  cjs: "commonjs",
} as const;

function typeScriptCompilerOptions(
  target: "esm" | "cjs"
): Record<string, unknown> {
  return {
    module: moduleMappings[target],
    sourceMap: false,
    inlineSourceMap: false,
  };
}

function compilerOptionsToArgs(
  options: Record<string, unknown>
): Array<string> {
  const args: Array<string> = [];
  for (const [key, value] of Object.entries(options)) {
    args.push(`--${key}`, `${value}`);
  }
  return args;
}

async function buildTypeScript(buildPath: string) {
  const results = await Promise.all([
    execa("npx", [
      "tsc",
      ...compilerOptionsToArgs(typeScriptCompilerOptions("esm")),
      "--outDir",
      join(buildPath, "esm"),
    ]),
    execa("npx", [
      "tsc",
      ...compilerOptionsToArgs(typeScriptCompilerOptions("cjs")),
      "--outDir",
      join(buildPath, "cjs"),
    ]),
  ]);

  for (const result of results) {
    if (result.exitCode !== 0) {
      console.log("TypeScript compiler exited with non-zero exit code.");
      console.log(result.stdout);
      throw new Error("TypeScript compiler exited with non-zero exit code.");
    }
  }
}

export const buildCommand = createCommand<{}, {}>((api) => {
  const { config, reporter } = api;

  return {
    command: "build",
    describe: "Build",
    builder(yargs) {
      return yargs.options({});
    },
    async handler() {
      config.dists = config.dists || [
        {
          distDir: DIST_DIR,
          distPath: "",
        },
      ];

      const [rootPackageJSONPath] = await globby("package.json", {
        cwd: process.cwd(),
        absolute: true,
      });
      const rootPackageJSON: Record<string, unknown> = await fse.readJSON(
        rootPackageJSONPath
      );
      const isSinglePackage =
        Array.isArray(rootPackageJSON.workspaces) === false;

      if (isSinglePackage) {
        const cwd = rootPackageJSONPath.replace("/package.json", "");
        const buildPath = join(cwd, ".bob");

        await fse.remove(buildPath);
        await buildTypeScript(buildPath);
        const pkg = await fse.readJSON(resolve(cwd, "package.json"));
        const fullName: string = pkg.name;

        const distPath = join(cwd, "dist");

        const getBuildPath = (target: "esm" | "cjs") => join(buildPath, target);

        await build({
          cwd,
          pkg,
          fullName,
          config,
          reporter,
          getBuildPath,
          distPath,
        });
        return;
      }

      const limit = pLimit(4);
      const cwd = process.cwd();
      const packages = await globby("packages/**/package.json", {
        cwd,
        absolute: true,
        ignore: [
          "**/node_modules/**",
          ...config.dists.map(({ distDir }) => `**/${distDir}/**`),
        ],
      });

      const packageInfoList: PackageInfo[] = await Promise.all(
        packages.map((packagePath) =>
          limit(async () => {
            const cwd = packagePath.replace("/package.json", "");
            const pkg = await fse.readJSON(resolve(cwd, "package.json"));
            const fullName: string = pkg.name;
            return { packagePath, cwd, pkg, fullName };
          })
        )
      );

      const bobBuildPath = join(cwd, ".bob");
      await fse.remove(bobBuildPath);
      await buildTypeScript(bobBuildPath);

      await Promise.all(
        packageInfoList.map(({ cwd, pkg, fullName }) =>
          limit(async () => {
            const getBuildPath = (target: "esm" | "cjs") =>
              join(cwd.replace("packages", join(".bob", target)), "src");

            const distPath = join(cwd, "dist");

            await build({
              cwd,
              pkg,
              fullName,
              config,
              reporter,
              getBuildPath,
              distPath,
            });
          })
        )
      );
    },
  };
});

const limit = pLimit(20);

async function build({
  cwd,
  pkg,
  fullName,
  config,
  reporter,
  getBuildPath,
  distPath,
}: {
  cwd: string;
  pkg: {
    name: string;
    buildOptions: BuildOptions;
    bin?: Record<string, string>;
  };
  fullName: string;
  config: BobConfig;
  reporter: Consola;
  getBuildPath: (target: "esm" | "cjs") => string;
  distPath: string;
}) {
  if (config.ignore?.includes(fullName)) {
    reporter.warn(`Ignored ${fullName}`);
    return;
  }

  validatePackageJson(pkg);

  // remove <project>/dist
  await fse.remove(distPath);

  // Copy type definitions
  await fse.ensureDir(join(distPath, "typings"));

  const declarations = await globby("**/*.d.ts", {
    cwd: getBuildPath("esm"),
    absolute: false,
    ignore: filesToExcludeFromDist,
  });

  await Promise.all(
    declarations.map((filePath) =>
      limit(() =>
        fse.copy(
          join(getBuildPath("esm"), filePath),
          join(distPath, "typings", filePath)
        )
      )
    )
  );

  // Move ESM to dist/esm
  await fse.ensureDir(join(distPath, "esm"));

  const esmFiles = await globby("**/*.js", {
    cwd: getBuildPath("esm"),
    absolute: false,
    ignore: filesToExcludeFromDist,
  });

  await Promise.all(
    esmFiles.map((filePath) =>
      limit(() =>
        fse.copy(
          join(getBuildPath("esm"), filePath),
          join(distPath, "esm", filePath)
        )
      )
    )
  );

  // Transpile ESM to CJS and move CJS to dist/cjs
  await fse.ensureDir(join(distPath, "cjs"));

  const cjsFiles = await globby("**/*.js", {
    cwd: getBuildPath("cjs"),
    absolute: false,
    ignore: filesToExcludeFromDist,
  });

  await Promise.all(
    cjsFiles.map((filePath) =>
      limit(() =>
        fse.copy(
          join(getBuildPath("cjs"), filePath),
          join(distPath, "cjs", filePath)
        )
      )
    )
  );

  // Add package.json to dist/cjs to ensure files are interpreted as commonjs
  await fse.writeFile(
    join(distPath, "cjs", "package.json"),
    JSON.stringify({ type: "commonjs" })
  );

  // move the package.json to dist
  await fse.writeFile(
    join(distPath, "package.json"),
    JSON.stringify(rewritePackageJson(pkg), null, 2)
  );

  // move README.md and LICENSE and other specified files
  await copyToDist(
    cwd,
    ["README.md", "LICENSE", ...(pkg.buildOptions?.copy ?? [])],
    distPath
  );

  if (pkg.bin) {
    if (globalThis.process.platform === "win32") {
      console.warn(
        "Package includes bin files, but cannot set the executable bit on Windows.\n" +
          "Please manually set the executable bit on the bin files before publishing."
      );
    } else {
      await Promise.all(
        Object.values(pkg.bin).map((filePath) =>
          execa("chmod", ["+x", join(cwd, filePath)])
        )
      );
    }
  }

  reporter.success(`Built ${pkg.name}`);
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
    "name",
    "main",
    "module",
    "typings",
    "typescript",
    "type",
  ];

  fields.forEach((field) => {
    if (typeof pkg[field] !== "undefined") {
      newPkg[field] = pkg[field];
    }
  });

  const distDirStr = `${DIST_DIR}/`;

  newPkg.main = newPkg.main.replace(distDirStr, "");
  newPkg.module = newPkg.module.replace(distDirStr, "");
  newPkg.typings = newPkg.typings.replace(distDirStr, "");
  newPkg.typescript = {
    definition: newPkg.typescript.definition.replace(distDirStr, ""),
  };

  if (!pkg.exports) {
    newPkg.exports = presetFields.exports;
  }

  newPkg.exports = rewriteExports(pkg.exports, DIST_DIR);

  if (pkg.bin) {
    newPkg.bin = {};

    for (const alias in pkg.bin) {
      newPkg.bin[alias] = pkg.bin[alias].replace(distDirStr, "");
    }
  }

  return newPkg;
}

export function validatePackageJson(pkg: any) {
  function expect(key: string, expected: unknown) {
    const received = get(pkg, key);

    assert.deepEqual(
      received,
      expected,
      `${pkg.name}: "${key}" equals "${JSON.stringify(received)}"` +
        `, should be "${JSON.stringify(expected)}".\n` +
        `!!! You can run 'bob bootstrap' for fixing your package.json. !!!`
    );
  }

  // If the package has NO binary we need to check the exports map.
  // a package should either
  // 1. have a bin property
  // 2. have a exports property
  // 3. have an exports and bin property
  if (Object.keys(pkg.bin ?? {}).length === 0) {
    expect("main", presetFields.main);
    expect("module", presetFields.module);
    expect("typings", presetFields.typings);
    expect("typescript.definition", presetFields.typescript.definition);
  } else if (
    pkg.main !== undefined ||
    pkg.module !== undefined ||
    pkg.exports !== undefined ||
    pkg.typings !== undefined ||
    pkg.typescript !== undefined
  ) {
    // if there is no bin property, we NEED to check the exports.
    expect("main", presetFields.main);
    expect("module", presetFields.module);
    expect("typings", presetFields.typings);
    expect("typescript.definition", presetFields.typescript.definition);

    // For now we enforce a top level exports property
    expect("exports['.'].require", presetFields.exports["."].require);
    expect("exports['.'].import", presetFields.exports["."].import);
    expect("exports['.'].default", presetFields.exports["."].default);
  }
}

async function copyToDist(cwd: string, files: string[], distDir: string) {
  const allFiles = await globby(files, { cwd });

  return Promise.all(
    allFiles.map(async (file) => {
      if (await fse.pathExists(join(cwd, file))) {
        const sourcePath = join(cwd, file);
        const destPath = join(distDir, file.replace("src/", ""));
        await mkdirp(dirname(destPath));
        await fse.copyFile(sourcePath, destPath);
      }
    })
  );
}
