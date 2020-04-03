import * as core from "@actions/core";
import { useConfig } from "./config";
import { getAffectedPackages } from "./commands/affected";

async function run(): Promise<void> {
  try {
    core.info("Running Bob...");

    core.info("Looking for bob.config.js");
    const config = await useConfig();
    core.info("Checking affected packages");
    const { affected } = getAffectedPackages({
      config,
      ignored: config.ignore || []
    });

    core.info(
      [
        "Affected packages:",
        affected.map(name => ` - ${name}`).join("\n")
      ].join("\n")
    );

    core.setOutput("dirty", affected.length ? "true" : "false");
  } catch (error) {
    console.error(error);
    core.setFailed(error.message);
    core.setOutput("dirty", "true");
  }
}

run();
