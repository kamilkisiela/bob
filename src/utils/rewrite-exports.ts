export function rewriteExports(
  exports: Record<string, string | { require?: string; import?: string }>,
  distDir: string
) {
  const newExports = { ...exports };

  newExports["./package.json"] = "./package.json";

  newExports["."] = {
    require: "./index.js",
    import: "./index.mjs",
  };

  newExports["./*"] = {
    require: "./*.js",
    import: "./*.mjs",
  };

  for (const [key, value] of Object.entries(newExports)) {
    if (!value) continue;

    let newValue = value as string | { require?: string; import?: string };

    if (typeof newValue === "string") {
      newValue = newValue.replace(`${distDir}/`, "");
    } else if (typeof newValue === "object" && newValue != null) {
      newValue = {
        require: newValue.require?.replace(`${distDir}/`, ""),
        import: newValue.import?.replace(`${distDir}/`, ""),
      };
    }

    newExports[key.replace(`${distDir}/`, "")] = newValue;
  }

  return newExports;
}
