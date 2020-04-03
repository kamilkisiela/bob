#!/usr/bin/env node
import yargs, { Argv } from "yargs";
import consola from "consola";
import { useConfig } from "./config";
import { CommandFactory } from "./command";
import { buildCommand } from "./commands/build";
import { prepackCommand } from "./commands/prepack";
import { affectedCommand } from "./commands/affected";

async function main() {
  const config = await useConfig();

  const root: Argv = yargs
    .scriptName("bob")
    .detectLocale(false)
    .version();

  const commands: CommandFactory<any, any>[] = [
    buildCommand,
    prepackCommand,
    affectedCommand
  ];

  const reporter = consola.create({});

  commands
    .reduce((cli, cmd) => cli.command(cmd({ config, reporter })), root)
    .help()
    .showHelpOnFail(false).argv;
}

main();
