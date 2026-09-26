# DoD after L1-5

Every PLAN §4 gate is green for `ui`, `forms`, `charts` and `stage2d` and the `lab-ui` compat package, and every gate is a required CI job.

- **Measured:** 2026-09-26, lab-ui `l1-5-close` (PR #26, on top of main after #22–#25), macOS and the CI runners.
- **Before:** [dod-baseline.md](dod-baseline.md).

| Gate (§4) | ui | forms | charts | stage2d | lab-ui |
|---|---|---|---|---|---|
| Stories: `play` | ✅ | ✅ | ✅ | ✅ | — |
| Stories: axe, light + dark, 0 serious/critical | ✅ (was 44 ✗) | ✅ (was 6 ✗) | ✅ | ✅ | — |
| Stories: SSR, 0 errors/warnings | ✅ | ✅ | ✅ | ✅ | — |
| Visual, macOS runner, ≤ 0.001 | ✅ | ✅ | ✅ | ✅ | — |
| Line coverage, unit + stories, per file ≥ 90 % `.ts` / ≥ 80 % `.tsx` | 100 % | 98.6 % | 99.3 % | 99.5 % | — |
| `ae-undocumented` | 0 (was 35) | 0 (was 6) | 0 (was 56) | 0 (was 87) | 0 |
| api-extractor check (report up to date, no warnings) | ✅ | ✅ | ✅ | ✅ | ✅ |
| publint / attw | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ |
| size-limit (min + brotli, deps excluded) | 7.06 / 7.77 kB | 2.08 / 2.3 kB | 2.84 / 3.13 kB | 6.70 / 7.37 kB | 334 / 370 B |
| knip | 0 issues (repo-wide) | | | | |
| Lint (0 errors, 0 warnings) | ✅ (repo-wide `eslint .`) | | | | |
| Types, strict + `exactOptionalPropertyTypes` | ✅ | ✅ | ✅ | ✅ | ✅ |

The full story suite totals 363 tests (browser and SSR) plus 362 visual baselines (181 stories × 2 themes).

## What changed to get here

- **ui, contrast.** Light-theme tokens and dark `--fg-subtle` moved to WCAG AA, with hues kept. The old → new values and ratios are in the ui changeset and PR #24.
- **ui, accessibility fixes.**
  - Slider, ProgressBar, Dialog scroll region, and Select (controlled for its whole lifetime, `aria-hidden-focus` fixed).
  - Field wires `aria-describedby` and `aria-invalid`.
  - Tabs gains roving focus and `aria-controls`.
- **charts, palette.** The categorical palette became `--series-*` tokens. The old series 4 and 5 were the verdict colours, which §5 forbids. The new palette is ≥ 3:1 on both surfaces and passes a protan/deutan/tritan-safe ΔE check (PR #22).
- **stage2d, behaviour fixes.**
  - A controlled opening view is kept.
  - Measurement is on the content box.
  - The pointer → image offset of about 2 image px is fixed (PR #23).
- **Harness.** Each package runs its own stories in Chromium, counted in its coverage (PR #20). Visual baselines are generated on the macOS runner that enforces them, using the `update-visual-baselines` label.

## Open items for later phases

- **L3-2.** At AA, `fg-subtle` is close to `fg-muted`, so the type scale has to carry that hierarchy. The token-pair contrast tests are L3-2 scope.
- **L6.** `steppedScale` stops at 0.125 when the minimum scale is below it, so "Zoom out" stays enabled but does nothing.
