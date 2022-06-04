import { BobConfig } from "./../config";
export interface Package {
    location: string;
    dependencies: string[];
    dirty: boolean;
}
export declare type Packages = Record<string, Package>;
export declare const runCommand: import("../command").CommandFactory<{}, {
    command: string;
}>;
export declare function getAffectedPackages({ config, filterCommand, }: {
    config: BobConfig;
    filterCommand?: string;
}): {
    affected: string[];
    packages: Packages;
};
export declare function getPackages(ignored?: string[]): Packages;
//# sourceMappingURL=run.d.ts.map