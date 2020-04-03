import * as core from "@actions/core";
import { useConfig } from "./config";
import { getAffectedPackages } from "./commands/affected";

async function run(): Promise<void> {
  try {
    core.debug("Running Bob...");

    const config = await useConfig();
    const { affected } = getAffectedPackages({
      config,
      ignored: config.ignore || []
    });

    core.setOutput("dirty", affected.length ? "true" : "false");
  } catch (error) {
    core.setFailed(error.message);
    core.setOutput("dirty", "true");
  }
}

run();
