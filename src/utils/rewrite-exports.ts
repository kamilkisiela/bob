type Exports =
  | string
  | {
      require?: string | Record<string, string>;
      import?: string | Record<string, string>;
      default?: string | Record<string, string>;
    };

export function rewriteExports(exports: Record<string, Exports>, distDir: string) {
  const newExports = { ...exports };

  for (const [key, value] of Object.entries(newExports)) {
    if (!value) continue;

    let newValue = value as Exports;

    if (typeof newValue === 'string') {
      newValue = newValue.replace(`${distDir}/`, '');
    } else if (typeof newValue === 'object' && newValue != null) {
      function transformValue(value: string | { [key: string]: string } | undefined) {
        if (value == null) {
          return;
        }
        if (typeof value === 'object') {
          const newValue: Record<string, string> = {};
          for (const [key, path] of Object.entries(value)) {
            newValue[key] = path.replace(`${distDir}/`, '');
          }
          return newValue;
        }
        return value.replace(`${distDir}/`, '');
      }

      newValue = {
        require: transformValue(newValue.require),
        import: transformValue(newValue.import),
        default: transformValue(newValue.import),
      };
    }
    newExports[key.replace(`${distDir}/`, '')] = newValue;
  }

  return newExports;
}
