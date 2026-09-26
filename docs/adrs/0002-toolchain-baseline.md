# ADR-0002: Toolchain baseline

- Status: Accepted
- Date: 2026-09-26 (versions re-read from the npm registry that day, PLAN L1-1)
- Data: `tools/inventory/baseline.toml`. The dependency matrix (`docs/measurements/deps.md`) is checked against it.

## Rule

Take the latest version of every tool **unless a peer range blocks it**. When one does, pin
the newest compatible version, and record here both the blocker and the event that should
trigger a re-check.

This ADR is the only place a version exception may be introduced. A per-repo exception goes
into `baseline.toml` `[exceptions]` with a link back here.

## Baseline

| Package | Baseline | Status |
|---|---|---|
| react, react-dom, @types/react(-dom) | 19.3.0 | latest |
| react-router | 8.4.0 | latest; **replaces react-router-dom** (latest 7.18.4, no 8.x) |
| typescript | **6.0.3** | **held back** (latest is 7.0.2), see B1 |
| vite / @vitejs/plugin-react | 8.3.1 / 6.1.1 | latest |
| vitest / @vitest/browser-playwright | 5.0.2 / 5.0.2 | latest |
| tailwindcss / @tailwindcss/vite | 4.3.3 | latest |
| eslint / typescript-eslint | 10.11.0 / 8.70.1 | latest |
| @eslint-react/eslint-plugin, eslint-plugin-react-hooks, eslint-plugin-storybook | 5.20.8, 7.1.1, 10.6.0 | latest |
| storybook, @storybook/{react-vite,addon-docs,addon-a11y} | 10.6.0 | latest |
| tsdown | 0.23.0, **exact pin** | latest; 0.x, so pinned exactly |
| three / @types/three | 0.186.1 / 0.186.0, **exact pin** | latest; three breaks on minor releases |
| @react-three/fiber / drei | 9.8.1 / 10.7.9 | latest |
| konva / react-konva | 10.7.0 / 19.3.0 | latest; only until the L6 stage decision |
| motion | 13.4.4 | latest; replaces framer-motion; apps only, never in `ui` |
| lucide-react | 1.48.0 | latest |
| @playwright/test / @axe-core/playwright | 1.63.0 / 4.13.0 | latest |
| @changesets/cli | 3.0.3 | latest |
| size-limit | 14.0.1 | latest |
| @microsoft/api-extractor | 7.59.2 | latest; bundles its own TypeScript 5.9.3 for analysis, see N1 |
| publint / @arethetypeswrong/cli / knip | 0.3.24 / 0.18.5 / 6.38.0 | latest |
| bun | 1.4.2 | pinned in `packageManager` |
| @tauri-apps/api / cli | 2.11.1 / 2.11.5 | latest |

## Blockers

### B1: TypeScript is held at 6.0.3, not 7.0.2

- **Blocker.** `typescript-eslint@8.70.1` peers `typescript >=4.8.4 <6.1.0`. Type-aware lint is part of the §4 quality bar, so TS 7 would mean dropping it.
- **Effect.** lab-ui (currently `^7`) and visual-anomaly-lab (`^7`) move **down** to 6.0.3. So do vision-metrology/lab (`^5.7`) and the calib-targets frontends (`~5.8`), which move up to it. TS 7's native compiler also broke tsup's dts bundling here; that no longer matters once tsdown replaces tsup.
- **Re-check when** `typescript-eslint` publishes a release whose peer range admits 7.x.

### B2: React is held below 19.4

- **Blocker.** `@react-three/fiber@9.8.1` peers `react >=19 <19.4`. 19.3.0 is the latest release today, so nothing is held back yet. The constraint caps the *next* upgrade.
- **Re-check when** react 19.4 ships. Upgrade only once a fiber release admits it.

## Excluded packages

### X1: `eslint-plugin-jsx-a11y`

- **Why excluded.** It peers `eslint ^3 … ^9` and cannot run on eslint 10. Its last release was 2024-10-26.
- **What replaces it.** Accessibility is enforced at runtime instead: axe runs on every story in both themes (§4), with 0 serious or critical findings allowed.
- **Re-check when** a release admits eslint 10.

### X2: `@storybook/addon-vitest`

- **Why excluded.** It peers `vitest ^3 || ^4` (and `@vitest/browser-playwright ^4`), but the baseline is vitest 5.
- **What replaces it.** Stories are still the test fixtures, loaded through `composeStories` in Vitest browser mode (Chromium via `@vitest/browser-playwright`).
- **Re-check when** the addon admits vitest 5.

### X3: `tsup`

- **Why excluded.** Its README declares it unmaintained and points to tsdown. Its last publish was 2025-11-12.
- **What replaces it.** `tsdown` 0.23.0, pinned exactly.

## Notes

### N1: api-extractor bundles its own TypeScript

`@microsoft/api-extractor` 7.59.2 depends on `typescript` 5.9.3 internally. It reads the
emitted `.d.ts`, not the sources, so this is compatible with authoring in 6.0.3 as long as the
declarations stay within syntax TS 5.9 parses.

**Re-check when** a declaration uses 6.0-only syntax and api-extractor fails, or when
api-extractor moves to TS 6.

## Compiler options (`@vitavision/config-ts`)

All repositories use these options: `strict`, `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `moduleResolution: "bundler"`,
`jsx: "react-jsx"`, `target`/`lib` ES2022 plus DOM, `isolatedModules`, `skipLibCheck`.
