import path from "path";
import execa from "execa";
import * as fse from "fs-extra";

jest.setTimeout(10_000);

const fixturesFolder = path.join(__dirname, "__fixtures__");
const binaryFolder = path.join(__dirname, "..", "dist", "index.js");

it("can bundle a simple project", async () => {
  await fse.remove(path.resolve(fixturesFolder, "simple", "dist"));
  const result = await execa("node", [binaryFolder, "build"], {
    cwd: path.resolve(fixturesFolder, "simple")
  });
  expect(result.exitCode).toEqual(0);
  const baseDistPath = path.resolve(fixturesFolder, "simple", "dist");
  const indexJsFilePath = path.resolve(baseDistPath, "_cjs", "index.js");
  const indexDtsFilePath = path.resolve(baseDistPath, "index.d.ts");
  const indexMjsFilePath = path.resolve(baseDistPath, "_esm", "index.js");
  const packageJsonFilePath = path.resolve(baseDistPath, "package.json");
  const readmeFilePath = path.resolve(baseDistPath, "README.md");
  const fooFilePath = path.resolve(baseDistPath, "foo.json");

  expect(fse.readFileSync(indexJsFilePath, "utf8")).toMatchInlineSnapshot(`
    "\\"use strict\\";
    exports.__esModule = true;
    exports.someNumber = void 0;
    exports.someNumber = 1;
    "
  `);
  expect(fse.readFileSync(indexDtsFilePath, "utf8")).toMatchInlineSnapshot(`
    "export declare const someNumber = 1;
    "
  `);
  expect(fse.readFileSync(indexMjsFilePath, "utf8")).toMatchInlineSnapshot(`
    "export var someNumber = 1;
    "
  `);
  expect(fse.readFileSync(readmeFilePath, "utf8")).toMatchInlineSnapshot(`
    "Hello!
    "
  `);
  expect(fse.readFileSync(fooFilePath, "utf8")).toMatchInlineSnapshot(`
    "{ \\"hi\\": 1 }
    "
  `);
  expect(fse.readFileSync(packageJsonFilePath, "utf8")).toMatchInlineSnapshot(`
    "{
      \\"name\\": \\"simple\\",
      \\"main\\": \\"_cjs/index.js\\",
      \\"module\\": \\"_esm/index.js\\",
      \\"typings\\": \\"index.d.ts\\",
      \\"typescript\\": {
        \\"definition\\": \\"index.d.ts\\"
      },
      \\"type\\": \\"module\\",
      \\"exports\\": {
        \\".\\": {
          \\"require\\": {
            \\"types\\": \\"./index.d.ts\\",
            \\"default\\": \\"./_cjs/index.js\\"
          },
          \\"import\\": {
            \\"types\\": \\"./index.d.ts\\",
            \\"default\\": \\"./_esm/index.js\\"
          },
          \\"default\\": {
            \\"types\\": \\"./index.d.ts\\",
            \\"default\\": \\"./_esm/index.js\\"
          }
        },
        \\"./*\\": {
          \\"require\\": {
            \\"types\\": \\"./*.d.ts\\",
            \\"default\\": \\"./_cjs/*.js\\"
          },
          \\"import\\": {
            \\"types\\": \\"./*.d.ts\\",
            \\"default\\": \\"./_esm/*.js\\"
          },
          \\"default\\": {
            \\"types\\": \\"./*.d.ts\\",
            \\"default\\": \\"./_esm/*.js\\"
          }
        },
        \\"./package.json\\": \\"./package.json\\",
        \\"./style.css\\": \\"./style.css\\"
      }
    }"
  `);
  await execa("node", [binaryFolder, "check"], {
    cwd: path.resolve(fixturesFolder, "simple")
  });
});

it("can build a monorepo project", async () => {
  await fse.remove(
    path.resolve(fixturesFolder, "simple-monorepo", "a", "dist")
  );
  await fse.remove(
    path.resolve(fixturesFolder, "simple-monorepo", "b", "dist")
  );
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
  // prettier-ignore
  const files = {
    a: {
      "_cjs/index.js": path.resolve(baseDistAPath, "_cjs", "index.js"),
      "index.d.ts": path.resolve(baseDistAPath, "index.d.ts"),
      "_esm/index.js": path.resolve(baseDistAPath, "_esm", "index.js"),
      "package.json": path.resolve(baseDistAPath, "package.json"),
    },
    b: {
      "_cjs/index.js": path.resolve(baseDistBPath, "_cjs", "index.js"),
      "index.d.ts": path.resolve(baseDistBPath, "index.d.ts"),
      "_esm/index.js": path.resolve(baseDistBPath, "_esm", "index.js"),
      "package.json": path.resolve(baseDistBPath, "package.json"),
    },
  } as const;

  expect(fse.readFileSync(files.a["_cjs/index.js"], "utf8"))
    .toMatchInlineSnapshot(`
    "\\"use strict\\";
    Object.defineProperty(exports, \\"__esModule\\", { value: true });
    exports.a = void 0;
    exports.a = \\"WUP\\";
    "
  `);
  expect(fse.readFileSync(files.a["index.d.ts"], "utf8"))
    .toMatchInlineSnapshot(`
    "export declare const a = \\"WUP\\";
    "
  `);
  expect(fse.readFileSync(files.a["_esm/index.js"], "utf8"))
    .toMatchInlineSnapshot(`
    "export const a = \\"WUP\\";
    "
  `);
  expect(fse.readFileSync(files.a["package.json"], "utf8"))
    .toMatchInlineSnapshot(`
    "{
      \\"name\\": \\"a\\",
      \\"main\\": \\"_cjs/index.js\\",
      \\"module\\": \\"_esm/index.js\\",
      \\"typings\\": \\"index.d.ts\\",
      \\"typescript\\": {
        \\"definition\\": \\"index.d.ts\\"
      },
      \\"type\\": \\"module\\",
      \\"exports\\": {
        \\".\\": {
          \\"require\\": {
            \\"types\\": \\"./index.d.ts\\",
            \\"default\\": \\"./_cjs/index.js\\"
          },
          \\"import\\": {
            \\"types\\": \\"./index.d.ts\\",
            \\"default\\": \\"./_esm/index.js\\"
          },
          \\"default\\": {
            \\"types\\": \\"./index.d.ts\\",
            \\"default\\": \\"./_esm/index.js\\"
          }
        },
        \\"./*\\": {
          \\"require\\": {
            \\"types\\": \\"./*.d.ts\\",
            \\"default\\": \\"./_cjs/*.js\\"
          },
          \\"import\\": {
            \\"types\\": \\"./*.d.ts\\",
            \\"default\\": \\"./_esm/*.js\\"
          },
          \\"default\\": {
            \\"types\\": \\"./*.d.ts\\",
            \\"default\\": \\"./_esm/*.js\\"
          }
        },
        \\"./package.json\\": \\"./package.json\\"
      }
    }"
  `);

  expect(fse.readFileSync(files.b["_cjs/index.js"], "utf8"))
    .toMatchInlineSnapshot(`
    "\\"use strict\\";
    var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || (\\"get\\" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = { enumerable: true, get: function() { return m[k]; } };
        }
        Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
    }));
    var __exportStar = (this && this.__exportStar) || function(m, exports) {
        for (var p in m) if (p !== \\"default\\" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
    };
    Object.defineProperty(exports, \\"__esModule\\", { value: true });
    exports.foo = exports.b = void 0;
    const foo_js_1 = require(\\"./foo.js\\");
    __exportStar(require(\\"./foo.js\\"), exports);
    exports.b = \\"SUP\\" + foo_js_1.b;
    function foo() {
        return Promise.resolve().then(() => require(\\"./foo.js\\"));
    }
    exports.foo = foo;
    "
  `);
  expect(fse.readFileSync(files.b["index.d.ts"], "utf8"))
    .toMatchInlineSnapshot(`
    "export * from \\"./foo.js\\";
    export declare const b: string;
    export declare function foo(): Promise<typeof import(\\"./foo.js\\")>;
    "
  `);
  expect(fse.readFileSync(files.b["_esm/index.js"], "utf8"))
    .toMatchInlineSnapshot(`
    "import { b as a } from \\"./foo.js\\";
    export * from \\"./foo.js\\";
    export const b = \\"SUP\\" + a;
    export function foo() {
        return import(\\"./foo.js\\");
    }
    "
  `);
  expect(fse.readFileSync(files.b["package.json"], "utf8"))
    .toMatchInlineSnapshot(`
    "{
      \\"name\\": \\"b\\",
      \\"main\\": \\"_cjs/index.js\\",
      \\"module\\": \\"_esm/index.js\\",
      \\"typings\\": \\"index.d.ts\\",
      \\"typescript\\": {
        \\"definition\\": \\"index.d.ts\\"
      },
      \\"type\\": \\"module\\",
      \\"exports\\": {
        \\".\\": {
          \\"require\\": {
            \\"types\\": \\"./index.d.ts\\",
            \\"default\\": \\"./_cjs/index.js\\"
          },
          \\"import\\": {
            \\"types\\": \\"./index.d.ts\\",
            \\"default\\": \\"./_esm/index.js\\"
          },
          \\"default\\": {
            \\"types\\": \\"./index.d.ts\\",
            \\"default\\": \\"./_esm/index.js\\"
          }
        },
        \\"./foo\\": {
          \\"require\\": {
            \\"types\\": \\"./foo.d.ts\\",
            \\"default\\": \\"./_cjs/foo.js\\"
          },
          \\"import\\": {
            \\"types\\": \\"./foo.d.ts\\",
            \\"default\\": \\"./_esm/foo.js\\"
          },
          \\"default\\": {
            \\"types\\": \\"./foo.d.ts\\",
            \\"default\\": \\"./_esm/foo.js\\"
          }
        },
        \\"./package.json\\": \\"./package.json\\"
      },
      \\"bin\\": {
        \\"bbb\\": \\"_cjs/log-the-world.js\\"
      }
    }"
  `);

  await execa("node", [binaryFolder, "check"], {
    cwd: path.resolve(fixturesFolder, "simple-monorepo")
  });
});

it("can build an esm only project", async () => {
  await fse.remove(path.resolve(fixturesFolder, "simple-esm-only", "dist"));
  const result = await execa("node", [binaryFolder, "build"], {
    cwd: path.resolve(fixturesFolder, "simple-esm-only")
  });
  expect(result.exitCode).toEqual(0);

  const baseDistPath = path.resolve(fixturesFolder, "simple-esm-only", "dist");
  const packageJsonFilePath = path.resolve(baseDistPath, "package.json");
  const indexJsFilePath = path.resolve(baseDistPath, "_esm", "index.js");
  const indexDtsFilePath = path.resolve(baseDistPath, "index.d.ts");
  expect(fse.readFileSync(packageJsonFilePath, "utf8")).toMatchInlineSnapshot(`
    "{
      \\"name\\": \\"simple-esm-only\\",
      \\"main\\": \\"_esm/index.js\\",
      \\"module\\": \\"_esm/index.js\\",
      \\"typings\\": \\"index.d.ts\\",
      \\"typescript\\": {
        \\"definition\\": \\"index.d.ts\\"
      },
      \\"type\\": \\"module\\",
      \\"exports\\": {
        \\".\\": {
          \\"import\\": {
            \\"types\\": \\"./index.d.ts\\",
            \\"default\\": \\"./_esm/index.js\\"
          },
          \\"default\\": {
            \\"types\\": \\"./index.d.ts\\",
            \\"default\\": \\"./_esm/index.js\\"
          }
        },
        \\"./package.json\\": \\"./package.json\\"
      }
    }"
  `);

  expect(fse.readFileSync(indexJsFilePath, "utf8")).toMatchInlineSnapshot(`
    "export var someNumber = 1;
    "
  `);
  expect(fse.readFileSync(indexDtsFilePath, "utf8")).toMatchInlineSnapshot(`
    "export declare const someNumber = 1;
    "
  `);
});
