/**
 * `topojson-client` doesn't publish its own TypeScript types, and this
 * project deliberately isn't pulling in the separately-versioned
 * `@types/topojson-client` DefinitelyTyped package for the one function
 * it needs. This declares exactly that function — see
 * `loadWorldAtlas.ts`, the only file that imports it, for how the
 * (deliberately loosely-typed) return value is validated/shaped before
 * use.
 */
declare module 'topojson-client' {
  export function feature(topology: unknown, object: unknown): unknown
}
