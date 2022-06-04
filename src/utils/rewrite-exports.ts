export function rewriteExports(
  exports: Record<string, string | { require?: string | { [key: string]: string }; import?: string | { [key: string]: string } }>,
  distDir: string
) {
  const newExports = { ...exports };

  newExports["./package.json"] = "./package.json";

  newExports["."] = {
    require: {
      default: "./index.js",
      types: "./index.d.ts"
    },
    import: {
      default: "./index.mjs",
      types: "./index.d.ts",
    },
  };

  newExports["./*"] = {
    require:  {
      default: "./*.js",
      types: "./*.d.ts"
    },
    import: {
      default: "./*.mjs",
      types: "./*.d.ts"
    },
  };

  for (const [key, value] of Object.entries(newExports)) {
    if (!value) continue;

    let newValue = value as string | { require?: string | { [key: string]: string }; import?: string | { [key: string]: string } };

    if (typeof newValue === "string") {
      newValue = newValue.replace(`${distDir}/`, "");
    } else if (typeof newValue === "object" && newValue != null) {

      function transformValue(value: string | { [key: string]: string } | undefined) {
        if (value == null) {
          return undefined
        }
        if (typeof value === "object") {
          const newValue: Record<string, string> = {}
          for (const [key, path] of Object.entries(value)) {
            newValue[key] = path.replace(`${distDir}/`, "")
          }
          return newValue
        }
        return value.replace(`${distDir}/`, "")
      }

      newValue = {
        require: transformValue(newValue.require),
        import: transformValue(newValue.import),
      };
    }
    newExports[key.replace(`${distDir}/`, "")] = newValue;
  }

  return newExports;
}
