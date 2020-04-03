import { CommandModule } from "yargs";
import { BobConfig } from "./config";
import { Consola } from "consola";
export { CommandModule as Command };
export interface CommandAPI {
    config: BobConfig;
    reporter: Consola;
}
export declare type CommandFactory<T = {}, U = {}> = (api: CommandAPI) => CommandModule<T, U>;
export declare function createCommand<T = {}, U = {}>(factory: CommandFactory<T, U>): CommandFactory<T, U>;
