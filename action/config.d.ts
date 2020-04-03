export interface BobConfig {
    scope: string;
    ignore?: string[];
    track?: string[];
    against?: string;
    run?: {
        [cmdName: string]: (affected: {
            names: string[];
            paths: string[];
        }) => [string, string[]];
    };
}
interface UseConfigOptions {
    config?: string;
}
export declare function useConfig(options?: UseConfigOptions): Promise<BobConfig | never>;
export {};
