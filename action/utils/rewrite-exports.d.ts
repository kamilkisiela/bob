export declare function rewriteExports(exports: Record<string, string | {
    require?: string | {
        [key: string]: string;
    };
    import?: string | {
        [key: string]: string;
    };
}>, distDir: string): {
    [x: string]: string | {
        require?: string | {
            [key: string]: string;
        } | undefined;
        import?: string | {
            [key: string]: string;
        } | undefined;
    };
};
//# sourceMappingURL=rewrite-exports.d.ts.map