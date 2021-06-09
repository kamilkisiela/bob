import fs from "fs-extra";
import { resolve, join } from "path";
import { createCommand } from "../command";
import { getPackages, Packages } from "./run";
import { equal } from "assert";

export const validateCommand = createCommand((api) => {
  const { config, reporter } = api;

  return {
    command: "validate",
    describe: "Validate the monorepo",
    async handler() {
      const errors: Error[] = [];
      const collectError = (err: Error) => {
        errors.push(err);
      };
      const packages = getPackages(config.ignore);

      await Promise.all([
        validateRootPackage(collectError),
        validateGitIngore(collectError),
        validateRootTSConfig(collectError, packages),
        ...Object.keys(packages).map((name) =>
          validatePackage({ name, packages, onError: collectError })
        ),
      ]);

      errors.sort((a, b) => {
        if (a.message > b.message) {
          return -1;
        } else {
          return 1;
        }
      });

      if (errors.length === 0) {
        reporter.success("Everything looks okay!");
      } else {
        reporter.fatal("Please fix following errors:\n");

        errors.forEach((error) => {
          reporter.error(error.message);
        });

        throw new Error("You monorepo setup is invalid");
      }
    },
  };
});

type OnError = (err: Error) => void;

export async function validateRootPackage(onError: OnError) {
  const pkg = await readJSON(resolve(process.cwd(), "package.json"));

  shouldEqual(
    pkg?.scripts?.build,
    "tsc --project tsconfig.json && bob build",
    `<root>/package.json: 'scripts.build' should equal 'tsc --project tsconfig.json && bob build'`,
    onError
  );
}

export async function validateGitIngore(onError: OnError) {
  const gitignore = await fs.readFile(
    resolve(process.cwd(), ".gitignore"),
    "utf-8"
  );

  const lines: string[] = gitignore.split("\n");

  if (!lines.includes(".bob")) {
    onError(new Error("<root>/.gitignore should contain '.bob'"));
  }

  if (!lines.includes("dist")) {
    onError(new Error("<root>/.gitignore should contain 'dist'"));
  }
}

export async function validateRootTSConfig(
  onError: OnError,
  packages: Packages
) {
  const tsconfig = await readJSON(resolve(process.cwd(), "tsconfig.json"));

  shouldEqual(
    tsconfig.compilerOptions.incremental,
    true,
    "<root>/tsconfig.json: 'compilerOptions.incremental' !== true",
    onError
  );

  shouldEqual(
    tsconfig.compilerOptions.baseUrl,
    ".",
    "<root>/tsconfig.json: 'compilerOptions.baseUrl' !== '.'",
    onError
  );

  shouldEqual(
    tsconfig.compilerOptions.outDir,
    "dist",
    "<root>/tsconfig.json: 'compilerOptions.outDir' !== 'dist'",
    onError
  );

  shouldEqual(
    tsconfig.compilerOptions.module,
    "esnext",
    "<root>/tsconfig.json: 'compilerOptions.module' !== 'esnext'",
    onError
  );

  if (typeof tsconfig.compilerOptions.paths !== "object") {
    onError(
      new Error(`<root>/tsconfig.json: 'compilerOptions.paths' should exist`)
    );
  } else {
    for (const name in packages) {
      if (packages.hasOwnProperty(name)) {
        const { location } = packages[name];

        if (
          !tsconfig.compilerOptions.paths[name] ||
          !tsconfig.compilerOptions.paths[name].includes(
            join(location, "src/index.ts")
          )
        ) {
          onError(
            new Error(
              `<root>/tsconfig.json: 'compilerOptions.paths' should contain ${name} with ['${join(
                location,
                "src/index.ts"
              )}']`
            )
          );
        }
      }
    }
  }

  if (!tsconfig.include || !tsconfig.include.includes("packages")) {
    onError(
      new Error(`<root>/tsconfig.json: 'include' should contain 'package'`)
    );
  }
}

export async function validatePackage({
  name,
  packages,
  onError,
}: {
  name: string;
  packages: Packages;
  onError: OnError;
}) {
  const pkg = await readJSON(
    resolve(process.cwd(), packages[name].location, "package.json")
  );

  shouldEqual(
    pkg.main,
    "dist/index.js",
    `${name}: 'main' should equal 'dist/index.js'`,
    onError
  );
  shouldEqual(
    pkg.module,
    "dist/index.msj",
    `${name}: 'module' should equal 'dist/index.msj'`,
    onError
  );
  shouldEqual(
    pkg.typings,
    "dist/index.d.ts",
    `${name}: 'typings' should equal 'dist/index.d.ts'`,
    onError
  );
  shouldEqual(
    pkg.typescript?.definition,
    "dist/index.d.ts",
    `${name}: 'typescript.definition' should equal 'dist/index.d.ts'`,
    onError
  );

  shouldEqual(
    pkg.exports?.['.']?.require,
    "./dist/index.js",
    `${name}: 'exports.['.'].require' should equal './dist/index.js'`,
    onError
  );
  shouldEqual(
    pkg.exports?.['.']?.import,
    "./dist/index.mjs",
    `${name}: 'exports.['.'].import' should equal './dist/index.mjs'`,
    onError
  );

  shouldEqual(
    pkg.exports?.['./*']?.require,
    "./dist/*.js",
    `${name}: 'exports.['./*'].import' should equal './dist/*.js'`,
    onError
  );
  shouldEqual(
    pkg.exports?.['./*']?.import,
    "./dist/*.mjs",
    `${name}: 'exports.['./*'].import' should equal './dist/*.mjs'`,
    onError
  );
  
  shouldEqual(
    pkg.scripts?.prepack,
    "bob prepack",
    `${name}: 'scripts.prepack' should equal 'bob prepack'`,
    onError
  );
  // TODO: if "bin" then "buildOptions.bin.$.input" equals "bin.$" (just file name, we shouldn't use directories here)
}

async function readJSON<T = any>(filepath: string): Promise<T> {
  return fs.readJSON(filepath, {
    encoding: "utf-8",
  });
}

function shouldEqual(
  value: any,
  expected: any,
  message: string,
  onError: OnError
): void {
  try {
    equal(value, expected, message);
  } catch (error) {
    onError(error);
  }
}
