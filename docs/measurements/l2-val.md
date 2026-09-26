# L2-1: visual-anomaly-lab on the toolchain baseline

visual-anomaly-lab's frontend (`frontend/`) moved to the §3 baseline and to `@vitavision/config-ts` and `@vitavision/config-eslint`, with no UI change.

- **Measured:** 2026-09-26, macOS / Apple M-series, Chromium from Playwright 1.63.
- **visual-anomaly-lab:** PR [#163](https://github.com/VitalyVorobyev/visual-anomaly-lab/pull/163), merged as `01ab1fc`.
  - `df90169` adds the screenshot suite, on top of `main` at `4b61025` (#162); the baseline was captured on it.
  - `a34fdd2` is the upgrade; the comparison ran on it.

## Done-when (PLAN L2)

| Criterion | Result |
|---|---|
| typecheck | ✅ 0 errors under `@vitavision/config-ts`, including `exactOptionalPropertyTypes` (about forty places fixed) |
| lint | ✅ 0 errors (`@vitavision/config-eslint`, now a CI step). 139 warnings; see the exception below |
| unit tests | ✅ 666 / 666 (665 before, plus a test for the new `defined()` helper) |
| e2e | ✅ the new screenshot suite; there was no e2e suite before |
| L0-2, 0 undocumented deviations | ✅ `bun tools/inventory/deps.ts --strict --repo val` |
| Screenshots of the main routes, `maxDiffPixelRatio` ≤ 0.001 against the pre-upgrade baseline | ✅ 34 / 34 (17 routes × light and dark) |
| Production bundle-size delta reported | below |

## Screenshot suite

- **Command:** `bun run test:screens` in `frontend/`.
- **Backend:** Playwright runs against a throwaway backend. `scripts/e2e-seed.py` seeds it once through the real API:
  - twelve synthetic 256 × 256 discs, four of them blemished;
  - a split;
  - a trained and scored `pixel_reference` experiment.
- **Routes:** the datasets list, import, the experiments list and new-experiment form, compare, health, not-found, the five dataset tabs, the guided run, the sample viewer, the Konva annotation editor, the experiment and its sample view.
- **Determinism:** a repeat run on the baseline commit matched 34 / 34.
- **Baseline stays local:** it is not committed, because full-window PNGs exceed visual-anomaly-lab's 256 KB image cap (`check-repo-safety.sh`).

## Bundle (`vite build`)

| Chunk | Before | After | Δ |
|---|---|---|---|
| `index` | 870.94 kB (260.78 gzip) | 905.04 kB (271.04 gzip) | +34.1 kB (+10.3 gzip) |
| `AnnotationEditorRoute` | 375.22 kB (115.45 gzip) | 394.93 kB (121.50 gzip) | +19.7 kB (+6.1 gzip) |
| CSS | 52.09 kB | 52.09 kB | 0 |

The growth comes from the upstream libraries: react 19.3, react-router 8.4 and konva 10.7.

## Exceptions carried into L3

- **React Compiler rules.** `react-hooks/set-state-in-effect`, `react-hooks/refs` and `react-hooks/immutability` are warnings in visual-anomaly-lab's `eslint.config.js`. They found 34 places; fixing each one changes when a screen renders, which L2 does not do. Each is fixed as its screen migrates, and then the override goes.
- **G5.1 `tokensOnly`** is not enabled yet. It reports 27 raw hex values: the Konva scene palette, the crash screen (token-free on purpose), class colours and colormap stops. It is enabled per directory as the screens migrate.
- **`@vitavision/lab-ui` stays at ^0.5.** Moving to `@vitavision/ui` and the other split packages, and from `ButtonLink` to `asChild`, is L3 work.
