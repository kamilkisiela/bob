import globby from "globby";
import * as fse from "fs-extra";
import { createCommand } from "../command";

/** The default bob fields that should be within a package.json */
export const presetFields = Object.freeze({
  main: "dist/index.js",
  module: "dist/index.mjs",
  typings: "dist/index.d.ts",
  typescript: {
    definition: "dist/index.d.ts",
  },
  exports: {
    ".": {
      require: {
        types: "./dist/index.d.ts",
        default: "./dist/index.js",
      },
      import: {
        types: "./dist/index.d.ts",
        default: "./dist/index.mjs",
      },
      /** without this default (THAT MUST BE LAST!!!) webpack will have a midlife crisis. */
      default: {
        types: "./dist/index.d.ts",
        default: "./dist/index.mjs",
      },
    },
    "./*": {
      require: {
        types: "./dist/*.d.ts",
        default: "./dist/*.js",
      },
      import: {
        types: "./dist/*.d.ts",
        default: "./dist/*.mjs",
      },
      /** without this default (THAT MUST BE LAST!!!) webpack will have a midlife crisis. */
      default: {
        types: "./dist/*.d.ts",
        default: "./dist/*.mjs",
      },
    },
    "./package.json": "./package.json",
  },
  publishConfig: {
    directory: "dist",
    access: "public",
  },
});

export const bootstrapCommand = createCommand<{}, {}>((api) => {
  return {
    command: "bootstrap",
    describe:
      "The easiest way of setting all the right exports on your package.json files without hassle.",
    builder(yargs) {
      return yargs.options({});
    },
    async handler() {
      const { config } = api;

      const [rootPackageJSONPath] = await globby("package.json", {
        cwd: process.cwd(),
        absolute: true,
      });

      if (rootPackageJSONPath === undefined) {
        throw new Error(
          "Must be executed within a npm (monorepo-)package root."
        );
      }

      const rootPackageJSON: Record<string, unknown> = await fse.readJSON(
        rootPackageJSONPath
      );
      const isSinglePackage =
        Array.isArray(rootPackageJSON.workspaces) === false;

      const applyPresetConfig = async (
        packageJSONPath: string,
        packageJSON: Record<string, unknown>
      ) => {
        Object.assign(packageJSON, presetFields);
        await fse.writeFile(
          packageJSONPath,
          JSON.stringify(packageJSON, null, 2)
        );
      };

      if (isSinglePackage) {
        await applyPresetConfig(rootPackageJSONPath, rootPackageJSON);
        return;
      }

      const packageJSONPaths = await globby("packages/**/package.json", {
        cwd: process.cwd(),
        absolute: true,
        ignore: [
          "**/node_modules/**",
          ...(config.dists?.map(({ distDir }) => `**/${distDir}/**`) ?? []),
        ],
      });

      for (const packageJSONPath of packageJSONPaths) {
        const packageJSON: Record<string, unknown> = await fse.readJSON(
          packageJSONPath
        );
        await applyPresetConfig(packageJSONPath, packageJSON);
      }
    },
  };
});
