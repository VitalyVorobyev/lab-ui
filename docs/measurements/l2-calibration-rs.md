# L2-3: calibration-rs `app/` on the toolchain baseline

The calibration-rs desktop app's frontend (Tauri 2 + React) moved to the §3 baseline and to `@vitavision/config-ts` and `@vitavision/config-eslint`, with no UI change.

- **Measured:** 2026-09-26, macOS / Apple M-series, Chromium from Playwright 1.63.
- **calibration-rs:** PR [#118](https://github.com/VitalyVorobyev/calibration-rs/pull/118), merged as `20fbd376`.
  - `479c47da` adds the screenshot suite; the baseline was captured on it.
  - `1b91cdc7` is the upgrade; the comparison ran on it.

## Done-when (PLAN L2)

| Criterion | Result |
|---|---|
| typecheck | ✅ 0 errors. `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are new here and found 68 places, all fixed at the type level; the emitted JS is unchanged |
| lint, 0 errors | ✅ on `@vitavision/config-eslint`, keeping the app's own documented advisory rules |
| unit and component tests | ✅ 56 / 56 (unchanged) |
| e2e | ✅ the Playwright smoke passes in CI |
| L0-2, 0 undocumented deviations | ✅ |
| Screenshots, `maxDiffPixelRatio` ≤ 0.001 against the pre-upgrade baseline | ✅ 6 / 6 |
| Bundle delta | below |

## Screenshot suite

`bun run test:screens` runs under its own `playwright.screens.config.ts` on port 1421.

- **Coverage:** each of the five workspaces empty, plus Diagnose with the planar fixture loaded through the existing Tauri IPC mock.
- **Gap:** the 3D viewer is covered only empty. No rig fixture exists yet, so R3F scene rendering is not compared.

## Bundle (`vite build`)

| Chunk | Before | After | Δ |
|---|---|---|---|
| `index` | 504.33 kB (140.25 gzip) | 536.16 kB (149.55 gzip) | +31.8 kB (+9.3 gzip) |
| `useThemeColors` (r3f/drei) | 528.59 kB (141.78 gzip) | 554.73 kB (148.40 gzip) | +26.1 kB (+6.6 gzip) |
| `three.core` | 386.15 kB (104.73 gzip) | 390.29 kB (105.64 gzip) | +4.1 kB (+0.9 gzip) |
| CSS | 82.47 kB | 82.47 kB | 0 |

## Notes

- **Vitest 5 dropped `environmentMatchGlobs`.** Every component test already opted into jsdom with a pragma, so the setting was dead and is removed.
- **R3F event props.** The two `<group onClick>` props are passed only when defined. r3f 9.8.1 treats an absent handler and an `undefined` one identically (`applyProps`, `diffProps`).

## Exceptions carried into L3

- **React Compiler rules.** `react-hooks/refs` and `react-hooks/immutability` are warnings, joining the app's existing advisory `purity` and `set-state-in-effect`.
- **G5.1 `tokensOnly`** is not enabled yet.
