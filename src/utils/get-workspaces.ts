import path from 'node:path';
import fse from 'fs-extra';
import jsYaml from 'js-yaml';
import zod from 'zod';

const WorkspaceModel = zod.optional(
  zod.union([
    zod.array(zod.string()),
    zod.object({
      packages: zod.optional(zod.array(zod.string())),
      nohoist: zod.optional(zod.array(zod.string())),
    }),
  ]),
);

export async function getWorkspaces(
  packageJSON: Record<string, unknown>,
): Promise<string[] | null> {
  let result = WorkspaceModel.parse(packageJSON.workspaces);

  const pnpmWorkspacePath = path.join(process.cwd(), 'pnpm-workspace.yaml');
  const isPnpmWorkspace = await fse.pathExists(pnpmWorkspacePath);

  if (isPnpmWorkspace) {
    if (result) {
      throw new Error(
        'Both `pnpm-workspace.yaml` and `package.json#workspaces` are not supported. Remove `package.json#workspaces` field.',
      );
    }

    result = jsYaml.load(await fse.readFile(pnpmWorkspacePath, 'utf8')) as {
      packages?: string[];
    };
  }
  if (result == null) {
    return null;
  }
  if (Array.isArray(result)) {
    return result;
  }
  if (Array.isArray(result?.packages)) {
    return result.packages;
  }

  return null;
}
