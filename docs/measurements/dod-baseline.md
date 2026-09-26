# DoD baseline (L1-4)

This is the first run of every PLAN §4 gate over the packages moved in L1-2. The failures are **listed here, not fixed**; L1-5 fixes them, one PR per package.

- Measured: 2026-09-26, lab-ui branch `l1-4-storybook-harness` (on top of `4b713e3`), macOS / Apple M-series.
- Scope: `ui`, `forms`, `charts`, `stage2d`, plus the `lab-ui` compat package.
- CI: every gate below is a job in `.github/workflows/ci.yml`. The jobs carry `continue-on-error: true` until L1-5 brings their package to green.

## Summary

| Gate (§4) | Command | ui | forms | charts | stage2d | lab-ui |
|---|---|---|---|---|---|---|
| Stories: interaction (`play`) | `bun run test:stories` | ✅ 126 / 126 | ✅ 7 / 7 | ✅ 28 / 28 | ✅ 16 / 16 | — |
| Stories: axe, light + dark, 0 serious/critical | same | ❌ 44 stories fail | ❌ 6 fail | ✅ | ✅ | — |
| Stories: SSR `renderToString`, 0 errors/warnings | same | ✅ | ✅ | ✅ | ✅ | — |
| Visual regression, macOS, ≤ 0.001 | `bun run test:visual` | baseline written (354 screenshots = 177 stories × 2 themes); a re-run matches 354 / 354 | | | | |
| Unit coverage, lines (≥ 90 % logic / ≥ 80 % components) | `bun run coverage` | ❌ 32.4 % | ✅ 95.0 % | ✅ 93.3 % | ❌ 70.2 % | — |
| api-extractor `ae-undocumented` = 0 | `bun run api` | ❌ 35 | ❌ 6 | ❌ 56 | ❌ 87 | ✅ 0 |
| publint, 0 errors | `bun run publint` | ✅ | ✅ | ✅ | ✅ | ✅ |
| attw, 0 problems (ESM-only profile) | `bun run attw` | ✅ | ✅ | ✅ | ✅ | ✅ |
| size-limit, minified + brotli, deps excluded | `bun run size` | 6.12 kB | 2.04 kB | 2.81 kB | 6.47 kB | 334 B |
| Lint (errors / warnings) | `bun run lint` | ❌ 2 / 6 | ❌ 4 / 0 | ❌ 9 / 2 | ❌ 14 / 16 | ✅ |
| Types (strict + `exactOptionalPropertyTypes`) | `bun run typecheck` | ✅ | ✅ | ✅ | ✅ | ✅ |

Notes on the summary:

- **Size.** No size budget is set yet. L1-5 sets each one to the measured size + 10 %.
- **Coverage.** The figures count the package's own unit tests only. Coverage from the story tests (Vitest browser mode) is not yet merged in, and L1-5 adds it. That matters most for `ui`, whose components are exercised almost entirely by stories.
- **Stories.** In total, 305 of the 355 story tests pass, and all 50 failures are axe findings.

## Stories: the axe findings

Every finding comes from component code, not from a story. They have a small number of causes.

| Cause | Rule | Stories |
|---|---|---|
| `text-fg-subtle` is below 4.5:1 on `surface`/`ground`, in both themes. It is used for secondary labels: Field annotations, ReadoutStrip labels, Section step numbers, the Select placeholder and option notes, and the unlabeled badge | `color-contrast` | Field ×2, ReadoutStrip ×3, Section ×3, Density ×3, Select ×2, Badge ×3, SchemaForm ×6 (through Field) |
| `signal-fg` on `signal` (the primary Button) fails in the light theme | `color-contrast` | Button, ButtonLink, PageHeader, Dialog, Feedback › EmptyState |
| Verdict tints (`bg-normal/12`, `bg-defect/12`, `bg-warn/…`) with the verdict-coloured text fail in the light theme, and so does the `danger` button | `color-contrast` | Badge ×5, Button › Danger, Dialog › Confirm ×3, Feedback callouts ×3, Tabs (the count pill on `bg-signal/15`) |
| `Slider` puts `aria-label` on the Radix root, so the `role="slider"` thumb has no name | `aria-input-field-name` | Slider ×4 |
| `ProgressBar` has no accessible name | `aria-progressbar-name` | Feedback › Progress ×2 |
| The Dialog's scrolling body cannot receive keyboard focus | `scrollable-region-focusable` | Dialog › LongBody |
| An open Radix Select sets `aria-hidden` on its own trigger while that trigger is still focusable | `aria-hidden-focus` | Select › Open |

The contrast causes are token decisions. They overlap with **L3-2**, which requires WCAG AA contrast tests for every pair of tokens. L1-5 fixes the tokens where that is the lower-risk option and records any residue for L3-2.

Other accessibility gaps turned up while writing the stories. axe does not flag them, but they are recorded in each component's docs page:

- Field does not wire its description id into the control's `aria-describedby`.
- Tabs has no arrow-key roving focus and no `aria-controls`.

## Lint (`@vitavision/config-eslint`)

55 problems across the repo: 31 errors and 24 warnings. By rule:

- **`vitavision/tokens-only` (G5.1), 10 errors.** Hex literals in `charts/src/Frame.tsx`, from the series palette and the `NORMAL_COLOUR`/`DEFECT_COLOUR` constants, and one in `stage2d/src/components/ZoomPanCanvas.tsx`. The series palette is the data-vis palette that §5 asks for. It moves into tokens in L3-1/L3-2.
- **Type-aware rules:**
  - `no-floating-promises`, 9, mostly in tests and stories.
  - `no-unsafe-*`, 14.
  - `no-unnecessary-type-assertion`, 4.
  - `no-base-to-string`, 2.
  - `require-await`, `no-unused-vars` and `no-unsafe-assignment`, 1 each.
- **React:**
  - `react-hooks/refs`, 2 errors.
  - `react-hooks/set-state-in-effect`, 1 error.
  - `@eslint-react/naming-convention-*`, 14 warnings.
  - `no-array-index-key`, 4 warnings.
  - `set-state-in-effect` and exhaustive-deps, 4 warnings.

## knip

These are unused or unlisted items. Most are config noise: knip does not follow Tailwind `@import`s in CSS, or the story glob in `apps/storybook`.

- **Flagged as "unused", but used through CSS or the story glob.**
  - `apps/storybook`: the `@fontsource*` fonts, `tailwindcss`, and `@vitavision/{charts,forms,stage2d}`. The fonts and `tailwindcss` are used through CSS; the packages through the story glob.
  - `tools/bench/stage2d`: `@vitavision/ui` and `tailwindcss`, used through CSS.
  - L1-5 fixes these through knip config, not by removing the dependencies.
- **Genuinely unused.**
  - Root `@arethetypeswrong/cli` is run through `bunx` and never imported. Keep it but declare it to knip.
  - `apps/storybook` `@vitest/coverage-v8`: story-test coverage is not wired in yet.
- **Unlisted:** `estree` types in `packages/config/eslint`. Add `@types/estree` as a devDependency.
- **Duplicate export:** `controlClasses` / `inputClasses` in `ui/Input.tsx`. One is an alias of the other. Keep one, or document the alias.
- **Referenced optional peer:** `tsdown` in `config-ts`. This is intended, since the tsdown preset is optional, and needs a knip ignore.

## api-extractor

The reports are committed at `packages/*/etc/*.api.md`. The `ae-undocumented` count is the number of exported declarations without TSDoc; the target is 0.

api-extractor 7.59.2 analyses with its bundled TypeScript 5.9.3 (ADR-0002 N1). The declarations parse cleanly, and there are 1–3 TSDoc syntax warnings per package, mostly an unclosed backtick in a code span.

## Visual regression

- Baselines were written on macOS in Chromium from Playwright 1.63, in `apps/storybook/visual/__screenshots__/`, and are about 9.5 MB.
- A second run on the same machine, this time without `--update-snapshots`, passed 354 / 354, so the screenshots are deterministic.
- The CI job runs on `macos-latest`. If the runner's font rasterisation differs from the machine that made the baselines, the fix (L1-5) is to regenerate the baselines from the CI job's artifacts. The gate is defined on the macOS runner.

## First CI run (PR #19)

- **Stories.** CI matches local exactly: 305 pass, 50 fail, and all 50 failures are the axe findings listed above.
- **Visual (macos-latest).** 325 of 354 screenshots match the baselines made locally; **29 differ**. These are rasterisation differences between two macOS machines, not changes in the stories. L1-5 regenerates the baselines from the CI job's own screenshots. The gate is defined on the runner, not on a developer's machine.
- **Controlled/uncontrolled warning.** The browser run logs React's "Select is changing from uncontrolled to controlled" warning. It comes from `Select` passing no `value` to Radix for the unset state. L1-5 needs to make Select controlled for its whole lifetime.
- **api job.** In CI (non-`--local`) mode, api-extractor fails on its TSDoc syntax warnings, the unclosed backticks noted above.
