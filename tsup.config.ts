/**
 * Build: one ESM entry, bundled types, nothing from `dependencies` inlined.
 *
 * Radix, lucide-react, clsx and tailwind-merge stay external — they are ordinary
 * `dependencies`, resolved from the consumer's own `node_modules` at install time, not
 * duplicated into this package's bundle. `react` / `react-dom` / `react-router` are peers:
 * a duplicated React copy is how two instances of the same library end up with hooks that
 * do not talk to each other, and `react-router`'s `Link` needs the consumer's own router
 * context to mean anything.
 *
 * `styles.css` is deliberately not part of this build — see the `build` script in
 * `package.json`, which copies it into `dist/` unprocessed. It has to reach the consumer
 * as Tailwind v4 source (`@import "tailwindcss"`, `@theme inline { … }`), for *their* build
 * to compile against, not as CSS this package has already resolved.
 *
 * `dts` generation is deliberately **not** done here. tsup bundles declarations through
 * `rollup-plugin-dts`, which pins its own `typescript` internally and crashes against this
 * workspace's `typescript@^7` (`Cannot read properties of undefined
 * (reading 'useCaseSensitiveFileNames')` — TS7's native compiler does not present the
 * LanguageService shape that tool expects). The `build` script in `package.json` instead
 * runs `tsc --emitDeclarationOnly` against `tsconfig.build.json` as a second pass, which
 * exercises the same `tsc` the `typecheck` script already proves works.
 */

import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: false,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  target: "es2022",
  external: ["react", "react-dom", "react-router"],
});
