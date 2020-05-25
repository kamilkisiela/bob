import { join } from "path";
import { writeFileSync, readFileSync } from "fs";

import { createCommand } from "../command";

export const prepackCommand = createCommand((api) => {
  const { config, reporter } = api;
  return {
    command: "prepack",
    describe: "Prepares a package",
    handler() {
      const cwd = process.cwd();
      const srcPackageJson = readPackageJson(cwd);
      const fullName: string = srcPackageJson.name;

      if ((config.ignore || []).includes(fullName)) {
        reporter.warn(`Ignored ${fullName}`);
        return;
      }

      const distPackageJson = readPackageJson(join(cwd, "./dist"));

      distPackageJson.version = srcPackageJson.version;

      if ("dependencies" in srcPackageJson) {
        distPackageJson.dependencies = srcPackageJson.dependencies;
      }

      if ("peerDependencies" in srcPackageJson) {
        distPackageJson.peerDependencies = srcPackageJson.peerDependencies;
      }

      if ("optionalDependencies" in srcPackageJson) {
        distPackageJson.optionalDependencies =
          srcPackageJson.optionalDependencies;
      }

      if ("sideEffects" in srcPackageJson) {
        distPackageJson.sideEffects = srcPackageJson.sideEffects;
      }

      writeFileSync(
        join(cwd, "./dist/package.json"),
        JSON.stringify(distPackageJson, null, 2)
      );
    },
  };
});

function readPackageJson(path: string) {
  return JSON.parse(
    readFileSync(join(path, "./package.json"), {
      encoding: "utf-8",
    })
  );
}
