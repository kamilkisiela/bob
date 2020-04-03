import { BobConfig } from "./../config";
export interface Package {
    location: string;
    dependencies: string[];
    dirty: boolean;
}
export declare type Packages = Record<string, Package>;
export declare const affectedCommand: import("../command").CommandFactory<{}, {
    command: string;
}>;
export declare function getAffectedPackages({ config, ignored }: {
    config: BobConfig;
    ignored: string[];
}): {
    affected: string[];
    packages: Record<string, Package>;
};
export declare function getPackages(ignored: string[]): Packages;
//# sourceMappingURL=affected.d.ts.map