#!/usr/bin/env node
import yargs, { Argv } from "yargs";
import consola from "consola";
import { CommandFactory } from "./command";
import { buildCommand } from "./commands/build";
import { runifyCommand } from "./commands/runify";
import { bootstrapCommand } from "./commands/bootstrap";
import { checkCommand } from "./commands/check";

async function main() {
  const root: Argv = yargs
    .scriptName("bob")
    .detectLocale(false)
    .version();

  const commands: CommandFactory<any, any>[] = [
    buildCommand,
    runifyCommand,
    bootstrapCommand,
    checkCommand,
  ];

  const reporter = consola.create({});

  commands
    .reduce((cli, cmd) => cli.command(cmd({ reporter })), root)
    .help()
    .showHelpOnFail(false).argv;
}

main();
