import globby from "globby";
import path from "path";

import { buildArtifactDirectories } from "../constants";

export async function getWorkspacePackagePaths(
  cwd: string,
  workspaces: Array<string>
) {
  const packageJSONPaths = await globby(
    workspaces.map((workspacePattern) =>
      path.join(workspacePattern, "package.json")
    ),
    {
      cwd,
      absolute: true,
      ignore: ["**/node_modules/**", ...buildArtifactDirectories],
    }
  );

  return packageJSONPaths.map((packageJSONPath) =>
    path.dirname(packageJSONPath)
  );
}
