---
'bob-the-bundler': major
---

**Breaking** `jest-resolver.js` renamed to `jest-resolver.cjs` because Bob package is an ESM
package.

Please make sure to adjust your `jest.config.js`.

```diff
- resolver: 'bob-the-bundler/jest-resolver.js'
+ resolver: 'bob-the-bundler/jest-resolver.cjs'
```
