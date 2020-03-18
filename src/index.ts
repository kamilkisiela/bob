#!/usr/bin/env node

import { readFileSync } from "fs";
import { resolve, basename } from "path";
import * as rollup from "rollup";
import * as typescript from "rollup-plugin-typescript2";
import * as generatePackageJson from "rollup-plugin-generate-package-json";
import * as autoExternal from "rollup-plugin-auto-external";
import * as globby from "globby";
import * as mv from "mv";

interface Options {
  input: string;
  umd?: string;
  sourcemap?: boolean;
  bin: { [key: string]: Options };
}

interface PackageJson {
  [key: string]: any;
  buildOptions: Options;
}

async function build(pkg: PackageJson) {
  const options = pkg.buildOptions;

  const inputOptions: rollup.RollupOptions = {
    input: options.input,
    plugins: [
      typescript({
        objectHashIgnoreUnknownHack: true
      }),
      autoExternal(),
      generatePackageJson({
        baseContents: rewritePackageJson({
          pkg,
          preserved: []
        }),
        additionalDependencies: Object.keys(pkg.dependencies)
      })
    ],
    inlineDynamicImports: true
  };

  // create a bundle
  const bundle = await rollup.rollup(inputOptions);

  // generates

  const commonOutputOptions = {
    preferConst: true,
    sourcemap: options.sourcemap
  };

  const generates: rollup.OutputOptions[] = [
    {
      ...commonOutputOptions,
      file: pkg.main,
      format: "cjs"
    },
    {
      ...commonOutputOptions,
      file: pkg.module,
      format: "esm"
    }
  ];

  if (options.umd) {
    generates.push({
      ...commonOutputOptions,
      file: pkg.umd,
      format: "umd",
      name: options.umd
    });
  }

  await Promise.all(
    generates.map(outputOptions => bundle.write(outputOptions))
  );

  await rewriteDeclarations(pkg);

  if (pkg.buildOptions.bin) {
    await Promise.all(
      Object.keys(pkg.buildOptions.bin).map(async alias => {
        const options = pkg.buildOptions.bin[alias];
        const inputOptions: rollup.RollupOptions = {
          input: options.input,
          plugins: [
            typescript({
              objectHashIgnoreUnknownHack: true
            }),
            autoExternal()
          ],
          inlineDynamicImports: true
        };

        const bundle = await rollup.rollup(inputOptions);

        await bundle.write({
          banner: `#!/usr/bin/env node`,
          preferConst: true,
          sourcemap: options.sourcemap,
          file: pkg.bin[alias],
          format: "cjs"
        });
      })
    );
  }
}

async function main() {
  const cwd = process.cwd();
  const pkg = readPackageJson(cwd);

  await build(pkg);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

//

function readPackageJson(baseDir: string) {
  return JSON.parse(
    readFileSync(resolve(baseDir, "package.json"), {
      encoding: "utf-8"
    })
  );
}

function rewritePackageJson({
  pkg,
  preserved
}: {
  pkg: any;
  preserved?: string[];
}) {
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

  if (preserved) {
    fields.push(...preserved);
  }

  fields.forEach(field => {
    if (pkg[field]) {
      newPkg[field] = pkg[field];
    }
  });

  function transformPath(filepath: string): string {
    return basename(filepath);
  }

  newPkg.main = transformPath(pkg.main);
  newPkg.module = transformPath(pkg.module);
  newPkg.typings = transformPath(pkg.typings);
  newPkg.typescript = pkg.typescript;
  if (newPkg.typescript.definition) {
    newPkg.typescript.definition = transformPath(pkg.typescript.definition);
  }

  if (pkg.bin) {
    newPkg.bin = {};
    for (const alias in pkg.bin) {
      newPkg.bin[alias] = transformPath(pkg.bin[alias]);
    }
  }

  // if (produceUMD) {
  //   newPkg.unpkg = pkg.typings.replace('dist/', '');
  //   newPkg.umd = pkg.typings.replace('dist/', '');
  // }

  return newPkg;
}

function pathOf(filepath: string): string {
  const dirs = filepath.split("/");
  return dirs.slice(0, dirs.length - 1).join("/");
}

function depthOf(filepath: string): number {
  return filepath.split("/").length;
}

async function rewriteDeclarations(pkg: PackageJson) {
  if (!pkg.typings) {
    return;
  }

  const declarationFiles = await globby("**", {
    absolute: false,
    cwd: resolve(process.cwd(), pathOf(pkg.typings))
  });

  // find possible `pkg.typings` files
  const possibleIndexes = declarationFiles.filter(filepath =>
    filepath.endsWith(basename(pkg.typings))
  );
  const indexFile = possibleIndexes.reduce((a, b) => {
    const aDirs = depthOf(a);
    const bDirs = depthOf(b);
    return aDirs < bDirs ? a : b;
  });

  const lvl = depthOf(indexFile);

  // no need to move it to /dist
  if (lvl <= 1) {
    return;
  }

  const distPath = pathOf(pkg.typings);

  await Promise.all(
    declarationFiles.map(async filepath => {
      await move(
        resolve(process.cwd(), distPath, filepath),
        resolve(distPath, basename(filepath))
      );
    })
  );
}

function move(src: string, dest: string) {
  return new Promise((resolve, reject) => {
    mv(src, dest, err => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}
