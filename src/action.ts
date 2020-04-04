import * as core from "@actions/core";
import { resolve } from "path";
import { getAffectedPackages } from "./commands/run";

async function run(): Promise<void> {
  try {
    core.info("Running Bob...");

    core.info("Looking for bob.config.js");
    const config = require(resolve(
      process.env.GITHUB_WORKSPACE!,
      "bob.config.js"
    ));
    const filterCommand = core.getInput("command");

    if (filterCommand) {
      core.info(`Scoping to one command: ${filterCommand}`);
    }

    core.info("Checking affected packages");
    const { affected } = getAffectedPackages({
      config,
      filterCommand,
    });

    affected.forEach((name) => {
      core.info(`- ${name}`);
    });

    if (affected.length === 0) {
      core.info("No affected packages");
    }

    core.setOutput("dirty", affected.length > 0 ? "true" : "false");
  } catch (error) {
    console.error(error);
    core.setFailed(error.message);
    core.setOutput("dirty", "true");
  }
}

run();
