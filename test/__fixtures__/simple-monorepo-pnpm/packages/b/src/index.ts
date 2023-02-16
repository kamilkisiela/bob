import { b as a } from './foo.js';

export * from './foo.js';
export const b = 'SUP' + a;

export function foo() {
  return import('./foo.js');
}
