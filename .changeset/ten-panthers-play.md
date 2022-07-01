---
"bob-the-bundler": major
---

Remove the global config. Please add `bob: false` to the individual `package.json` workspaces that should not be processed by bob.

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
