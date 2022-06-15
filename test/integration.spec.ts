import path from "path";
import execa from "execa";
import * as fse from "fs-extra";

const fixturesFolder = path.join(__dirname, "__fixtures__");
const binaryFolder = path.join(__dirname, "..", "dist", "index.js");

it("can bundle a simple project", async () => {
  await fse.remove(path.resolve(fixturesFolder, "simple", "dist"));
  const result = await execa("node", [binaryFolder, "build"], {
    cwd: path.resolve(fixturesFolder, "simple")
  });
  expect(result.exitCode).toEqual(0);
  const baseDistPath = path.resolve(fixturesFolder, "simple", "dist");
  const indexJsFilePath = path.resolve(baseDistPath, "index.js");
  const indexMjsFilePath = path.resolve(baseDistPath, "index.mjs");
  const packageJsonFilePath = path.resolve(baseDistPath, "package.json");

  expect(fse.readFileSync(indexJsFilePath, "utf8")).toMatchInlineSnapshot(`
    "'use strict';

    Object.defineProperty(exports, '__esModule', { value: true });

    var someNumber = 1;

    exports.someNumber = someNumber;
    "
  `);
  expect(fse.readFileSync(indexMjsFilePath, "utf8")).toMatchInlineSnapshot(`
    "var someNumber = 1;

    export { someNumber };
    "
  `);
  expect(fse.readFileSync(packageJsonFilePath, "utf8")).toMatchInlineSnapshot(`
    "{
      \\"name\\": \\"simple\\",
      \\"main\\": \\"index.js\\",
      \\"module\\": \\"index.mjs\\",
      \\"typings\\": \\"index.d.ts\\",
      \\"typescript\\": {
        \\"definition\\": \\"index.d.ts\\"
      },
      \\"exports\\": {
        \\".\\": {
          \\"require\\": {
            \\"default\\": \\"./index.js\\",
            \\"types\\": \\"./index.d.ts\\"
          },
          \\"import\\": {
            \\"default\\": \\"./index.mjs\\",
            \\"types\\": \\"./index.d.ts\\"
          }
        },
        \\"./*\\": {
          \\"require\\": {
            \\"default\\": \\"./*.js\\",
            \\"types\\": \\"./*.d.ts\\"
          },
          \\"import\\": {
            \\"default\\": \\"./*.mjs\\",
            \\"types\\": \\"./*.d.ts\\"
          }
        },
        \\"./package.json\\": \\"./package.json\\"
      }
    }
    "
  `);
});

it("can build a monorepo project", async () => {
  await fse.remove(
    path.resolve(fixturesFolder, "simple-monorepo", "a", "dist")
  );
  await fse.remove(
    path.resolve(fixturesFolder, "simple-monorepo", "b", "dist")
  );
  await execa("tsc", {
    cwd: path.resolve(fixturesFolder, "simple-monorepo")
  });
  const result = await execa("node", [binaryFolder, "build"], {
    cwd: path.resolve(fixturesFolder, "simple-monorepo")
  });
  expect(result.exitCode).toEqual(0);
  const baseDistAPath = path.resolve(
    fixturesFolder,
    "simple-monorepo",
    "packages",
    "a",
    "dist"
  );
  const baseDistBPath = path.resolve(
    fixturesFolder,
    "simple-monorepo",
    "packages",
    "b",
    "dist"
  );
  const files = {
    a: {
      "index.js": path.resolve(baseDistAPath, "index.js"),
      "index.mjs": path.resolve(baseDistAPath, "index.mjs"),
      "package.json": path.resolve(baseDistAPath, "package.json")
    },
    b: {
      "index.js": path.resolve(baseDistBPath, "index.js"),
      "index.mjs": path.resolve(baseDistBPath, "index.mjs"),
      "package.json": path.resolve(baseDistBPath, "package.json")
    }
  };

  expect(fse.readFileSync(files.a["index.js"], "utf8")).toMatchInlineSnapshot(`
    "'use strict';

    Object.defineProperty(exports, '__esModule', { value: true });

    const a = \\"WUP\\";

    exports.a = a;
    "
  `);
  expect(fse.readFileSync(files.a["index.mjs"], "utf8")).toMatchInlineSnapshot(`
    "const a = \\"WUP\\";

    export { a };
    "
  `);
  expect(fse.readFileSync(files.a["package.json"], "utf8"))
    .toMatchInlineSnapshot(`
    "{
      \\"name\\": \\"a\\",
      \\"main\\": \\"index.js\\",
      \\"module\\": \\"index.mjs\\",
      \\"typings\\": \\"index.d.ts\\",
      \\"typescript\\": {
        \\"definition\\": \\"index.d.ts\\"
      },
      \\"exports\\": {
        \\".\\": {
          \\"require\\": {
            \\"default\\": \\"./index.js\\",
            \\"types\\": \\"./index.d.ts\\"
          },
          \\"import\\": {
            \\"default\\": \\"./index.mjs\\",
            \\"types\\": \\"./index.d.ts\\"
          }
        },
        \\"./*\\": {
          \\"require\\": {
            \\"default\\": \\"./*.js\\",
            \\"types\\": \\"./*.d.ts\\"
          },
          \\"import\\": {
            \\"default\\": \\"./*.mjs\\",
            \\"types\\": \\"./*.d.ts\\"
          }
        },
        \\"./package.json\\": \\"./package.json\\"
      }
    }
    "
  `);

  expect(fse.readFileSync(files.b["index.js"], "utf8")).toMatchInlineSnapshot(`
    "'use strict';

    Object.defineProperty(exports, '__esModule', { value: true });

    const b = \\"SUP\\";

    exports.b = b;
    "
  `);
  expect(fse.readFileSync(files.b["index.mjs"], "utf8")).toMatchInlineSnapshot(`
    "const b = \\"SUP\\";

    export { b };
    "
  `);
  expect(fse.readFileSync(files.b["package.json"], "utf8"))
    .toMatchInlineSnapshot(`
    "{
      \\"name\\": \\"b\\",
      \\"main\\": \\"index.js\\",
      \\"module\\": \\"index.mjs\\",
      \\"typings\\": \\"index.d.ts\\",
      \\"typescript\\": {
        \\"definition\\": \\"index.d.ts\\"
      },
      \\"exports\\": {
        \\".\\": {
          \\"require\\": {
            \\"default\\": \\"./index.js\\",
            \\"types\\": \\"./index.d.ts\\"
          },
          \\"import\\": {
            \\"default\\": \\"./index.mjs\\",
            \\"types\\": \\"./index.d.ts\\"
          }
        },
        \\"./*\\": {
          \\"require\\": {
            \\"default\\": \\"./*.js\\",
            \\"types\\": \\"./*.d.ts\\"
          },
          \\"import\\": {
            \\"default\\": \\"./*.mjs\\",
            \\"types\\": \\"./*.d.ts\\"
          }
        },
        \\"./package.json\\": \\"./package.json\\"
      }
    }
    "
  `);
});
