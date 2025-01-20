---
'bob-the-bundler': major
---

"main" package.json field matches the location of "type" output

> The "type" field defines the module format that Node.js uses for all .js files that have that package.json file as their nearest parent.
>
> Files ending with .js are loaded as ES modules when the nearest parent package.json file contains a top-level field "type" with a value of "module".
>
> If the nearest parent package.json lacks a "type" field, or contains "type": "commonjs", .js files are treated as CommonJS. If the volume root is reached and no package.json is found, .js files are treated as CommonJS.

_[Node documentation](https://nodejs.org/api/packages.html#type)_
