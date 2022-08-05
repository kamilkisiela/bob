---
"bob-the-bundler": major
---

Change the exports map again, to please TypeScript commonjs :)

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
