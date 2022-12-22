#!/usr/bin/env node
import yargs, { Argv } from 'yargs';
import { hideBin } from 'yargs/helpers';
import consola from 'consola';
import { CommandFactory } from './command.js';
import { buildCommand } from './commands/build.js';
import { runifyCommand } from './commands/runify.js';
import { bootstrapCommand } from './commands/bootstrap.js';
import { checkCommand } from './commands/check.js';

async function main() {
  const root: Argv = yargs(hideBin(process.argv)).scriptName('bob').detectLocale(false).version();

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
