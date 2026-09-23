export declare const environments: readonly ["local", "staging", "production"];
export type TargetEnvironment = (typeof environments)[number];
export type EnvTemplate = {
    header: string[];
    keys: string[];
    templateValues: Record<string, string>;
};
export type MergeResult = {
    path: string;
    created: boolean;
    updated: boolean;
    keysAdded: string[];
};
export declare function projectRoot(): string;
export declare function readTargetEnvironment(argv?: readonly string[]): TargetEnvironment | undefined;
export declare function readTargetEnvironments(argv?: readonly string[]): TargetEnvironment[];
export declare function devVarsExamplePath(): string;
export declare function devVarsPath(environment: TargetEnvironment): string;
export declare function envExamplePath(): string;
export declare function envPath(environment: TargetEnvironment): string;
export declare function parseEnvTemplate(filePath: string): EnvTemplate;
export declare function readEnvValues(filePath: string): Record<string, string>;
export declare function mergeEnvFile(templatePath: string, targetPath: string, defaults?: Record<string, string>): MergeResult;
export declare function formatEnvAssignment(key: string, value: string): string;
export declare function setEnvValue(targetPath: string, key: string, value: string): void;
//# sourceMappingURL=env-files.d.ts.map