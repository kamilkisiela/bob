#!/usr/bin/env node

import {readFileSync} from 'fs';
import {resolve, basename} from 'path';
import * as rollup from 'rollup';
import * as typescript from 'rollup-plugin-typescript2';
import * as generatePackageJson from 'rollup-plugin-generate-package-json';

interface Options {
  input: string;
  umd?: string;
  sourcemap?: boolean;
}

interface BuildOptions {
  pkg: any;
  options: Options;
}

async function build({options, pkg}: BuildOptions) {
  const inputOptions: rollup.RollupOptions = {
    input: options.input,
    plugins: [
      typescript(),
      generatePackageJson({
        baseContents: rewritePackageJson({
          pkg,
          preserved: [],
        }),
      }),
    ],
  };

  // create a bundle
  const bundle = await rollup.rollup(inputOptions);

  // generates

  const commonOutputOptions = {preferConst: true, sourcemap: options.sourcemap};

  const generates: rollup.OutputOptions[] = [
    {
      ...commonOutputOptions,
      file: pkg.main,
      format: 'cjs',
    },
    {
      ...commonOutputOptions,
      file: pkg.module,
      format: 'esm',
    },
  ];

  if (options.umd) {
    generates.push({
      ...commonOutputOptions,
      file: pkg.umd,
      format: 'umd',
      name: options.umd,
    });
  }

  await Promise.all(
    generates.map(outputOptions => bundle.write(outputOptions)),
  );
}

async function main() {
  const cwd = process.cwd();
  const pkg = readPackageJson(cwd);

  await build({pkg, options: pkg.buildOptions});
}

main();

//

function readPackageJson(baseDir: string) {
  return JSON.parse(
    readFileSync(resolve(baseDir, 'package.json'), {
      encoding: 'utf-8',
    }),
  );
}

function rewritePackageJson({
  pkg,
  preserved,
}: {
  pkg: any;
  preserved?: string[];
}) {
  const newPkg: Record<string, any> = {};
  const fields = [
    'name',
    'version',
    'description',
    'sideEffects',
    'peerDependencies',
    'repository',
    'homepage',
    'keywords',
    'author',
    'license',
    'engines',
  ];

  if (preserved) {
    fields.push(...preserved);
  }

  fields.forEach(field => {
    newPkg[field] = pkg[field];
  });

  function transformPath(filepath: string): string {
    return basename(filepath);
  }

  newPkg.main = transformPath(pkg.main);
  newPkg.module = transformPath(pkg.module);
  newPkg.typings = transformPath(pkg.typings);

  // if (produceUMD) {
  //   newPkg.unpkg = pkg.typings.replace('dist/', '');
  //   newPkg.umd = pkg.typings.replace('dist/', '');
  // }

  return newPkg;
}
