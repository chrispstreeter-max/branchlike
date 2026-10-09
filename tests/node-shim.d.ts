// Minimal ambient types for Node's built-in test runner, so the project
// compiles with no installed @types packages.
declare module 'node:test' {
  type Fn = (t?: unknown) => void | Promise<void>;
  export function test(name: string, fn: Fn): void;
  export function describe(name: string, fn: () => void): void;
  export function it(name: string, fn: Fn): void;
}
declare module 'node:assert/strict' {
  interface Assert {
    (value: unknown, message?: string): asserts value;
    ok(value: unknown, message?: string): asserts value;
    equal(a: unknown, b: unknown, message?: string): void;
    notEqual(a: unknown, b: unknown, message?: string): void;
    deepEqual(a: unknown, b: unknown, message?: string): void;
    notDeepEqual(a: unknown, b: unknown, message?: string): void;
    throws(fn: () => unknown, message?: string): void;
  }
  const assert: Assert;
  export default assert;
}
