import type { IsExternal, Plugin } from "rollup";
import { readJSONSync } from "fs-extra";
import getBuiltins from "builtins";

type Options = {
  packageJSONPath: string;
};

export function autoExternal({ packageJSONPath }: Options): Plugin {
  const plugin: Plugin = {
    name: "auto-external",
    options(opts) {
      const pkg = readJSONSync(packageJSONPath);
      const externalModules = [];
      if (typeof pkg.dependencies  === "object") {
        externalModules.push(...Object.keys(pkg.dependencies));
      }
      if (typeof pkg.peerDependencies === "object") {
        externalModules.push(...Object.keys(pkg.peerDependencies));
      }
      externalModules.push(...getBuiltins());
      const externalModulesSet = new Set(externalModules);

      let originalExternal = opts.external;

      const external: IsExternal = (importPath, ...rest) => {
        const [maybeScopeOrPackageName, maybeScopePackageName] =
          importPath.split("/");
        const rootPackageName = maybeScopeOrPackageName.startsWith("@")
          ? `${maybeScopeOrPackageName}/${maybeScopePackageName}`
          : maybeScopeOrPackageName;
        let result: boolean | null =
          externalModulesSet.has(rootPackageName);
        if (!result) {
          if (Array.isArray(originalExternal)) {
            result = originalExternal.includes(importPath);
          } else if (typeof originalExternal === "function") {
            result = originalExternal(importPath, ...rest) || false;
          }
        }
        return result ?? false;
      };

      return Object.assign({}, opts, { external });
    },
  };

  return plugin;
}
