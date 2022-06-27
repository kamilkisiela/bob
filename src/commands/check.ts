import globby from "globby";
import zod from "zod";
import * as fse from "fs-extra";
import resolve from "resolve.exports";
import { createCommand } from "../command";
import { presetFields } from "./bootstrap";
import path from "path";
import pLimit from "p-limit";
import execa from "execa";

const ExportsMapEntry = zod.object({
  default: zod.string(),
  types: zod.string(),
});

const ExportsMapModel = zod.record(
  zod.union([
    zod.string(),
    zod.object({
      require: ExportsMapEntry,
      import: ExportsMapEntry,
      default: ExportsMapEntry,
    }),
  ])
);

const BinModel = zod.record(zod.string());

export const checkCommand = createCommand<{}, {}>((api) => {
  return {
    command: "check",
    describe:
      "Check whether all files in the exports map within the built package can be imported.",
    builder(yargs) {
      return yargs.options({});
    },
    async handler() {
      const [rootPackageJSONPath] = await globby("package.json", {
        cwd: process.cwd(),
        absolute: true,
      });

      if (rootPackageJSONPath === undefined) {
        throw new Error("Must be executed within a (monorepo-)package root.");
      }

      const rootPackageJSON: Record<string, unknown> = await fse.readJSON(
        rootPackageJSONPath
      );
      let packageJSONPaths: Array<string>;

      const isSinglePackage =
        Array.isArray(rootPackageJSON.workspaces) === false;

      if (isSinglePackage) {
        packageJSONPaths = await globby("dist/package.json", {
          cwd: process.cwd(),
          absolute: true,
        });
      } else {
        packageJSONPaths = await globby("packages/**/dist/package.json", {
          cwd: process.cwd(),
          absolute: true,
          ignore: ["**/node_modules/**"],
        });
      }

      if (packageJSONPaths.length === 0) {
        throw new Error(
          "No package.json files found. Did you built the packages using 'bob build'?"
        );
      }

      for (const packageJSONPath of packageJSONPaths) {
        const packageJSON = await fse.readJSON(packageJSONPath);
        checkExportsMapIntegrity({
          cwd: path.dirname(packageJSONPath),
          packageJSON: packageJSON,
        });
        api.reporter.success(`Checked integrity of '${packageJSON.name}'.`);
      }
    },
  };
});

async function checkExportsMapIntegrity(args: {
  cwd: string;
  packageJSON: {
    name: string;
    exports: unknown;
    bin: unknown;
  };
}) {
  const exportsMapResult = ExportsMapModel.safeParse(
    args.packageJSON["exports"]
  );
  if (exportsMapResult.success === false) {
    throw new Error(
      "Missing exports map within the 'package.json'.\n" +
        exportsMapResult.error.message +
        "\nCorrect Example:\n" +
        JSON.stringify(presetFields.exports, null, 2)
    );
  }

  const exportsMap = exportsMapResult["data"];

  for (const key of Object.keys(exportsMap)) {
    const cjsResult = resolve.resolve(args.packageJSON, key, {
      require: true,
    });

    if (!cjsResult) {
      throw new Error(
        `Could not resolve CommonJS import '${key}' for '${args.packageJSON.name}'.`
      );
    }

    if (cjsResult.match(/.(js|cjs)$/)) {
      const cjsFilePaths = await globby(cjsResult, {
        cwd: args.cwd,
        absolute: true,
      });

      const limit = pLimit(20);
      await Promise.all(
        cjsFilePaths.map((file) =>
          limit(async () => {
            const result = await runRequireJSFileCommand({
              path: file,
              cwd: args.cwd,
            });
            if (result.exitCode !== 0) {
              throw new Error(
                `Require of file '${file}' failed with error:\n` + result.all!
              );
            }
          })
        )
      );
    } else {
      // package.json or other files
      // for now we just make sure they exists
      await fse.stat(cjsResult);
    }

    const esmResult = resolve.resolve({ exports: exportsMap }, key);

    if (!esmResult) {
      throw new Error(
        `Could not resolve CommonJS import '${key}' for '${args.packageJSON.name}'.`
      );
    }

    if (esmResult.match(/.(js|mjs)$/)) {
      const esmFilePaths = await globby(esmResult, {
        cwd: args.cwd,
        absolute: true,
      });

      const limit = pLimit(20);
      await Promise.all(
        esmFilePaths.map((file) =>
          limit(async () => {
            const result = await runImportJSFileCommand({
              path: file,
              cwd: args.cwd,
            });
            if (result.exitCode !== 0) {
              throw new Error(
                `Import of file '${file}' failed with error:\n` + result.all
              );
            }
          })
        )
      );
    } else {
      // package.json or other files
      // for now we just make sure they exists
      await fse.stat(esmResult);
    }
  }

  const legacyRequire = resolve.legacy(args.packageJSON, {
    fields: ["main"],
  });
  if (!legacyRequire || typeof legacyRequire !== "string") {
    throw new Error(`Could not resolve legacy CommonJS entrypoint.`);
  }
  const legacyRequireResult = await runRequireJSFileCommand({
    path: legacyRequire,
    cwd: args.cwd,
  });

  if (legacyRequireResult.exitCode !== 0) {
    throw new Error(
      `Require of file '${legacyRequire}' failed with error:\n` +
        legacyRequireResult.all
    );
  }

  const legacyImport = resolve.legacy(args.packageJSON);
  if (!legacyImport || typeof legacyImport !== "string") {
    throw new Error(`Could not resolve legacy ESM entrypoint.`);
  }
  const legacyImportResult = await runImportJSFileCommand({
    path: legacyImport,
    cwd: args.cwd,
  });
  if (legacyImportResult.exitCode !== 0) {
    throw new Error(
      `Require of file '${legacyRequire}' failed with error:\n` +
        legacyImportResult.all
    );
  }

  if (args.packageJSON.bin) {
    const result = BinModel.safeParse(args.packageJSON.bin);
    if (result.success === false) {
      throw new Error(
        "Invalid format of bin field in package.json.\n" + result.error.message
      );
    }

    const cache = new Set<string>();

    for (const [_binary, filePath] of Object.entries(result.data)) {
      if (cache.has(filePath)) {
        continue;
      }
      cache.add(filePath);

      const absoluteFilePath = path.join(args.cwd, filePath);
      await fse.stat(absoluteFilePath).catch(() => {
        throw new Error(
          "Could not find binary file '" + absoluteFilePath + "'."
        );
      });
      await fse
        .access(path.join(args.cwd, filePath), fse.constants.X_OK)
        .catch(() => {
          throw new Error(
            "Binary file '" +
              absoluteFilePath +
              "' is not executable.\n" +
              `Please set the executable bit e.g. by running 'chmod +x "${absoluteFilePath}"'.`
          );
        });

      const contents = await fse.readFile(absoluteFilePath, "utf-8");
      if (contents.startsWith("#!/usr/bin/env node\n") === false) {
        throw new Error(
          "Binary file '" +
            absoluteFilePath +
            "' does not have a shebang.\n Please add '#!/usr/bin/env node' to the beginning of the file."
        );
      }
    }
  }
}

const timeout = `;setTimeout(() => { throw new Error("The Node.js process hangs. There is probably some side-effects. All exports should be free of side effects.") }, 500).unref()`;

function runRequireJSFileCommand(args: {
  cwd: string;
  path: string;
}): execa.ExecaChildProcess<string> {
  return execa("node", ["-e", `require('${args.path}')${timeout}`], {
    cwd: args.cwd,
  });
}

function runImportJSFileCommand(args: { cwd: string; path: string }) {
  return execa(
    "node",
    ["-e", `import('${args.path}').then(() => {${timeout}})`],
    {
      cwd: args.cwd,
    }
  );
}
