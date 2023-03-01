import path from 'path';
import { execa } from 'execa';
import * as fse from 'fs-extra';
import { expect, it } from 'vitest';

const fixturesFolder = path.join(__dirname, '__fixtures__');
const binaryFolder = path.join(__dirname, '..', 'dist', 'index.js');

it('can bundle a simple project', async () => {
  await fse.remove(path.resolve(fixturesFolder, 'simple', 'dist'));
  const result = await execa('node', [binaryFolder, 'build'], {
    cwd: path.resolve(fixturesFolder, 'simple'),
  });
  expect(result.exitCode).toEqual(0);
  const baseDistPath = path.resolve(fixturesFolder, 'simple', 'dist');
  const indexJsFilePath = path.resolve(baseDistPath, 'cjs', 'index.js');
  const indexDtsFilePath = path.resolve(baseDistPath, 'typings', 'index.d.ts');
  const indexMjsFilePath = path.resolve(baseDistPath, 'esm', 'index.js');
  const packageJsonFilePath = path.resolve(baseDistPath, 'package.json');
  const readmeFilePath = path.resolve(baseDistPath, 'README.md');
  const fooFilePath = path.resolve(baseDistPath, 'foo.json');

  expect(await fse.readFile(indexJsFilePath, 'utf8')).toMatchInlineSnapshot(`
    "use strict";
    exports.__esModule = true;
    exports.someNumber = void 0;
    exports.someNumber = 1;
    exports["default"] = 'kek';
  `);
  expect(await fse.readFile(indexDtsFilePath, 'utf8')).toMatchInlineSnapshot(`
    export declare const someNumber = 1;
    declare const _default: "kek";
    export default _default;
  `);
  expect(await fse.readFile(indexMjsFilePath, 'utf8')).toMatchInlineSnapshot(`
    export var someNumber = 1;
    export default 'kek';
  `);
  expect(await fse.readFile(readmeFilePath, 'utf8')).toMatchInlineSnapshot('Hello!');
  expect(await fse.readFile(fooFilePath, 'utf8')).toMatchInlineSnapshot('{ "hi": 1 }');
  expect(await fse.readFile(packageJsonFilePath, 'utf8')).toMatchInlineSnapshot(`
    {
      "name": "simple",
      "main": "cjs/index.js",
      "module": "esm/index.js",
      "typings": "typings/index.d.ts",
      "typescript": {
        "definition": "typings/index.d.ts"
      },
      "type": "module",
      "exports": {
        ".": {
          "require": {
            "types": "./typings/index.d.cts",
            "default": "./cjs/index.js"
          },
          "import": {
            "types": "./typings/index.d.ts",
            "default": "./esm/index.js"
          },
          "default": {
            "types": "./typings/index.d.ts",
            "default": "./esm/index.js"
          }
        },
        "./*": {
          "require": {
            "types": "./typings/*.d.cts",
            "default": "./cjs/*.js"
          },
          "import": {
            "types": "./typings/*.d.ts",
            "default": "./esm/*.js"
          },
          "default": {
            "types": "./typings/*.d.ts",
            "default": "./esm/*.js"
          }
        },
        "./package.json": "./package.json",
        "./style.css": "./esm/style.css"
      }
    }
  `);
  await execa('node', [binaryFolder, 'check'], {
    cwd: path.resolve(fixturesFolder, 'simple'),
  });
});

it('can build a monorepo project', async () => {
  await fse.remove(path.resolve(fixturesFolder, 'simple-monorepo', 'a', 'dist'));
  await fse.remove(path.resolve(fixturesFolder, 'simple-monorepo', 'b', 'dist'));
  const result = await execa('node', [binaryFolder, 'build'], {
    cwd: path.resolve(fixturesFolder, 'simple-monorepo'),
  });
  expect(result.exitCode).toEqual(0);
  const baseDistAPath = path.resolve(fixturesFolder, 'simple-monorepo', 'packages', 'a', 'dist');
  const baseDistBPath = path.resolve(fixturesFolder, 'simple-monorepo', 'packages', 'b', 'dist');
  const baseDistCPath = path.resolve(fixturesFolder, 'simple-monorepo', 'packages', 'c', 'dist');
  // prettier-ignore
  const files = {
    a: {
      "cjs/index.js": path.resolve(baseDistAPath, "cjs", "index.js"),
      "typings/index.d.ts": path.resolve(baseDistAPath, "typings", "index.d.ts"),
      "esm/index.js": path.resolve(baseDistAPath, "esm", "index.js"),
      "package.json": path.resolve(baseDistAPath, "package.json"),
    },
    b: {
      "cjs/index.js": path.resolve(baseDistBPath, "cjs", "index.js"),
      "typings/index.d.ts": path.resolve(baseDistBPath, "typings", "index.d.ts"),
      "esm/index.js": path.resolve(baseDistBPath, "esm", "index.js"),
      "package.json": path.resolve(baseDistBPath, "package.json"),
    },
    c: {
      "cjs/index.js": path.resolve(baseDistCPath, "cjs", "index.js"),
      "esm/index.js": path.resolve(baseDistCPath, "esm", "index.js"),
      "typings/index.d.ts": path.resolve(baseDistCPath, "typings", "index.d.ts"),
      "package.json": path.resolve(baseDistCPath, "package.json"),
    },
  } as const;

  expect(await fse.readFile(files.a['cjs/index.js'], 'utf8')).toMatchInlineSnapshot(`
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.a = void 0;
    exports.a = 'WUP';
  `);
  expect(await fse.readFile(files.a['typings/index.d.ts'], 'utf8')).toMatchInlineSnapshot(
    'export declare const a = "WUP";',
  );
  expect(await fse.readFile(files.a['esm/index.js'], 'utf8')).toMatchInlineSnapshot(
    "export const a = 'WUP';",
  );
  expect(await fse.readFile(files.a['package.json'], 'utf8')).toMatchInlineSnapshot(`
      {
        "name": "a",
        "main": "cjs/index.js",
        "module": "esm/index.js",
        "typings": "typings/index.d.ts",
        "typescript": {
          "definition": "typings/index.d.ts"
        },
        "type": "module",
        "exports": {
          ".": {
            "require": {
              "types": "./typings/index.d.cts",
              "default": "./cjs/index.js"
            },
            "import": {
              "types": "./typings/index.d.ts",
              "default": "./esm/index.js"
            },
            "default": {
              "types": "./typings/index.d.ts",
              "default": "./esm/index.js"
            }
          },
          "./*": {
            "require": {
              "types": "./typings/*.d.cts",
              "default": "./cjs/*.js"
            },
            "import": {
              "types": "./typings/*.d.ts",
              "default": "./esm/*.js"
            },
            "default": {
              "types": "./typings/*.d.ts",
              "default": "./esm/*.js"
            }
          },
          "./package.json": "./package.json"
        }
      }
    `);

  expect(await fse.readFile(files.b['cjs/index.js'], 'utf8')).toMatchInlineSnapshot(`
    "use strict";
    var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = { enumerable: true, get: function() { return m[k]; } };
        }
        Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
    }));
    var __exportStar = (this && this.__exportStar) || function(m, exports) {
        for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.foo = exports.b = void 0;
    const foo_js_1 = require("./foo.js");
    __exportStar(require("./foo.js"), exports);
    exports.b = 'SUP' + foo_js_1.b;
    function foo() {
        return Promise.resolve().then(() => require('./foo.js'));
    }
    exports.foo = foo;
  `);
  expect(await fse.readFile(files.b['typings/index.d.ts'], 'utf8')).toMatchInlineSnapshot(`
    export * from './foo.js';
    export declare const b: string;
    export declare function foo(): Promise<typeof import("./foo.js")>;
  `);
  expect(await fse.readFile(files.b['esm/index.js'], 'utf8')).toMatchInlineSnapshot(`
    import { b as a } from './foo.js';
    export * from './foo.js';
    export const b = 'SUP' + a;
    export function foo() {
        return import('./foo.js');
    }
  `);
  expect(await fse.readFile(files.b['package.json'], 'utf8')).toMatchInlineSnapshot(`
      {
        "name": "b",
        "main": "cjs/index.js",
        "module": "esm/index.js",
        "typings": "typings/index.d.ts",
        "typescript": {
          "definition": "typings/index.d.ts"
        },
        "type": "module",
        "exports": {
          ".": {
            "require": {
              "types": "./typings/index.d.cts",
              "default": "./cjs/index.js"
            },
            "import": {
              "types": "./typings/index.d.ts",
              "default": "./esm/index.js"
            },
            "default": {
              "types": "./typings/index.d.ts",
              "default": "./esm/index.js"
            }
          },
          "./foo": {
            "require": {
              "types": "./typings/foo.d.cts",
              "default": "./cjs/foo.js"
            },
            "import": {
              "types": "./typings/foo.d.ts",
              "default": "./esm/foo.js"
            },
            "default": {
              "types": "./typings/foo.d.ts",
              "default": "./esm/foo.js"
            }
          },
          "./package.json": "./package.json"
        },
        "bin": {
          "bbb": "cjs/log-the-world.js"
        }
      }
    `);

  expect(await fse.readFile(files.c['cjs/index.js'], 'utf8')).toMatchInlineSnapshot('');
  expect(await fse.readFile(files.c['esm/index.js'], 'utf8')).toMatchInlineSnapshot('');
  expect(await fse.readFile(files.c['typings/index.d.ts'], 'utf8')).toMatchInlineSnapshot(`
    export type SomeType = 'type';
    export interface SomeInterface {
    }
  `);
  expect(await fse.readFile(files.c['package.json'], 'utf8')).toMatchInlineSnapshot(`
    {
      "name": "c",
      "main": "cjs/index.js",
      "module": "esm/index.js",
      "typings": "typings/index.d.ts",
      "typescript": {
        "definition": "typings/index.d.ts"
      },
      "exports": {
        ".": {
          "require": {
            "types": "./typings/index.d.cts",
            "default": "./cjs/index.js"
          },
          "import": {
            "types": "./typings/index.d.ts",
            "default": "./esm/index.js"
          },
          "default": {
            "types": "./typings/index.d.ts",
            "default": "./esm/index.js"
          }
        },
        "./package.json": "./package.json"
      }
    }
  `);

  await execa('node', [binaryFolder, 'check'], {
    cwd: path.resolve(fixturesFolder, 'simple-monorepo'),
  });
});

it('can build an esm only project', async () => {
  await fse.remove(path.resolve(fixturesFolder, 'simple-esm-only', 'dist'));
  const result = await execa('node', [binaryFolder, 'build'], {
    cwd: path.resolve(fixturesFolder, 'simple-esm-only'),
  });
  expect(result.exitCode).toEqual(0);

  const baseDistPath = path.resolve(fixturesFolder, 'simple-esm-only', 'dist');
  const packageJsonFilePath = path.resolve(baseDistPath, 'package.json');
  const indexJsFilePath = path.resolve(baseDistPath, 'esm', 'index.js');
  const indexDtsFilePath = path.resolve(baseDistPath, 'typings', 'index.d.ts');
  expect(await fse.readFile(packageJsonFilePath, 'utf8')).toMatchInlineSnapshot(`
    {
      "name": "simple-esm-only",
      "main": "esm/index.js",
      "module": "esm/index.js",
      "typings": "typings/index.d.ts",
      "typescript": {
        "definition": "typings/index.d.ts"
      },
      "type": "module",
      "exports": {
        ".": {
          "import": {
            "types": "./typings/index.d.ts",
            "default": "./esm/index.js"
          },
          "default": {
            "types": "./typings/index.d.ts",
            "default": "./esm/index.js"
          }
        },
        "./package.json": "./package.json"
      }
    }
  `);

  expect(await fse.readFile(indexJsFilePath, 'utf8')).toMatchInlineSnapshot(
    'export var someNumber = 1;',
  );
  expect(await fse.readFile(indexDtsFilePath, 'utf8')).toMatchInlineSnapshot(
    'export declare const someNumber = 1;',
  );
});

it('can build a types only project', async () => {
  await fse.remove(path.resolve(fixturesFolder, 'simple-types-only', 'dist'));
  const result = await execa('node', [binaryFolder, 'build'], {
    cwd: path.resolve(fixturesFolder, 'simple-types-only'),
  });
  expect(result.exitCode).toEqual(0);

  const baseDistPath = path.resolve(fixturesFolder, 'simple-types-only', 'dist');

  // types-only adjusted package.json
  const packageJsonFilePath = path.resolve(baseDistPath, 'package.json');
  expect(await fse.readFile(packageJsonFilePath, 'utf8')).toMatchInlineSnapshot(`
    {
      "name": "simple-types-only",
      "main": "cjs/index.js",
      "module": "esm/index.js",
      "typings": "typings/index.d.ts",
      "typescript": {
        "definition": "typings/index.d.ts"
      },
      "type": "module",
      "exports": {
        ".": {
          "require": {
            "types": "./typings/index.d.cts",
            "default": "./cjs/index.js"
          },
          "import": {
            "types": "./typings/index.d.ts",
            "default": "./esm/index.js"
          },
          "default": {
            "types": "./typings/index.d.ts",
            "default": "./esm/index.js"
          }
        },
        "./package.json": "./package.json"
      }
    }
  `);

  await expect(fse.readFile(path.resolve(baseDistPath, 'cjs', 'index.js'), 'utf8')).resolves
    .toMatchInlineSnapshot(`
    "use strict";
    exports.__esModule = true;
  `);
  await expect(
    fse.readFile(path.resolve(baseDistPath, 'esm', 'index.js'), 'utf8'),
  ).resolves.toMatchInlineSnapshot('');
  const indexDtsFilePath = path.resolve(baseDistPath, 'typings', 'index.d.ts');
  expect(await fse.readFile(indexDtsFilePath, 'utf8')).toMatchInlineSnapshot(`
    export type SomeType = 'type';
    export interface SomeInterface {
    }
  `);
});

it('can build a monorepo pnpm project', async () => {
  await fse.remove(path.resolve(fixturesFolder, 'simple-monorepo-pnpm', 'a', 'dist'));
  await fse.remove(path.resolve(fixturesFolder, 'simple-monorepo-pnpm', 'b', 'dist'));
  const result = await execa('node', [binaryFolder, 'build'], {
    cwd: path.resolve(fixturesFolder, 'simple-monorepo-pnpm'),
  });
  expect(result.exitCode).toEqual(0);
  const baseDistAPath = path.resolve(
    fixturesFolder,
    'simple-monorepo-pnpm',
    'packages',
    'a',
    'dist',
  );
  const baseDistBPath = path.resolve(
    fixturesFolder,
    'simple-monorepo-pnpm',
    'packages',
    'b',
    'dist',
  );
  const baseDistCPath = path.resolve(
    fixturesFolder,
    'simple-monorepo-pnpm',
    'packages',
    'c',
    'dist',
  );
  // prettier-ignore
  const files = {
    a: {
      "cjs/index.js": path.resolve(baseDistAPath, "cjs", "index.js"),
      "typings/index.d.ts": path.resolve(baseDistAPath, "typings", "index.d.ts"),
      "esm/index.js": path.resolve(baseDistAPath, "esm", "index.js"),
      "package.json": path.resolve(baseDistAPath, "package.json"),
    },
    b: {
      "cjs/index.js": path.resolve(baseDistBPath, "cjs", "index.js"),
      "typings/index.d.ts": path.resolve(baseDistBPath, "typings", "index.d.ts"),
      "esm/index.js": path.resolve(baseDistBPath, "esm", "index.js"),
      "package.json": path.resolve(baseDistBPath, "package.json"),
    },
    c: {
      "cjs/index.js": path.resolve(baseDistCPath, "cjs", "index.js"),
      "esm/index.js": path.resolve(baseDistCPath, "esm", "index.js"),
      "typings/index.d.ts": path.resolve(baseDistCPath, "typings", "index.d.ts"),
      "package.json": path.resolve(baseDistCPath, "package.json"),
    },
  } as const;

  expect(await fse.readFile(files.a['cjs/index.js'], 'utf8')).toMatchInlineSnapshot(`
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.a = void 0;
    exports.a = 'WUP';
  `);
  expect(await fse.readFile(files.a['typings/index.d.ts'], 'utf8')).toMatchInlineSnapshot(
    'export declare const a = "WUP";',
  );
  expect(await fse.readFile(files.a['esm/index.js'], 'utf8')).toMatchInlineSnapshot(
    "export const a = 'WUP';",
  );
  expect(await fse.readFile(files.a['package.json'], 'utf8')).toMatchInlineSnapshot(`
      {
        "name": "a",
        "main": "cjs/index.js",
        "module": "esm/index.js",
        "typings": "typings/index.d.ts",
        "typescript": {
          "definition": "typings/index.d.ts"
        },
        "type": "module",
        "exports": {
          ".": {
            "require": {
              "types": "./typings/index.d.cts",
              "default": "./cjs/index.js"
            },
            "import": {
              "types": "./typings/index.d.ts",
              "default": "./esm/index.js"
            },
            "default": {
              "types": "./typings/index.d.ts",
              "default": "./esm/index.js"
            }
          },
          "./*": {
            "require": {
              "types": "./typings/*.d.cts",
              "default": "./cjs/*.js"
            },
            "import": {
              "types": "./typings/*.d.ts",
              "default": "./esm/*.js"
            },
            "default": {
              "types": "./typings/*.d.ts",
              "default": "./esm/*.js"
            }
          },
          "./package.json": "./package.json"
        }
      }
    `);

  expect(await fse.readFile(files.b['cjs/index.js'], 'utf8')).toMatchInlineSnapshot(`
    "use strict";
    var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = { enumerable: true, get: function() { return m[k]; } };
        }
        Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
    }));
    var __exportStar = (this && this.__exportStar) || function(m, exports) {
        for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.foo = exports.b = void 0;
    const foo_js_1 = require("./foo.js");
    __exportStar(require("./foo.js"), exports);
    exports.b = 'SUP' + foo_js_1.b;
    function foo() {
        return Promise.resolve().then(() => require('./foo.js'));
    }
    exports.foo = foo;
  `);
  expect(await fse.readFile(files.b['typings/index.d.ts'], 'utf8')).toMatchInlineSnapshot(`
    export * from './foo.js';
    export declare const b: string;
    export declare function foo(): Promise<typeof import("./foo.js")>;
  `);
  expect(await fse.readFile(files.b['esm/index.js'], 'utf8')).toMatchInlineSnapshot(`
    import { b as a } from './foo.js';
    export * from './foo.js';
    export const b = 'SUP' + a;
    export function foo() {
        return import('./foo.js');
    }
  `);
  expect(await fse.readFile(files.b['package.json'], 'utf8')).toMatchInlineSnapshot(`
      {
        "name": "b",
        "main": "cjs/index.js",
        "module": "esm/index.js",
        "typings": "typings/index.d.ts",
        "typescript": {
          "definition": "typings/index.d.ts"
        },
        "type": "module",
        "exports": {
          ".": {
            "require": {
              "types": "./typings/index.d.cts",
              "default": "./cjs/index.js"
            },
            "import": {
              "types": "./typings/index.d.ts",
              "default": "./esm/index.js"
            },
            "default": {
              "types": "./typings/index.d.ts",
              "default": "./esm/index.js"
            }
          },
          "./foo": {
            "require": {
              "types": "./typings/foo.d.cts",
              "default": "./cjs/foo.js"
            },
            "import": {
              "types": "./typings/foo.d.ts",
              "default": "./esm/foo.js"
            },
            "default": {
              "types": "./typings/foo.d.ts",
              "default": "./esm/foo.js"
            }
          },
          "./package.json": "./package.json"
        },
        "bin": {
          "bbb": "cjs/log-the-world.js"
        }
      }
    `);

  expect(await fse.readFile(files.c['cjs/index.js'], 'utf8')).toMatchInlineSnapshot('');
  expect(await fse.readFile(files.c['esm/index.js'], 'utf8')).toMatchInlineSnapshot('');
  expect(await fse.readFile(files.c['typings/index.d.ts'], 'utf8')).toMatchInlineSnapshot(`
    export type SomeType = 'type';
    export interface SomeInterface {
    }
  `);
  expect(await fse.readFile(files.c['package.json'], 'utf8')).toMatchInlineSnapshot(`
    {
      "name": "c",
      "main": "cjs/index.js",
      "module": "esm/index.js",
      "typings": "typings/index.d.ts",
      "typescript": {
        "definition": "typings/index.d.ts"
      },
      "exports": {
        ".": {
          "require": {
            "types": "./typings/index.d.cts",
            "default": "./cjs/index.js"
          },
          "import": {
            "types": "./typings/index.d.ts",
            "default": "./esm/index.js"
          },
          "default": {
            "types": "./typings/index.d.ts",
            "default": "./esm/index.js"
          }
        },
        "./package.json": "./package.json"
      }
    }
  `);

  await execa('node', [binaryFolder, 'check'], {
    cwd: path.resolve(fixturesFolder, 'simple-monorepo-pnpm'),
  });
});

it('can bundle a tsconfig-build-json project', async () => {
  await fse.remove(path.resolve(fixturesFolder, 'tsconfig-build-json', 'dist'));

  const result = await execa('node', [binaryFolder, 'build'], {
    cwd: path.resolve(fixturesFolder, 'tsconfig-build-json'),
  });
  expect(result.exitCode).toEqual(0);

  const baseDistPath = path.resolve(fixturesFolder, 'tsconfig-build-json', 'dist');
  await expect(fse.readFile(path.resolve(baseDistPath, 'package.json'), 'utf8')).resolves
    .toMatchInlineSnapshot(`
    {
      "name": "tsconfig-build-json",
      "main": "cjs/index.js",
      "module": "esm/index.js",
      "typings": "typings/index.d.ts",
      "typescript": {
        "definition": "typings/index.d.ts"
      },
      "type": "module",
      "exports": {
        ".": {
          "require": {
            "types": "./typings/index.d.cts",
            "default": "./cjs/index.js"
          },
          "import": {
            "types": "./typings/index.d.ts",
            "default": "./esm/index.js"
          },
          "default": {
            "types": "./typings/index.d.ts",
            "default": "./esm/index.js"
          }
        },
        "./*": {
          "require": {
            "types": "./typings/*.d.cts",
            "default": "./cjs/*.js"
          },
          "import": {
            "types": "./typings/*.d.ts",
            "default": "./esm/*.js"
          },
          "default": {
            "types": "./typings/*.d.ts",
            "default": "./esm/*.js"
          }
        },
        "./package.json": "./package.json",
        "./style.css": "./esm/style.css"
      }
    }
  `);
  await expect(
    fse.readFile(path.resolve(baseDistPath, 'README.md'), 'utf8'),
  ).resolves.toMatchInlineSnapshot('Hello!');
  await expect(fse.readFile(path.resolve(baseDistPath, 'cjs', 'index.js'), 'utf8')).resolves
    .toMatchInlineSnapshot(`
    "use strict";
    exports.__esModule = true;
    exports.hello = void 0;
    exports.hello = 1;
    exports["default"] = 'there';
  `);
  await expect(fse.readFile(path.resolve(baseDistPath, 'esm', 'index.js'), 'utf8')).resolves
    .toMatchInlineSnapshot(`
    export var hello = 1;
    export default 'there';
  `);
  await expect(
    fse.stat(path.resolve(baseDistPath, 'typings', 'index.d.ts')),
  ).rejects.toMatchInlineSnapshot(
    "[Error: ENOENT: no such file or directory, stat '/Users/enisdenjo/Develop/src/github.com/kamilkisiela/bob/test/__fixtures__/tsconfig-build-json/dist/typings/index.d.ts']",
  );

  await execa('node', [binaryFolder, 'check'], {
    cwd: path.resolve(fixturesFolder, 'simple'),
  });
});
