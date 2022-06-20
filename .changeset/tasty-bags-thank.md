---
"bob-the-bundler": minor
---

remove the `--single` flag. The value is now derived from the `package.json` `workspaces` property. If your workspace is configured properly this is not a breaking change.
