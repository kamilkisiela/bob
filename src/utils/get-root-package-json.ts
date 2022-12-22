import { globby } from 'globby';
import fse from 'fs-extra';

export async function getRootPackageJSON(cwd = process.cwd()) {
  const [rootPackageJSONPath] = await globby('package.json', {
    cwd,
    absolute: true,
  });

  if (rootPackageJSONPath === undefined) {
    throw new Error('Must be executed within a (monorepo-)package root.');
  }

  const rootPackageJSON: Record<string, unknown> = await fse.readJSON(rootPackageJSONPath);

  return rootPackageJSON;
}
