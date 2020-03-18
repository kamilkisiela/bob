#!/usr/bin/env node

import { readFileSync } from "fs";
import { resolve, basename, relative, dirname } from "path";
import * as globby from "globby";
import * as mv from "mv";
import * as rollup from "rollup";
import * as typescript from "rollup-plugin-typescript2";
import * as generatePackageJson from "rollup-plugin-generate-package-json";
import * as autoExternal from "rollup-plugin-auto-external";

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
        clean: true
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

  if (pkg.typings) {
    await moveDeclarations(pkg);
  }
}

function move(source: string, target: string) {
  return new Promise((resolve, reject) => {
    mv(source, target, { mkdirp: true }, err => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

async function moveDeclarations(pkg: PackageJson) {
  // Get "index.d.ts" file
  const indexDeclaration = basename(pkg.typings);
  // Check what's the build dir
  const distDir = dirname(pkg.typings);

  // search for all declaration files
  const declarations = await globby("**/*.d.ts", {
    cwd: resolve(process.cwd(), distDir)
  });

  // look for all "index.d.ts"s files
  const possibleIndexes = declarations.filter(filepath =>
    filepath.endsWith(indexDeclaration)
  );

  // we look for "index.d.ts" file.
  // There may be many so we look for the one that is closest to the root dir
  const indexFilepath = possibleIndexes.reduce((prev, current) => {
    const currentDirCount = current.split("/").length;
    const prevDirCount = prev.split("/").length;

    if (prevDirCount < currentDirCount) {
      return prev;
    }

    return current;
  });

  // in some cases we end up with `dist/packages/foo/src/index.d.ts`
  // so we need to "cut of" the `packages/foo/src` part
  // that's why we look for how many directories we need to remove from the path
  const lvl = relative(indexFilepath, ".").split("/").length;

  if (lvl === 1) {
    return;
  }

  // then we remove those dirs and create a path again
  const sourceDir = indexFilepath
    .split("/")
    .slice(0, lvl - 1)
    .join("/");

  const tmpDir = "__tmp";
  const filesToPutBack = await globby("*", {
    cwd: distDir
  });

  await move(resolve(distDir), resolve(tmpDir));
  await move(resolve(distDir, sourceDir), resolve(distDir));
  await Promise.all(filesToPutBack.map(filepath => move(filepath, distDir)));
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
