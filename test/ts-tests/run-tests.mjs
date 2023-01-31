import { execa } from 'execa';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run(commandStr) {
  const [command, ...args] = commandStr.split(' ');
  await execa(command, args);
}

async function main() {
  await run(`rm -rf ${__dirname}/node_modules`);
  await run(`mkdir -p ${__dirname}/node_modules`);
  await run(`ln -s ${__dirname}/../__fixtures__/simple/dist ${__dirname}/node_modules/simple`);

  await run(`yarn tsc --project ${__dirname}/tsconfig.esnext-node.json`);
  await run(`yarn tsc --project ${__dirname}/tsconfig.commonjs-node.json`);
  await run(`yarn tsc --project ${__dirname}/tsconfig.commonjs-node16.json`);
  await run(`yarn tsc --project ${__dirname}/tsconfig.commonjs-nodenext.json`);
  await run(`yarn tsc --project ${__dirname}/tsconfig.node16-node16.json`);
  await run(`yarn tsc --project ${__dirname}/tsconfig.nodenext-nodenext.json`);
}

main();
