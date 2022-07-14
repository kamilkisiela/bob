---
"bob-the-bundler": patch
---

Run typescript tsc commands in sequence instead of in parallel to avoid race conditions where the `.bob/cjs` or `.bob/esm` folder is missing.
