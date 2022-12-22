import globby from "globby";
import zod from "zod";
import * as fse from "fs-extra";
import resolve from "resolve.exports";
import { createCommand } from "../command";
import { presetFields } from "./bootstrap";
import path from "path";
import pLimit from "p-limit";
import execa from "execa";
import { getRootPackageJSON } from "../utils/get-root-package-json";
import { getWorkspaces } from "../utils/get-workspaces";
import { getWorkspacePackagePaths } from "../utils/get-workspace-package-paths";
import { getBobConfig } from "../config";

const ExportsMapEntry = zod.object({
  default: zod.string(),
  types: zod.string(),
});

const ExportsMapModel = zod.record(
  zod.union([
    zod.string(),
    zod.object({
      require: zod.optional(ExportsMapEntry),
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
      const cwd = process.cwd();
      const rootPackageJSON = await getRootPackageJSON();
      const workspaces = getWorkspaces(rootPackageJSON);
      const isSinglePackage = workspaces === null;

      let checkConfigs: Array<{
        cwd: string;
        packageJSON: Record<string, unknown>;
      }> = [];

      if (isSinglePackage) {
        checkConfigs.push({
          cwd,
          packageJSON: rootPackageJSON,
        });
      } else {
        const workspacesPaths = await getWorkspacePackagePaths(workspaces);
        const limit = pLimit(20);
        await Promise.all(
          workspacesPaths.map((workspacePath) =>
            limit(async () => {
              const packageJSONPath = path.join(workspacePath, "package.json");
              const packageJSON: Record<string, unknown> = await fse.readJSON(
                packageJSONPath
              );
              checkConfigs.push({
                cwd: workspacePath,
                packageJSON,
              });
            })
          )
        );
      }

      const limit = pLimit(20);

      let didFail = false;
      await Promise.allSettled(
        checkConfigs.map(({ cwd, packageJSON }) =>
          limit(async () => {
            const config = getBobConfig(packageJSON);
            if (config === false || config?.check === false) {
              api.reporter.warn(`Skip check for '${packageJSON.name}'.`);
              return;
            }

            const distPackageJSONPath = path.join(cwd, "dist", "package.json");
            const distPackageJSON = await fse.readJSON(distPackageJSONPath);

            // a tell for a types-only build is the lack of main import and presence of typings
            if (
              distPackageJSON.main === "" &&
              (distPackageJSON.typings || "").endsWith("d.ts")
            ) {
              api.reporter.warn(
                `Skip check for '${packageJSON.name}' because it's a types-only package.`
              );
              return;
            }

            try {
              await checkExportsMapIntegrity({
                cwd: path.join(cwd, "dist"),
                packageJSON: distPackageJSON,
                skipExports: new Set<string>(config?.check?.skip ?? []),
                includesCommonJS: config?.commonjs ?? true,
              });
            } catch (err) {
              api.reporter.error(
                `Integrity check of '${packageJSON.name}' failed.`
              );
              api.reporter.log(err);
              didFail = true;
              return;
            }
            api.reporter.success(`Checked integrity of '${packageJSON.name}'.`);
          })
        )
      );
      if (didFail) {
        throw new Error("One ore more integrity checks failed.");
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
  skipExports: Set<string>;
  includesCommonJS: boolean;
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

  const cjsSkipExports = new Set<string>();
  const esmSkipExports = new Set<string>();
  for (const definedExport of args.skipExports) {
    if (args.includesCommonJS) {
      const cjsResult = resolve.resolve(args.packageJSON, definedExport, {
        require: true,
      });
      if (typeof cjsResult === "string") {
        cjsSkipExports.add(cjsResult);
      }
    }
    const esmResult = resolve.resolve(args.packageJSON, definedExport);
    if (typeof esmResult === "string") {
      esmSkipExports.add(esmResult);
    }
  }

  for (const key of Object.keys(exportsMap)) {
    if (args.includesCommonJS) {
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
        });

        const limit = pLimit(20);
        await Promise.all(
          cjsFilePaths.map((file) =>
            limit(async () => {
              if (cjsSkipExports.has(file)) {
                return;
              }

              const result = await runRequireJSFileCommand({
                path: file,
                cwd: args.cwd,
              });

              if (result.exitCode !== 0) {
                throw new Error(
                  `Require of file '${file}' failed.\n` +
                    `In case this file is expected to raise an error please add an export to the 'bob.check.skip' field in your 'package.json' file.\n` +
                    `Error:\n` +
                    result.stderr
                );
              }
            })
          )
        );
      } else {
        // package.json or other files
        // for now we just make sure they exists
        await fse.stat(path.join(args.cwd, cjsResult));
      }
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
      });

      const limit = pLimit(20);
      await Promise.all(
        esmFilePaths.map((file) =>
          limit(async () => {
            if (esmSkipExports.has(file)) {
              return;
            }
            const result = await runImportJSFileCommand({
              path: file,
              cwd: args.cwd,
            });
            if (result.exitCode !== 0) {
              throw new Error(
                `Import of file '${file}' failed with error:\n` + result.stderr
              );
            }
          })
        )
      );
    } else {
      // package.json or other files
      // for now we just make sure they exists
      await fse.stat(path.join(args.cwd, esmResult));
    }
  }

  const legacyRequire = resolve.legacy(args.packageJSON, {
    fields: ["main"],
  });
  if (!legacyRequire || typeof legacyRequire !== "string") {
    throw new Error(`Could not resolve legacy CommonJS entrypoint.`);
  }

  if (args.includesCommonJS) {
    const legacyRequireResult = await runRequireJSFileCommand({
      path: legacyRequire,
      cwd: args.cwd,
    });

    if (legacyRequireResult.exitCode !== 0) {
      throw new Error(
        `Require of file '${legacyRequire}' failed with error:\n` +
          legacyRequireResult.stderr
      );
    }
  } else {
    const legacyRequireResult = await runImportJSFileCommand({
      path: legacyRequire,
      cwd: args.cwd,
    });

    if (legacyRequireResult.exitCode !== 0) {
      throw new Error(
        `Require of file '${legacyRequire}' failed with error:\n` +
          legacyRequireResult.stderr
      );
    }
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
        legacyImportResult.stderr
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

    for (const filePath of Object.values(result.data)) {
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
    reject: false,
  });
}

function runImportJSFileCommand(args: { cwd: string; path: string }) {
  return execa(
    "node",
    ["-e", `import('${args.path}').then(() => {${timeout}})`],
    {
      cwd: args.cwd,
      reject: false,
    }
  );
}
