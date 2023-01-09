module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
  },
  overrides: [
    {
      files: 'src/**/*.ts',
      excludedFiles: ['*.spec.ts'],
      plugins: ['import'],
      rules: {
        'import/extensions': ['error', 'ignorePackages'],
      },
    },
  ],
};
