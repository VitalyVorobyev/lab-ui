# L2-2: calib-targets-rs `studio/` and `demo/` on the toolchain baseline

calib-targets-rs's two React frontends moved to the §3 baseline and to `@vitavision/config-ts` and `@vitavision/config-eslint`, with no UI change.

- **Measured:** 2026-09-26, macOS / Apple M-series, Chromium from Playwright 1.63.
- **calib-targets-rs:** PR [#103](https://github.com/VitalyVorobyev/calib-targets-rs/pull/103), merged as `2769406`.
  - `561a16a` adds both screenshot suites; the baselines were captured on it.
  - `b2ead8a` is the upgrade; the comparison ran on it.
  - `065400a` declares `rollup` for the demo (see Notes).

## Done-when (PLAN L2)

| Criterion | studio | demo |
|---|---|---|
| typecheck (`tsc -b`) | ✅ 19 places fixed (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) | ✅ 1 place fixed |
| lint, 0 errors | ✅ new, and a new CI job | ✅ new, in the WASM CI job |
| unit tests | none exist | none exist |
| e2e | ✅ new screenshot suite | ✅ new screenshot suite |
| L0-2, 0 undocumented deviations | ✅ | ✅ |
| Screenshots, `maxDiffPixelRatio` ≤ 0.001 against the pre-upgrade baseline | ✅ 7 / 7 | ✅ 9 / 9 |
| Bundle delta | +25.0 kB (+7.3 gzip) | +29.0 kB (+8.6 gzip) |

## Screenshot suites

`bun run test:screens` in each app.

- **demo:** each bundled sample after Detect (six), the initial screen, the Generate tab, and a generated target. The measured detection time is masked.
- **studio:** the studio server in `--dev` mode. It captures the dataset browser, compare, runs, and the image workspace with its four tabs, all on the public `testdata/mid.png`.
- **Determinism:** both suites matched on a repeat run before the change.
- **Baselines stay local:** the studio's dataset browser lists private manifest entries, and calib-targets-rs keeps anything derived from them off public surfaces.

## Bundle (`vite build`)

| Chunk | Before | After | Δ |
|---|---|---|---|
| studio `index` | 324.70 kB (99.23 gzip) | 349.74 kB (106.52 gzip) | +25.0 kB (+7.3 gzip) |
| demo `index` | 228.09 kB (71.26 gzip) | 257.13 kB (79.83 gzip) | +29.0 kB (+8.6 gzip) |
| demo WASM, CSS | unchanged | | |

The studio's growth comes mostly from react-router 8, which replaced react-router-dom 7. The demo's comes from react 19.3.

## Notes

- **TypeScript 6 and single-file checks.** TypeScript 6 refuses a file list while a `tsconfig.json` is present (TS5112). CI's two single-file declaration checks now pass `--ignoreConfig`. The same applies to any repo that runs `tsc <file>` next to a tsconfig.
- **The demo's `any`.** Its detection results were typed `any`; they now use the declarations the WASM package already ships.
- **`vite-plugin-top-level-await` requires `rollup` without declaring it.** Vite 8.0 brought rollup along and Vite 8.3 does not, so a clean install could not load the demo's `vite.config.ts`. CI caught it; my local `node_modules` still had the old copy. The demo now declares `rollup`, as it already declared `esbuild` for the same plugin. The screenshots matched again against a freshly built WASM package.
- **`vite-plugin-wasm`** reads as `any` under bun's isolated install, because its declarations name a `vite` they cannot resolve. It is cast once in `vite.config.ts`.

## Exceptions carried into L3

- **React Compiler rules.** `react-hooks/refs`, `react-hooks/immutability` and `react-hooks/set-state-in-effect` are warnings in both apps.
- **G5.1 `tokensOnly`** is not enabled yet. Both apps keep their own palettes until they adopt `@vitavision/ui` (L3).
