import zod from "zod";

const WorkspaceModel = zod.optional(
  zod.union([
    zod.array(zod.string()),
    zod.object({
      packages: zod.optional(zod.array(zod.string())),
      nohoist: zod.optional(zod.array(zod.string())),
    }),
  ])
);

export function getWorkspaces(
  packageJSON: Record<string, unknown>
): Array<string> | null {
  const result = WorkspaceModel.parse(packageJSON.workspaces);
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
