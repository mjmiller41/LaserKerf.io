// clipper2-wasm@0.4.0 ships a broken `types` field: it points at
// dist/es/clipper2z.d.ts, which does not exist — the declarations actually live
// at dist/clipper2z.d.ts. Re-map the module's types here so the bare specifier
// type-checks. The runtime value still resolves normally via the package's
// main/module fields (UMD in Node, ESM in Vite).
declare module 'clipper2-wasm' {
  export * from 'clipper2-wasm/dist/clipper2z';
  import type { Clipper2ZFactoryFunction } from 'clipper2-wasm/dist/clipper2z';
  const factory: Clipper2ZFactoryFunction;
  export default factory;
}
