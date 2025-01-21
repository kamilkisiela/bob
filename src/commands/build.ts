import assert from 'assert';
import { dirname, join, resolve } from 'path';
import { type ConsolaInstance } from 'consola';
import { execa } from 'execa';
import fse from 'fs-extra';
import { getTsconfig, parseTsconfig } from 'get-tsconfig';
import { globby } from 'globby';
import get from 'lodash.get';
import pLimit from 'p-limit';
import { createCommand } from '../command.js';
import { getBobConfig } from '../config.js';
import { getRootPackageJSON } from '../utils/get-root-package-json.js';
import { getWorkspacePackagePaths } from '../utils/get-workspace-package-paths.js';
import { getWorkspaces } from '../utils/get-workspaces.js';
import { rewriteExports } from '../utils/rewrite-exports.js';
import { presetFieldsDual, presetFieldsOnlyESM } from './bootstrap.js';

export const DIST_DIR = 'dist';

export const DEFAULT_TS_BUILD_CONFIG = 'tsconfig.build.json';

interface PackageInfo {
  packagePath: string;
  cwd: string;
  pkg: any;
  fullName: string;
}

/**
 * A list of files that we don't need within the published package.
 * Also known as test files :)
 * This list is derived from scouting various of our repositories.
 */
const filesToExcludeFromDist = [
  '**/test/**',
  '**/tests/**',
  '**/__tests__/**',
  '**/__testUtils__/**',
  '**/*.spec.*',
  '**/*.test.*',
  '**/dist',
  '**/temp',
];

function compilerOptionsToArgs(options: Record<string, unknown>): string[] {
  return Object.entries(options)
    .filter(([, value]) => !!value)
    .flatMap(([key, value]) => [`--${key}`, `${value}`]);
}

function assertTypeScriptBuildResult(
  result: Awaited<ReturnType<typeof execa>>,
  reporter: ConsolaInstance,
) {
  if (result.exitCode !== 0) {
    reporter.error(result.stdout);
    throw new Error('TypeScript compiler exited with non-zero exit code.');
  }
}

async function buildTypeScript(
  buildPath: string,
  options: {
    cwd: string;
    tsconfig?: string;
    incremental?: boolean;
  },
  reporter: ConsolaInstance,
) {
  let project = options.tsconfig;
  if (!project && (await fse.exists(join(options.cwd, DEFAULT_TS_BUILD_CONFIG)))) {
    project = join(options.cwd, DEFAULT_TS_BUILD_CONFIG);
  }

  const tsconfig = project ? parseTsconfig(project) : getTsconfig(options.cwd)?.config;

  const moduleResolution = (tsconfig?.compilerOptions?.moduleResolution || '').toLowerCase();
  const isModernNodeModuleResolution = ['node16', 'nodenext'].includes(moduleResolution);
  const isOldNodeModuleResolution = ['classic', 'node', 'node10'].includes(moduleResolution);
  if (moduleResolution && !isOldNodeModuleResolution && !isModernNodeModuleResolution) {
    throw new Error(
      `'moduleResolution' option '${moduleResolution}' cannot be used to build CommonJS"`,
    );
  }

  if (Math.random()) {
    throw JSON.stringify(
      {
        project,
        tsconfig,
        moduleResolution,
        isModernNodeModuleResolution,
        isOldNodeModuleResolution,
      },
      null,
      '  ',
    );
  }

  async function build(out: PackageJsonType) {
    const revertPackageJsonsType = await setPackageJsonsType(
      { cwd: options.cwd, ignore: [...filesToExcludeFromDist, ...(tsconfig?.exclude || [])] },
      out,
    );
    try {
      assertTypeScriptBuildResult(
        await execa('npx', [
          'tsc',
          ...compilerOptionsToArgs({
            project,
            module: isModernNodeModuleResolution
              ? moduleResolution // match module with moduleResolution for modern node (nodenext and node16)
              : out === 'module'
                ? 'es2022'
                : isOldNodeModuleResolution
                  ? 'commonjs' // old commonjs
                  : 'node16', // modern commonjs
            sourceMap: false,
            inlineSourceMap: false,
            incremental: options.incremental,
            outDir: out === 'module' ? join(buildPath, 'esm') : join(buildPath, 'cjs'),
          }),
        ]),
        reporter,
      );
    } finally {
      await revertPackageJsonsType();
    }
  }

  await build('module');
  await build('commonjs');
}

export const buildCommand = createCommand<
  {},
  {
    tsconfig?: string;
    incremental?: boolean;
  }
>(api => {
  const { reporter } = api;

  return {
    command: 'build',
    describe: 'Build',
    builder(yargs) {
      return yargs.options({
        tsconfig: {
          describe: `Which tsconfig file to use when building TypeScript. By default bob will use ${DEFAULT_TS_BUILD_CONFIG} if it exists, otherwise the TSC's default.`,
          type: 'string',
        },
        incremental: {
          describe: 'Better performance by building only packages that had changes.',
          type: 'boolean',
        },
      });
    },
    async handler({ tsconfig, incremental }) {
      const cwd = process.cwd();
      const rootPackageJSON = await getRootPackageJSON();
      const workspaces = await getWorkspaces(rootPackageJSON);
      const isSinglePackage = workspaces === null;

      if (isSinglePackage) {
        const buildPath = join(cwd, '.bob');

        if (!incremental) {
          await fse.remove(buildPath);
        }
        await buildTypeScript(buildPath, { cwd, tsconfig, incremental }, reporter);
        const pkg = await fse.readJSON(resolve(cwd, 'package.json'));
        const fullName: string = pkg.name;

        const distPath = join(cwd, 'dist');

        const getBuildPath = (target: 'esm' | 'cjs') => join(buildPath, target);

        await build({
          cwd,
          pkg,
          fullName,
          reporter,
          getBuildPath,
          distPath,
        });
        return;
      }

      const limit = pLimit(4);
      const workspacePackagePaths = await getWorkspacePackagePaths(workspaces);

      const packageInfoList: PackageInfo[] = await Promise.all(
        workspacePackagePaths.map(packagePath =>
          limit(async () => {
            const cwd = packagePath;
            const pkg = await fse.readJSON(resolve(cwd, 'package.json'));
            const fullName: string = pkg.name;
            return { packagePath, cwd, pkg, fullName };
          }),
        ),
      );

      const bobBuildPath = join(cwd, '.bob');
      if (!incremental) {
        await fse.remove(bobBuildPath);
      }
      await buildTypeScript(bobBuildPath, { cwd, tsconfig, incremental }, reporter);

      await Promise.all(
        packageInfoList.map(({ cwd, pkg, fullName }) =>
          limit(async () => {
            const getBuildPath = (target: 'esm' | 'cjs') =>
              join(cwd.replace('packages', join('.bob', target)), 'src');

            const distPath = join(cwd, 'dist');

            await build({
              cwd,
              pkg,
              fullName,
              reporter,
              getBuildPath,
              distPath,
            });
          }),
        ),
      );
    },
  };
});

const limit = pLimit(20);

async function build({
  cwd,
  pkg,
  fullName,
  reporter,
  getBuildPath,
  distPath,
}: {
  cwd: string;
  pkg: {
    name: string;
    bin?: Record<string, string>;
  };
  fullName: string;
  reporter: ConsolaInstance;
  getBuildPath: (target: 'esm' | 'cjs') => string;
  distPath: string;
}) {
  const config = getBobConfig(pkg);

  if (config === false || config?.build === false) {
    reporter.warn(`Skip build for '${fullName}'`);
    return;
  }

  const dual = config?.commonjs ?? true;

  validatePackageJson(pkg, { dual });

  const declarations = await globby('**/*.d.ts', {
    cwd: getBuildPath('esm'),
    absolute: false,
    ignore: filesToExcludeFromDist,
  });

  await fse.ensureDir(join(distPath, 'typings'));
  await Promise.all(
    declarations.map(filePath =>
      limit(() =>
        fse.copy(join(getBuildPath('esm'), filePath), join(distPath, 'typings', filePath)),
      ),
    ),
  );

  const esmFiles = await globby('**/*.js', {
    cwd: getBuildPath('esm'),
    absolute: false,
    ignore: filesToExcludeFromDist,
  });

  // all files that export nothing, should be completely empty
  // this way we wont have issues with linters: <link to issue>
  // and we will also make all type-only packages happy
  for (const file of esmFiles) {
    const src = await fse.readFile(join(getBuildPath('esm'), file));
    if (src.toString().trim() === 'export {};') {
      await fse.writeFile(join(getBuildPath('esm'), file), '');
    }
  }

  await fse.ensureDir(join(distPath, 'esm'));
  await Promise.all(
    esmFiles.map(filePath =>
      limit(() => fse.copy(join(getBuildPath('esm'), filePath), join(distPath, 'esm', filePath))),
    ),
  );

  if (dual) {
    // Transpile ESM to CJS and move CJS to dist/cjs only if there's something to transpile
    await fse.ensureDir(join(distPath, 'cjs'));

    const cjsFiles = await globby('**/*.js', {
      cwd: getBuildPath('cjs'),
      absolute: false,
      ignore: filesToExcludeFromDist,
    });

    // all files that export nothing, should be completely empty
    // this way we wont have issues with linters: <link to issue>
    // and we will also make all type-only packages happy
    for (const file of cjsFiles) {
      const src = await fse.readFile(join(getBuildPath('cjs'), file));
      if (
        // TODO: will this always be the case with empty cjs files
        src.toString().trim() ===
        '"use strict";\nObject.defineProperty(exports, "__esModule", { value: true });'
      ) {
        await fse.writeFile(join(getBuildPath('cjs'), file), '');
      }
    }

    await Promise.all(
      cjsFiles.map(filePath =>
        limit(() => fse.copy(join(getBuildPath('cjs'), filePath), join(distPath, 'cjs', filePath))),
      ),
    );

    // Add package.json to dist/cjs to ensure files are interpreted as commonjs
    await fse.writeFile(
      join(distPath, 'cjs', 'package.json'),
      JSON.stringify({ type: 'commonjs' }),
    );
    // We need to provide .cjs extension type definitions as well :)
    // https://github.com/ardatan/graphql-tools/discussions/4581#discussioncomment-3329673

    const declarations = await globby('**/*.d.ts', {
      cwd: getBuildPath('cjs'),
      absolute: false,
      ignore: filesToExcludeFromDist,
    });
    await Promise.all(
      declarations.map(filePath =>
        limit(async () => {
          const contents = await fse.readFile(join(getBuildPath('cjs'), filePath), 'utf-8');
          await fse.writeFile(
            join(distPath, 'typings', filePath.replace(/\.d\.ts/, '.d.cts')),
            contents.replace(/\.js";\n/g, `.cjs";\n`).replace(/\.js';\n/g, `.cjs';\n`),
          );
        }),
      ),
    );
  }

  // move the package.json to dist
  await fse.writeFile(
    join(distPath, 'package.json'),
    JSON.stringify(rewritePackageJson(pkg), null, 2),
  );

  // move README.md and LICENSE and other specified files
  await copyToDist(cwd, ['README.md', 'LICENSE', ...(config?.build?.copy ?? [])], distPath);

  if (pkg.bin) {
    if (globalThis.process.platform === 'win32') {
      reporter.warn(
        'Package includes bin files, but cannot set the executable bit on Windows.\n' +
          'Please manually set the executable bit on the bin files before publishing.',
      );
    } else {
      await Promise.all(
        Object.values(pkg.bin).map(filePath => execa('chmod', ['+x', join(cwd, filePath)])),
      );
    }
  }

  reporter.success(`Built ${pkg.name}`);
}

function rewritePackageJson(pkg: Record<string, any>) {
  const newPkg: Record<string, any> = {};
  const fields = [
    'name',
    'version',
    'description',
    'sideEffects',
    'peerDependenciesMeta',
    'peerDependencies',
    'dependencies',
    'optionalDependencies',
    'repository',
    'homepage',
    'keywords',
    'author',
    'license',
    'engines',
    'name',
    'main',
    'typings',
    'type',
  ];

  fields.forEach(field => {
    if (pkg[field] !== undefined) {
      newPkg[field] = pkg[field];
      if (field === 'engines') {
        // remove all package managers from engines field
        const ignoredPackageManagers = ['npm', 'yarn', 'pnpm'];
        for (const packageManager of ignoredPackageManagers) {
          if (newPkg[field][packageManager]) {
            delete newPkg[field][packageManager];
          }
        }
      }
    }
  });

  const distDirStr = `${DIST_DIR}/`;

  newPkg.main = newPkg.main.replace(distDirStr, '');
  newPkg.typings = newPkg.typings.replace(distDirStr, '');

  if (!pkg.exports) {
    newPkg.exports = presetFieldsDual.exports;
  }
  newPkg.exports = rewriteExports(pkg.exports, DIST_DIR);

  if (pkg.bin) {
    newPkg.bin = {};

    for (const alias in pkg.bin) {
      newPkg.bin[alias] = pkg.bin[alias].replace(distDirStr, '');
    }
  }

  return newPkg;
}

export function validatePackageJson(
  pkg: any,
  opts: {
    dual: boolean;
  },
) {
  function expect(key: string, expected: unknown) {
    const received = get(pkg, key);

    assert.deepEqual(
      received,
      expected,
      `${pkg.name}: "${key}" equals "${JSON.stringify(received)}"` +
        `, should be "${JSON.stringify(expected)}".`,
    );
  }

  // If the package has NO binary we need to check the exports map.
  // a package should either
  // 1. have a bin property
  // 2. have an exports property
  // 3. have an exports and bin property
  if (Object.keys(pkg.bin ?? {}).length > 0) {
    if (opts.dual === true) {
      expect('main', presetFieldsDual.main);
      expect('typings', presetFieldsDual.typings);
    } else {
      expect('main', presetFieldsOnlyESM.main);
      expect('typings', presetFieldsOnlyESM.typings);
    }
  } else if (pkg.main !== undefined || pkg.exports !== undefined || pkg.typings !== undefined) {
    if (opts.dual === true) {
      // if there is no bin property, we NEED to check the exports.
      expect('main', presetFieldsDual.main);
      expect('typings', presetFieldsDual.typings);

      // For now we enforce a top level exports property
      expect("exports['.'].require", presetFieldsDual.exports['.'].require);
      expect("exports['.'].import", presetFieldsDual.exports['.'].import);
      expect("exports['.'].default", presetFieldsDual.exports['.'].default);
    } else {
      expect('main', presetFieldsOnlyESM.main);
      expect('typings', presetFieldsOnlyESM.typings);

      // For now, we enforce a top level exports property
      expect("exports['.']", presetFieldsOnlyESM.exports['.']);
    }
  }
}

type PackageJsonType = 'module' | 'commonjs';

/**
 * Sets the {@link cwd workspaces} package.json(s) `"type"` field to the defined {@link type}
 * returning a "revert" function which puts the original `"type"` back.
 *
 * @returns A revert function that reverts the original value of the `"type"` field.
 */
async function setPackageJsonsType(
  { cwd, ignore }: { cwd: string; ignore: string[] },
  type: PackageJsonType,
): Promise<() => Promise<void>> {
  const rootPkgJsonPath = join(cwd, 'package.json');
  const rootContents = await fse.readFile(rootPkgJsonPath, 'utf8');
  const rootPkg = JSON.parse(rootContents);
  const workspaces = await getWorkspaces(rootPkg);
  const isSinglePackage = workspaces === null;

  const reverts: (() => Promise<void>)[] = [];

  for (const pkgJsonPath of [
    // we also want to modify the root package.json TODO: do we in single package repos?
    rootPkgJsonPath,
    ...(isSinglePackage
      ? []
      : await globby(
          workspaces.map((w: string) => w + '/package.json'),
          { cwd, absolute: true, ignore },
        )),
  ]) {
    const contents =
      pkgJsonPath === rootPkgJsonPath
        ? // no need to re-read the root package.json
          rootContents
        : await fse.readFile(pkgJsonPath, 'utf8');
    const endsWithNewline = contents.endsWith('\n');

    const pkg = JSON.parse(contents);
    if (pkg.type != null && pkg.type !== 'commonjs' && pkg.type !== 'module') {
      throw new Error(`Invalid "type" property value "${pkg.type}" in ${pkgJsonPath}`);
    }

    const originalPkg = { ...pkg };
    const differentType =
      (pkg.type ||
        // default when the type is not defined
        'commonjs') !== type;

    // change only if the provided type is different
    if (differentType) {
      pkg.type = type;
      await fse.writeFile(
        pkgJsonPath,
        JSON.stringify(pkg, null, '  ') + (endsWithNewline ? '\n' : ''),
      );

      // revert change, of course only if we changed something
      reverts.push(async () => {
        await fse.writeFile(
          pkgJsonPath,
          JSON.stringify(originalPkg, null, '  ') + (endsWithNewline ? '\n' : ''),
        );
      });
    }
  }

  return async function revert() {
    await Promise.all(reverts.map(r => r()));
  };
}

async function executeCopy(sourcePath: string, destPath: string) {
  await fse.mkdirp(dirname(destPath));
  await fse.copyFile(sourcePath, destPath);
}

async function copyToDist(cwd: string, files: string[], distDir: string) {
  const allFiles = await globby(files, { cwd });

  return Promise.all(
    allFiles.map(async file => {
      if (await fse.pathExists(join(cwd, file))) {
        const sourcePath = join(cwd, file);
        if (file.includes('src/')) {
          // Figure relevant module types
          const allTypes: ('cjs' | 'esm')[] = [];
          if (await fse.pathExists(join(distDir, 'esm'))) {
            allTypes.push('esm');
          }
          if (await fse.pathExists(join(distDir, 'cjs'))) {
            allTypes.push('cjs');
          }

          // FOr each type, copy files to the relevant directory
          await Promise.all(
            allTypes.map(type =>
              executeCopy(sourcePath, join(distDir, file.replace('src/', `${type}/`))),
            ),
          );
        } else {
          const destPath = join(distDir, file);
          executeCopy(sourcePath, destPath);
        }
      }
    }),
  );
}
