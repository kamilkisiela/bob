import { Packages } from "./affected";
export declare const validateCommand: import("../command").CommandFactory<{}, {}>;
declare type OnError = (err: Error) => void;
export declare function validateGitIngore(onError: OnError): Promise<void>;
export declare function validateRootTSConfig(onError: OnError, packages: Packages): Promise<void>;
export declare function validatePackage({ name, packages, onError, }: {
    name: string;
    packages: Packages;
    onError: OnError;
}): Promise<void>;
export {};
//# sourceMappingURL=validate.d.ts.map