import { CommandModule } from 'yargs';
import { Consola } from 'consola';

export { CommandModule as Command };

export interface CommandAPI {
  reporter: Consola;
}

export type CommandFactory<T = {}, U = {}> = (api: CommandAPI) => CommandModule<T, U>;

export function createCommand<T = {}, U = {}>(factory: CommandFactory<T, U>) {
  return factory;
}
