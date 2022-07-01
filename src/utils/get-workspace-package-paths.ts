import globby from "globby";
import path from "path";

import { buildArtifactDirectories } from "../constants";

export async function getWorkspacePackagePaths(
  cwd: string,
  workspaces: Array<string>
) {
  const packageJSONPaths = await globby(
    workspaces
      /** We are only interested in workspaces that are packages (for now.) */
      .filter((workspacePattern) => workspacePattern.startsWith("packages/"))
      .map((workspacePattern) => path.join(workspacePattern, "package.json")),
    {
      cwd,
      ignore: ["**/node_modules/**", ...buildArtifactDirectories],
    }
  );

  return packageJSONPaths.map((packageJSONPath) =>
    path.dirname(packageJSONPath)
  );
}
