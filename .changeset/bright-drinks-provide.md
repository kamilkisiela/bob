---
'bob-the-bundler': major
---

Drop "module" package.json field

The field was just a proposal and was never officially (and fully) defined by Node. Node instead uses (and recommends) the ["exports" field](https://nodejs.org/api/packages.html#exports).
