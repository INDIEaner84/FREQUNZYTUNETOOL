declare module 'node:test' {
  export function describe(name: string, fn: () => void | Promise<void>): Promise<void>
  export function it(name: string, fn: () => void | Promise<void>): Promise<void>
}

declare module 'node:assert/strict' {
  export function ok(value: unknown, message?: string): asserts value
  export function equal<T>(actual: unknown, expected: T, message?: string): asserts actual is T
  export function deepEqual<T>(actual: unknown, expected: T, message?: string): asserts actual is T
  export function throws(fn: () => unknown, error?: RegExp | ErrorConstructor, message?: string): void
  export function rejects(
    promise: Promise<unknown> | (() => Promise<unknown>),
    error?: RegExp | ((err: unknown) => boolean),
    message?: string,
  ): Promise<void>
}

declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf8'): string
  export function readdirSync(
    path: string,
    options: { withFileTypes: true },
  ): Array<{ name: string; isDirectory(): boolean }>
}

declare module 'node:path' {
  export function join(...paths: string[]): string
  export function resolve(...paths: string[]): string
}
