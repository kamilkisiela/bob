import path from 'path';
import { globby } from 'globby';
import { buildArtifactDirectories } from '../constants.js';

export async function getWorkspacePackagePaths(workspaces: string[], cwd = process.cwd()) {
  const packageJSONPaths = await globby(
    workspaces
      /** We are only interested in workspaces that are packages (for now.) */
      .filter(workspacePattern => workspacePattern.startsWith('packages/'))
      .map(workspacePattern => path.posix.join(workspacePattern, 'package.json')),
    {
      cwd,
      ignore: ['**/node_modules/**', ...buildArtifactDirectories],
    },
  );

  return packageJSONPaths.map(packageJSONPath => path.dirname(packageJSONPath));
}
