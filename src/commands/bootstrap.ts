import globby from "globby";
import pLimit from "p-limit";
import * as path from "path";
import * as fse from "fs-extra";
import { createCommand } from "../command";
import { buildArtifactDirectories } from "../constants";
import { getRootPackageJSON } from "../utils/get-root-package-json";
import { getWorkspaces } from "../utils/get-workspaces";
import { getWorkspacePackagePaths } from "../utils/get-workspace-package-paths";

/** The default bob fields that should be within a package.json */
export const presetFields = Object.freeze({
  type: "module",
  main: "dist/cjs/index.js",
  module: "dist/esm/index.js",
  typings: "dist/typings/index.d.ts",
  typescript: {
    definition: "dist/typings/index.d.ts",
  },
  exports: {
    ".": {
      require: {
        types: "./dist/typings/index.d.ts",
        default: "./dist/cjs/index.js",
      },
      import: {
        types: "./dist/typings/index.d.ts",
        default: "./dist/esm/index.js",
      },
      /** without this default (THAT MUST BE LAST!!!) webpack will have a midlife crisis. */
      default: {
        types: "./dist/typings/index.d.ts",
        default: "./dist/esm/index.js",
      },
    },
    "./*": {
      require: {
        types: "./dist/typings/*.d.ts",
        default: "./dist/cjs/*.js",
      },
      import: {
        types: "./dist/typings/*.d.ts",
        default: "./dist/esm/*.js",
      },
      /** without this default (THAT MUST BE LAST!!!) webpack will have a midlife crisis. */
      default: {
        types: "./dist/typings/*.d.ts",
        default: "./dist/esm/*.js",
      },
    },
    "./package.json": "./package.json",
  },
  publishConfig: {
    directory: "dist",
    access: "public",
  },
});

function transformModuleImports(fileContents: string) {
  return fileContents.replace(
    /* this regex should hopefully catch all kind of import/export expressions that are relative. */
    /((?:import|export)\s+[\s\w,{}*]*\s+from\s+["'])((?:\.\/|\.\.\/)(?:(?!\.js).)+)(["'])/g,
    (_, importFromPart, modulePath, hyphenEndPart) =>
      `${importFromPart}${modulePath}.js${hyphenEndPart}`
  );
}

async function applyESMModuleTransform(cwd: string) {
  const files = await globby("**/*.ts", {
    cwd,
    absolute: true,
    ignore: ["**/node_modules/**", ...buildArtifactDirectories],
  });

  const limit = pLimit(20);

  await Promise.all(
    files.map((file) =>
      limit(async () => {
        const contents = await fse.readFile(file, "utf-8");
        await fse.writeFile(file, transformModuleImports(contents));
      })
    )
  );
}

async function applyPackageJSONPresetConfig(
  packageJSONPath: string,
  packageJSON: Record<string, unknown>
) {
  Object.assign(packageJSON, presetFields);
  await fse.writeFile(packageJSONPath, JSON.stringify(packageJSON, null, 2));
}

const limit = pLimit(20);

export const bootstrapCommand = createCommand<{}, {}>(() => {
  return {
    command: "bootstrap",
    describe:
      "The easiest way of setting all the right exports on your package.json files without hassle.",
    builder(yargs) {
      return yargs.options({});
    },
    async handler() {
      const cwd = process.cwd();
      const rootPackageJSON = await getRootPackageJSON(cwd);
      const workspaces = getWorkspaces(rootPackageJSON);
      const isSinglePackage = workspaces === null;

      // Make sure all modules are converted to ESM

      if (isSinglePackage) {
        await applyESMModuleTransform(cwd);
        await applyPackageJSONPresetConfig(
          path.join(cwd, "package.json"),
          rootPackageJSON
        );
        return;
      }

      const workspacePackagePaths = await getWorkspacePackagePaths(
        cwd,
        workspaces
      );

      await Promise.all(
        workspacePackagePaths.map((packagePath) =>
          limit(async () => {
            const packageJSONPath = path.join(packagePath, "package.json");
            const packageJSON: Record<string, unknown> = await fse.readJSON(
              packageJSONPath
            );
            await applyESMModuleTransform(packagePath);
            await applyPackageJSONPresetConfig(packageJSONPath, packageJSON);
          })
        )
      );
    },
  };
});
