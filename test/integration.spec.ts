import path from "path";
import execa from "execa";
import * as fse from "fs-extra";

const fixturesFolder = path.join(__dirname, "__fixtures__");
const binaryFolder = path.join(__dirname, "..", "dist", "index.js");

it("can bundle a simple project", async () => {
  await fse.remove(path.resolve(fixturesFolder, "simple", "dist"));
  const result = await execa("node", [binaryFolder, "build"], {
    cwd: path.resolve(fixturesFolder, "simple"),
  });
  expect(result.exitCode).toEqual(0);
  const indexJsFilePath = path.resolve(
    fixturesFolder,
    "simple",
    "dist",
    "index.js"
  );
  const indexMjsFilePath = path.resolve(
    fixturesFolder,
    "simple",
    "dist",
    "index.js"
  );
  const packageJsonFilePath = path.resolve(
    fixturesFolder,
    "simple",
    "dist",
    "package.json"
  );

  expect(fse.readFileSync(indexJsFilePath, "utf8")).toMatchInlineSnapshot(`
    "'use strict';

    Object.defineProperty(exports, '__esModule', { value: true });

    var someNumber = 1;

    exports.someNumber = someNumber;
    "
  `);
  expect(fse.readFileSync(indexMjsFilePath, "utf8")).toMatchInlineSnapshot(`
    "'use strict';

    Object.defineProperty(exports, '__esModule', { value: true });

    var someNumber = 1;

    exports.someNumber = someNumber;
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
          \\"require\\": \\"./index.js\\",
          \\"import\\": \\"./index.mjs\\"
        },
        \\"./*\\": {
          \\"require\\": \\"./*.js\\",
          \\"import\\": \\"./*.mjs\\"
        },
        \\"./package.json\\": \\"./package.json\\"
      }
    }
    "
  `);
});
