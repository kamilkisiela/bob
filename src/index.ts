#!/usr/bin/env node
import yargs, { Argv } from "yargs";
import consola from "consola";
import { useConfig } from "./config";
import { CommandFactory } from "./command";
import { buildCommand } from "./commands/build";
import { packFlatCommand } from "./commands/pack-flat";
import { runCommand } from "./commands/run";
import { validateCommand } from "./commands/validate";
import { runifyCommand } from "./commands/runify";
import { bootstrapCommand } from "./commands/bootstrap";

async function main() {
  const config = await useConfig();

  const root: Argv = yargs
    .scriptName("bob")
    .detectLocale(false)
    .version();

  const commands: CommandFactory<any, any>[] = [
    buildCommand,
    runCommand,
    validateCommand,
    packFlatCommand,
    runifyCommand,
    bootstrapCommand,
  ];

  const reporter = consola.create({});

  commands
    .reduce((cli, cmd) => cli.command(cmd({ config, reporter })), root)
    .help()
    .showHelpOnFail(false).argv;
}

main();
