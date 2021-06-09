# Bob (The Bundler)

There's no documentation yet but you can check [GraphQL Code Generator](https://github.com/dotansimha/graphql-code-generator) repository to see how to use Bob.

## Requirements

- Supports only scoped packages (same scope)
- Yarn Workspaces
- TypeScript with Paths
- It's so strict you shouldn't use it!

## Configuration

Bob only accepts `bob.config.js` in root directory:

```js
module.exports = {
  scope: "@graphql-codegen", // Scope of organization
  ignore: ["@graphql-codegen/website", "@graphql-codegen/live-demo"], // ignored packages
  track: [
    // files in root that mark the entire workspace as dirty
    "bob.config.js", // we could include it in Bob itself but we decided to turn your life into hell :)
    "jest.config.js",
    "jest-project.js",
    "package.json",
    "tsconfig.json",
    // files in packages that mark the package as dirty
    "<project>/src/**",
    "<project>/jest.config.js",
    "<project>/package.json",
    "<project>/tsconfig.json",
  ],
  base: "origin/master", // we need to compare against something
  commands: {
    test: {
      track: ["<project>/tests/**"],
      run(affected) {
        // {
        //   paths: string[] <- ['packages/core', 'packages/cli']
        //   names: string[] <- ['@foo/core', '@foo/cli']
        // }

        // why such a weird syntax? We use spawn, so you have too
        return [`yarn`, ["test", ...affected.paths]];
      },
    },
    build: {
      run() {
        return [`yarn`, ["build"]];
      },
    },
  },
};
```

## Build Options

In your `<project>/package.json`:

```json
{
  "buildOptions": {
    "external": ["simple-git/promise"], // Marks nested imports as external
    "bin": {
      "cli": {
        "input": "src/cli.ts" // Entry point for `cli` command
      }
    }
  }
}
```

## Support for Node ES Modules

In your `<project>/package.json`, just add `"exports"` like this:

```json
{
  "main": "dist/index.cjs.js",
  "exports": {
    "require": "dist/index.cjs.js", // should match "main"
    "default": "dist/index.mjs" // should ends with ".mjs" extension
  }
}
```

## Usage

```bash

$ bob affected test
$ bob affected build

$ bob build
$ bob prepack

$ bob runify

```
