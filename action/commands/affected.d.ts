import { BobConfig } from "./../config";
interface Package {
    location: string;
    dependencies: string[];
    dirty: boolean;
}
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
export {};
//# sourceMappingURL=affected.d.ts.map