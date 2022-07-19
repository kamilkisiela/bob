import { rewriteCodeImports } from "./rewrite-code-imports";
import * as path from "path";

const fixturePath = path.join(__dirname, "__fixtures__", "index.ts");

it("ignores module import statement", () => {
  const fixture = "import foo from 'foo'";
  const result = rewriteCodeImports(fixture, fixturePath);
  expect(result).toEqual("import foo from 'foo';");
});

it("rewrites relative import statement", () => {
  const fixture = "import foo from './bar'";
  const result = rewriteCodeImports(fixture, fixturePath);
  expect(result).toEqual(`import foo from "./bar.js";`);
});

it("rewrites relative import statement for folder", () => {
  const fixture = "import foo from './foo'";
  const result = rewriteCodeImports(fixture, fixturePath);
  expect(result).toEqual(`import foo from "./foo/index.js";`);
});

it("rewrites relative import statement", () => {
  const fixture = "import foo from '../foo'";
  const result = rewriteCodeImports(fixture, fixturePath);
  expect(result).toEqual(`import foo from "../foo.js";`);
});

it("ignores module export statement", () => {
  const fixture = "export {foo} from 'foo'";
  const result = rewriteCodeImports(fixture, fixturePath);
  expect(result).toEqual("export { foo } from 'foo';");
});

it("rewrites relative export statement", () => {
  const fixture = "export {foo} from './bar'";
  const result = rewriteCodeImports(fixture, fixturePath);
  expect(result).toEqual(`export { foo } from "./bar.js";`);
});

it("rewrites relative export statement for folder", () => {
  const fixture = "export {foo} from './foo'";
  const result = rewriteCodeImports(fixture, fixturePath);
  expect(result).toEqual(`export { foo } from "./foo/index.js";`);
});
