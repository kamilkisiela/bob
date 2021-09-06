import { rewriteExports } from "../src/utils/rewrite-exports";

test("basic exports", () => {
  expect(
    rewriteExports(
      {
        ".": {
          require: "./dist/index.js",
          import: "./dist/index.mjs",
        },

        "./*": {
          require: "./dist/index.js",
          import: "./dist/index.mjs",
        },
      },
      "dist"
    )
  ).toStrictEqual({
    ".": {
      require: "./index.js",
      import: "./index.mjs",
    },
    "./*": {
      require: "./*.js",
      import: "./*.mjs",
    },
    "./package.json": "./package.json",
  });
});

test("with custom exports", () => {
  expect(
    rewriteExports(
      {
        ".": {
          require: "./dist/index.js",
          import: "./dist/index.mjs",
        },
        "./*": {
          require: "./dist/index.js",
          import: "./dist/index.mjs",
        },
        "./utils": {
          require: "./dist/utils/index.js",
          import: "./dist/utils/index.mjs",
        },
      },
      "dist"
    )
  ).toStrictEqual({
    ".": {
      require: "./index.js",
      import: "./index.mjs",
    },
    "./*": {
      require: "./*.js",
      import: "./*.mjs",
    },
    "./utils": {
      require: "./utils/index.js",
      import: "./utils/index.mjs",
    },
    "./package.json": "./package.json",
  });
});
