export declare function rewriteExports(exports: Record<string, string | {
    require?: string;
    import?: string;
}>, distDir: string): {
    [x: string]: string | {
        require?: string | undefined;
        import?: string | undefined;
    };
};
//# sourceMappingURL=rewrite-exports.d.ts.map