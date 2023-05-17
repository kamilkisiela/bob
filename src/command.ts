import { type ConsolaInstance } from 'consola';
import { type CommandModule } from 'yargs';

export { CommandModule as Command };

export interface CommandAPI {
  reporter: ConsolaInstance;
}

export type CommandFactory<T = {}, U = {}> = (api: CommandAPI) => CommandModule<T, U>;

export function createCommand<T = {}, U = {}>(factory: CommandFactory<T, U>) {
  return factory;
}
