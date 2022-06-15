import globby from "globby";
import * as fse from "fs-extra";
import { createCommand } from "../command";

/** The default bob fields that should be within a package.json */
const presetFields = {
  main: "index.js",
  module: "index.mjs",
  typings: "index.d.ts",
  typescript: {
    definition: "index.d.ts",
  },
  exports: {
    ".": {
      require: {
        default: "./index.js",
        types: "./index.d.ts",
      },
      import: {
        default: "./index.mjs",
        types: "./index.d.ts",
      },
    },
    "./*": {
      require: {
        default: "./*.js",
        types: "./*.d.ts",
      },
      import: {
        default: "./*.mjs",
        types: "./*.d.ts",
      },
    },
    "./package.json": "./package.json",
  },
};

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
      const isSinglePackage = !!rootPackageJSON.workspaces;

      const applyPresetConfig = async (
        packageJSONPath: string,
        packageJSON: Record<string, unknown>
      ) => {
        Object.assign(packageJSON, presetFields);
        await fse.writeJSON(packageJSONPath, packageJSON);
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
