# Changelog

## 3.0.1

### Patch Changes

- 086c1a8: Run typescript tsc commands in sequence instead of in parallel to avoid race conditions where the `.bob/cjs` or `.bob/esm` folder is missing.

## 3.0.0

### Major Changes

- 0f3f9ac: Remove the `flat-pack`, `validate` and `run` commands that are no longer maintained and used.
- 1605028: Remove the global config. Please add `bob: false` to the individual `package.json` workspaces that should not be processed by bob.

  This is the new config format for bob.

  ```ts
  type BobConfig =
    /** completely disable bob for this package. */
    | false
    | {
        /** Whether the package should be built. */
        build?:
          | false
          | {
              /** Files to copy from the package root to dist */
              copy?: Array<string>;
            };
        /** Whether the package should be checked. */
        check?:
          | false
          | {
              /** Exports within the package that should not be checked. */
              skip?: Array<string>;
            };
      };
  ```

## 2.0.0

### Major Changes

- ae0b4b2: Require specifying typescript fields in the package.json exports map for typescript modules support.
  Learn more on the [TypeScript 4.7 release notes](https://devblogs.microsoft.com/typescript/announcing-typescript-4-7/#package-json-exports-imports-and-self-referencing).

### Minor Changes

- 0942e1c: unpin and update dependencies
- 59ead17: remove the `--single` flag. The value is now derived from the `package.json` `workspaces` property. If your workspace is configured properly this is not a breaking change.

## v1.7.3

- Run `next start` directly from nextjs's lib, not CLI code.

## v1.7.2

- Do not add `require` automatically (breaking but we use it only internally)
- Introduce `banner` to add a banner to the generated files (runify + tsup only)

## v1.7.1

- Adds `require` to ESM output (runify with tsup enabled)

## v1.7.0

- Detect `"type": "module"` in `runify` command to decide on ESM vs CJS output (works only with TSUP enabled).
- Keep the original value of `type` when rewriting `package.json` (runify command)

## v1.6.2

- Make config optional

## v1.6.1

- Do not copy `.next/cache/webpack`

## v1.6.0

- Support tsup in `runify` command
- Introduce `tag` for `runify` command
- Support `--single` run for `runify` command

## 1.4.1 - 1.6.0

- a lot of good things

## v1.4.1

- fix typo `.msj` (should be `.mjs`)

## v1.4.0

- Support multiple dist configurations and ESM [#13](https://github.com/kamilkisiela/bob/pull/13)

## v1.3.0

- added `runify` command to produce stanalone (node_modules included) bundles and to make them executable with `node index.js` (supports NextJS)

## 1.2.1

...
