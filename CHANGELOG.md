# Changelog

## 4.1.1

### Patch Changes

- [#151](https://github.com/kamilkisiela/bob/pull/151)
  [`4695d0b`](https://github.com/kamilkisiela/bob/commit/4695d0b4f1bf849d87f626f97445b9b9b5bb9cba)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - dependencies updates:

  - Updated dependency [`tsup@^6.5.0` ↗︎](https://www.npmjs.com/package/tsup/v/6.5.0) (from
    `^5.11.6`, in `dependencies`)

- [#151](https://github.com/kamilkisiela/bob/pull/151)
  [`4695d0b`](https://github.com/kamilkisiela/bob/commit/4695d0b4f1bf849d87f626f97445b9b9b5bb9cba)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Support TypeScript 4.9 and satisfies
  operator

## 4.1.0

### Minor Changes

- [#123](https://github.com/kamilkisiela/bob/pull/123)
  [`b68da59`](https://github.com/kamilkisiela/bob/commit/b68da59ef41d4d66b9c4ec5d7da1a3550b5b58b7)
  Thanks [@enisdenjo](https://github.com/enisdenjo)! - better performance by incrementally building
  only packages that had changes

### Patch Changes

- [#129](https://github.com/kamilkisiela/bob/pull/129)
  [`cd16844`](https://github.com/kamilkisiela/bob/commit/cd16844210db99a3e74fa95c3311fb644ad48594)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:

  - Updated dependency
    [`rollup-plugin-typescript2@^0.33.0` ↗︎](https://www.npmjs.com/package/rollup-plugin-typescript2/v/null)
    (from `^0.32.1`, in `dependencies`)

- [#144](https://github.com/kamilkisiela/bob/pull/144)
  [`76fd23c`](https://github.com/kamilkisiela/bob/commit/76fd23c0f0887a8e324a92b0cff705214e1883bc)
  Thanks [@enisdenjo](https://github.com/enisdenjo)! - Correct package.json for types-only packages

## 4.0.0

### Major Changes

- f685733: Change the exports map again, to please TypeScript commonjs :)

  This is a major breaking change as it requires adjusting your `package.json` exports map.

  The `require` entries file extension must be changed from `.d.ts` to `.d.cts`.

  ```diff
    {
      "exports": {
        ".": {
          "require": {
  -          "types": "./dist/typings/index.d.ts",
  +          "types": "./dist/typings/index.d.cts"
          }
        }
      }
    }
  ```

### Minor Changes

- 14fa965: Disable commonjs output via package.json

  ```json
  {
    "name": "my-package",
    "bob": {
      "commonjs": false
    }
  }
  ```

- b8db426: Ignore `__tests__` and `__testUtils__` from bundling

## 3.0.5

### Patch Changes

- 16952de: Use correct path for checking file existence in exports map.

## 3.0.4

### Patch Changes

- e096322: Replace babel based export/import source location transform with an improved regex based
  transform that reduces code change noise and preserves the original formatting.

## 3.0.3

### Patch Changes

- 0c36290: Support type imports/exports.

## 3.0.2

### Patch Changes

- b6976a9: Use a more reliable import/export transform for the bootstrap command

## 3.0.1

### Patch Changes

- 086c1a8: Run typescript tsc commands in sequence instead of in parallel to avoid race conditions
  where the `.bob/cjs` or `.bob/esm` folder is missing.

## 3.0.0

### Major Changes

- 0f3f9ac: Remove the `flat-pack`, `validate` and `run` commands that are no longer maintained and
  used.
- 1605028: Remove the global config. Please add `bob: false` to the individual `package.json`
  workspaces that should not be processed by bob.

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
              copy?: Array<string>
            }
        /** Whether the package should be checked. */
        check?:
          | false
          | {
              /** Exports within the package that should not be checked. */
              skip?: Array<string>
            }
      }
  ```

## 2.0.0

### Major Changes

- ae0b4b2: Require specifying typescript fields in the package.json exports map for typescript
  modules support. Learn more on the
  [TypeScript 4.7 release notes](https://devblogs.microsoft.com/typescript/announcing-typescript-4-7/#package-json-exports-imports-and-self-referencing).

### Minor Changes

- 0942e1c: unpin and update dependencies
- 59ead17: remove the `--single` flag. The value is now derived from the `package.json` `workspaces`
  property. If your workspace is configured properly this is not a breaking change.

## v1.7.3

- Run `next start` directly from nextjs's lib, not CLI code.

## v1.7.2

- Do not add `require` automatically (breaking but we use it only internally)
- Introduce `banner` to add a banner to the generated files (runify + tsup only)

## v1.7.1

- Adds `require` to ESM output (runify with tsup enabled)

## v1.7.0

- Detect `"type": "module"` in `runify` command to decide on ESM vs CJS output (works only with TSUP
  enabled).
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

- added `runify` command to produce stanalone (node_modules included) bundles and to make them
  executable with `node index.js` (supports NextJS)

## 1.2.1

...
