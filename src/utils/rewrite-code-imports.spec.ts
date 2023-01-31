import { rewriteCodeImports } from './rewrite-code-imports';
import path from 'path';
import { it, expect } from 'vitest';

const fixturePath = path.join(__dirname, '__fixtures__', 'index.ts');

it('ignores module import statement', () => {
  const fixture = "import foo from 'foo'";
  const result = rewriteCodeImports(fixture, fixturePath);
  expect(result).toEqual("import foo from 'foo'");
});

it('handles type statements', () => {
  const fixture = "import type foo from 'foo'";
  const result = rewriteCodeImports(fixture, fixturePath);
  expect(result).toEqual("import type foo from 'foo'");
});

it('rewrites relative import statement', () => {
  const fixture = "import foo from './bar'";
  const result = rewriteCodeImports(fixture, fixturePath);
  expect(result).toEqual(`import foo from './bar.js'`);
});

it('rewrites relative import statement for folder', () => {
  const fixture = "import foo from './foo'";
  const result = rewriteCodeImports(fixture, fixturePath);
  expect(result).toEqual(`import foo from './foo/index.js'`);
});

it('rewrites relative import statement', () => {
  const fixture = "import foo from '../foo'";
  const result = rewriteCodeImports(fixture, fixturePath);
  expect(result).toEqual(`import foo from '../foo.js'`);
});

it('ignores module export statement', () => {
  const fixture = "export {foo} from 'foo'";
  const result = rewriteCodeImports(fixture, fixturePath);
  expect(result).toEqual("export {foo} from 'foo'");
});

it('rewrites relative export statement', () => {
  const fixture = "export {foo} from './bar'";
  const result = rewriteCodeImports(fixture, fixturePath);
  expect(result).toEqual(`export {foo} from './bar.js'`);
});

it('rewrites relative export statement for folder', () => {
  const fixture = "export {foo} from './foo'";
  const result = rewriteCodeImports(fixture, fixturePath);
  expect(result).toEqual(`export {foo} from './foo/index.js'`);
});

it('complex example', () => {
  const fixture = `
import { GraphQLError } from '../../../error/GraphQLError';

import type { FieldNode } from '../../../language/ast';
import type { ASTVisitor } from '../../../language/visitor';

import { getNamedType } from '../../../type/definition';
import { isIntrospectionType } from '../../../type/introspection';

import type { ValidationContext } from '../../ValidationContext';
  `;
  const result = rewriteCodeImports(fixture, fixturePath);
  expect(result).toMatchInlineSnapshot(`
    import { GraphQLError } from '../../../error/GraphQLError.js';

    import type { FieldNode } from '../../../language/ast.js';
    import type { ASTVisitor } from '../../../language/visitor.js';

    import { getNamedType } from '../../../type/definition.js';
    import { isIntrospectionType } from '../../../type/introspection.js';

    import type { ValidationContext } from '../../ValidationContext.js';
  `);
});
