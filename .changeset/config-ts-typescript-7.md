---
"@vitavision/config-ts": minor
---

TypeScript 7. The `typescript` peer is now `^7.0.2` (it was `^6.0.3`); the compiler options are unchanged.

- **Declarations.** With TypeScript 7 installed, the `library()` tsdown preset emits `.d.ts` through the native compiler. tsdown logs that this path is experimental; the declarations it produced for the `@vitavision/*` packages are identical to TypeScript 6's. It reads the options from `tsconfig.json` and ignores `dts.compilerOptions` overrides.
- **To stay on TypeScript 6**, keep `@vitavision/config-ts` 0.1.
