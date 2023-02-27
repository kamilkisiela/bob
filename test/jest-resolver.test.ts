import { expect, it, test } from 'vitest';
import * as jestResolver from '../jest-resolver.cjs';

test('jest-resolver', () => {
  it('removes .js extension from relative paths', () => {
    const result = jestResolver('./foo.js', {
      basedir: __dirname,
      defaultResolver: path => path,
    });
    expect(result).toBe('./foo');
  });
  it('ignores absolute paths', () => {
    const result = jestResolver('/Users/username/project/foo', {
      basedir: __dirname,
      defaultResolver: path => path,
    });
    expect(result).toBe('/Users/username/project/foo');
  });
  it('ignores relative paths from node_modules', () => {
    const result = jestResolver('./foo', {
      basedir: '/Users/username/project/node_modules/foo',
      defaultResolver: path => path,
    });
    expect(result).toBe('./foo');
  });
  it('ignores non-js imports', () => {
    const result = jestResolver('./foo.graphql', {
      basedir: __dirname,
      defaultResolver: path => path,
    });
    expect(result).toBe('./foo.graphql');
  });
});
