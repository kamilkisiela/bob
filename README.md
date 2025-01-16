# Bob (The Compiler)

Bob is the TypeScript build, bundle and verification tool used by almost all
[The Guild](https://the-guild.dev) open source projects.

Scope:

- **Build**: Build ESM and CommonJS compatible npm packages
- **Verify**: Ensure all ESM and CommonJS imports within an npm package are usable

## Requirements

- Yarn workspace or single package project
- TypeScript
- It's so strict you shouldn't use it!

## Setup

Setting up bob is currently undocumented. You can check
[GraphQL Code Generator](https://github.com/dotansimha/graphql-code-generator) repository (or any
other The Guild repository).

## Configuration

You can add a `bob` key to each `package.json`.

**Disable bob for a single package**

```jsonc
{
  "name": "graphql-lfg",
  "bob": false // exclude a single package from all things bob related
}
```

**Disable build for a single package**

```json
{
  "name": "graphql-lfg",
  "bob": {
    "build": false
  }
}
```

**Disable check for a single package**

```json
{
  "name": "graphql-lfg",
  "bob": {
    "check": false
  }
}
```

**Disable check for a single export in a package**

```json
{
  "name": "graphql-lfg",
  "bob": {
    "check": {
      "skip": ["./foo"]
    }
  }
}
```

## Usage

```bash
$ bob build
$ bob check
```
