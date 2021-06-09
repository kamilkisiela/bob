declare type CommandTuple = [string, string[]];
declare type Command = {
    track?: string[];
    run(affected: {
        names: string[];
        paths: string[];
    }): CommandTuple | Promise<CommandTuple>;
};
export interface BobConfig {
    scope: string;
    ignore?: string[];
    track?: string[];
    base?: string;
    commands?: {
        [cmdName: string]: Command;
    };
    dists?: {
        distDir: string;
        distPath?: string;
    }[];
}
interface UseConfigOptions {
    config?: string;
}
export declare function useConfig(options?: UseConfigOptions): Promise<BobConfig | never>;
export {};
