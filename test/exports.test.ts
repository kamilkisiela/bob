import { rewriteExports } from "../src/utils/rewrite-exports";

test("basic exports", () => {
  expect(
    rewriteExports(
      {
        ".": {
          require: {
            default: "./dist/index.js",
            types: "./dist/index.d.ts"
          },
          import: {
            default: "./dist/index.mjs",
            types: "./dist/index.d.ts",
          },
        },
        "./*": {
          require: {
            default: "./dist/*.js",
            types: "./dist/*.d.ts"
          },
          import: {
            default: "./dist/*.mjs",
            types: "./dist/*.d.ts"
          }
        },
      },
      "dist"
    )
  ).toStrictEqual({
    ".": {
      require: {
        default: "./index.js",
        types: "./index.d.ts"
      },
      import: {
        default: "./index.mjs",
        types: "./index.d.ts",
      },
    },
    "./*": {
      require: {
        default: "./*.js",
        types: "./*.d.ts"
      },
      import: {
        default: "./*.mjs",
        types: "./*.d.ts"
      }
    },
    "./package.json": "./package.json",
  });
});

test("with custom exports", () => {
  expect(
    rewriteExports(
      {
        ".": {
          require: {
            default: "./dist/index.js",
            types: "./dist/index.d.ts",
          },
          import: {
            default: "./dist/index.mjs",
            types: "./dist/index.d.ts",
          }
        },
        "./*": {
          require: {
            default: "./dist/*.js",
            types: "./dist/*.d.ts",
          },
          import: {
            default: "./dist/*.mjs",
            types: "./dist/*.d.ts",
          }
        },
        "./utils": {
          require: {
            default: "./dist/utils/index.js",
            types: "./dist/utils/index.d.ts"
          },
          import: {
            default: "./dist/utils/index.mjs",
            types: "./dist/utils/index.d.ts"
          }
        },
      },
      "dist"
    )
  ).toStrictEqual({
    ".": {
      require: {
        default: "./index.js",
        types: "./index.d.ts"
      },
      import: {
        default: "./index.mjs",
        types: "./index.d.ts"
      }
    },
    "./*": {
      require: {
        default: "./*.js",
        types: "./*.d.ts"
      },
      import: {
        default: "./*.mjs",
        types: "./*.d.ts"
      }
    },
    "./utils": {
      require: {
        default: "./utils/index.js",
        types: "./utils/index.d.ts",
      },
      import: {
        default: "./utils/index.mjs",
        types: "./utils/index.d.ts",
      }
    },
    "./package.json": "./package.json",
  });
});
