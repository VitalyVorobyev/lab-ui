# ADR-0002: Toolchain baseline

- Status: Accepted
- Date: 2026-09-26 (versions re-read from the npm registry that day, PLAN L1-1)
- Amended: 2026-10-17. TypeScript 7, Oxlint and oxfmt; B1 resolved (rows re-read that day).
- Data: `tools/inventory/baseline.toml`. The dependency matrix (`docs/measurements/deps.md`) is checked against it.

## Rule

Take the latest version of every tool **unless a peer range blocks it**. When one does, pin
the newest compatible version, and record here both the blocker and the event that should
trigger a re-check.

A release is adopted once it has been on npm for two weeks: the rows re-read on 2026-10-17
take the newest release at least two weeks old that day.

This ADR is the only place a version exception may be introduced. A per-repo exception goes
into `baseline.toml` `[exceptions]` with a link back here.

## Baseline

| Package | Baseline | Status |
|---|---|---|
| react, react-dom, @types/react(-dom) | 19.3.0 | latest |
| react-router | 8.4.0 | latest; **replaces react-router-dom** (latest 7.18.4, no 8.x) |
| typescript | 7.0.2 | latest; the native compiler, see N2 (B1 resolved) |
| vite / @vitejs/plugin-react | 8.3.1 / 6.1.1 | latest |
| vitest / @vitest/browser-playwright | 5.0.2 / 5.0.2 | latest |
| tailwindcss / @tailwindcss/vite | 4.3.3 | latest |
| oxlint / @oxlint/plugins | 1.86.0, **exact pin** / 1.86.0 | newest two weeks old; JS plugins are alpha and outside semver, so pinned exactly; **replaces eslint**, see N3 |
| oxlint-tsgolint | 7.0.2003, **exact pin** | newest two weeks old; the type-aware rules; versioned after the TypeScript it embeds; **replaces typescript-eslint** |
| oxfmt | 0.71.0, **exact pin** | newest two weeks old; 0.x, so pinned exactly; see N4 |
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

### B1: TypeScript was held at 6.0.3, not 7.0.2 (resolved 2026-10-17)

- **Blocker, then.** `typescript-eslint@8.70.1` peered `typescript >=4.8.4 <6.1.0`, and type-aware lint is part of the §4 quality bar.
- **Resolution.** ESLint and typescript-eslint are replaced by Oxlint, whose type-aware rules run on `oxlint-tsgolint` (TypeScript 7's own checker), so nothing peers TS < 7 any more. What each other tool does without a TypeScript 7 compiler API is in N2. typescript-eslint 8.71.2 still peers `<6.1.0`, so an app that keeps ESLint stays on 6.0.3.
- **Effect.** Every repo moves to 7.0.2 together with the move to `@vitavision/config-oxlint`.

### B2: React is held below 19.4

- **Blocker.** `@react-three/fiber@9.8.1` peers `react >=19 <19.4`. 19.3.0 is the latest release today, so nothing is held back yet. The constraint caps the *next* upgrade.
- **Re-check when** react 19.4 ships. Upgrade only once a fiber release admits it.

## Excluded packages

### X1: `eslint-plugin-jsx-a11y`

- **Why excluded.** It peers `eslint ^3 … ^9` and cannot run on eslint 10. Its last release was 2024-10-26.
- **What replaces it.** Accessibility is enforced at runtime instead: axe runs on every story in both themes (§4), with 0 serious or critical findings allowed.
- **Re-check when** a release admits eslint 10. Since 2026-10-17 lint runs on Oxlint, which has a native port of the jsx-a11y rules; turning them on is its own change (on 2026-10-17 they reported 59 findings in 11 rules, mostly `prefer-tag-over-role`, to triage first).

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

**Re-check when** a declaration uses syntax newer than TS 5.9 and api-extractor fails, or
when api-extractor moves to a newer TypeScript. With TypeScript 7.0.2 the reports are
unchanged.

### N2: TypeScript 7 has no stable compiler API

TypeScript 7.0's `typescript` package is the native compiler: its JavaScript entry exports
only the version and an `unstable/*` API. Each tool that used the compiler API, checked on
2026-10-17:

| Tool | With TypeScript 7.0.2 |
|---|---|
| `tsc --noEmit` (typecheck) | native; the workspace typecheck went from about 18 s to about 1.3 s |
| tsdown 0.23.0 (`.d.ts`) | rolldown-plugin-dts 0.28.6 picks its `tsgo` generator when TypeScript 7 is installed: it runs the native `tsc` on each package's `tsconfig.json`. The bundled `.d.ts` of all eight packages are **byte-identical** to the TypeScript 6.0.3 build. It logs a warning that the TypeScript 7 path is experimental; `tsconfigRaw` / `compilerOptions` overrides are ignored on it, and `@vitavision/config-ts`'s preset uses neither. No TypeScript 6 dependency is kept for it. |
| @microsoft/api-extractor 7.59.2 | bundles TypeScript 5.9.3 (N1); reports unchanged |
| @arethetypeswrong/cli 0.18.5 | bundles its own TypeScript (5.6); 0 problems |
| Storybook 10.6 docgen | **changed.** `react-docgen-typescript` needs the compiler API and fails to load (`ts.sys` is undefined). The Storybook app now uses `react-docgen` (Babel-based). The old setting gave the built site no prop tables at all, since the package sources lie outside the app's `tsconfig.json`; `react-docgen` documents 116 components. |
| Vitest 5 (node and browser mode), Vite 8, knip 6.38, size-limit 14, publint | no compiler API in use; unchanged |
| `check:consumer` | now also typechecks the packed packages' declarations in the fresh app with TypeScript 7.0.2 and the shared strict options, `skipLibCheck` off |

- **Re-check when** TypeScript ships a stable compiler API (a later 7.x). Then retire the tsgo warning, and react-docgen-typescript becomes an option again.

### N3: Oxlint replaces ESLint

`@vitavision/config-oxlint` (`oxlintrc.json`) replaces `@vitavision/config-eslint`. It
turns on, one by one, the rules the ESLint config enforced, with type-aware rules on and
`--max-warnings 0` kept. The `correctness` category stays off, as the ESLint config had no
`eslint:recommended`: turning it on would be a separate change (19 findings on 2026-10-17,
some wrong, such as a copy of a `Set` taken on purpose before iterating it).

- **Native rules** cover the typescript-eslint `recommendedTypeChecked` set (type-aware ones
  through `oxlint-tsgolint`), `no-explicit-any`, `ban-ts-comment`, `consistent-type-imports`,
  the core rules it enabled, `eslint-plugin-react-hooks` 7 including the React Compiler checks,
  and most of `@eslint-react`'s recommended rules under their `eslint-plugin-react` names.
  `no-forward-ref`, `no-use-context` and the removed `react-dom` APIs are `no-restricted-imports`
  entries.
- **Ported rules**, as Oxlint JS plugins in the config package (ESLint rule API):
  - `vitavision/tokens-only` (custom, as before; it now skips tests and stories itself, since an Oxlint `overrides` entry cannot exclude files);
  - `vitavision/no-context-provider`, `vitavision/jsx-no-leaked-dollar`, `vitavision/jsx-no-leaked-semicolon` (from `@eslint-react`, whose plugin loads the TypeScript compiler API and so cannot load under TypeScript 7);
  - the ten recommended `storybook/*` rules, under the same names (from `eslint-plugin-storybook`, which needs ESLint and typescript-eslint at run time). `await-interactions` now checks every file importing `storybook/test`; the original only fired when a file's last import was `@storybook/test`.
- **Differences in severity.** `no-forward-ref` and `no-use-context` were warnings and are now errors, as is `jsx-no-children-prop`. Under `--max-warnings 0` both fail the gate anyway.
- **Stricter.** The root config reports unused disable directives as errors.
- **Known gaps:** ESLint rules with no Oxlint equivalent, not checked:

  | Rule | Why not |
  |---|---|
  | `@eslint-react/web-api-no-leaked-event-listener`, `-fetch`, `-interval`, `-timeout`, `-resize-observer`, `-intersection-observer` | effect-cleanup analysis; no native rule, too large to port |
  | `@eslint-react/naming-convention-context-name`, `-id-name`, `-ref-name` | naming only; no native rule |
  | `@eslint-react/no-unnecessary-use-prefix`, `no-nested-lazy-component-declarations` | no native rule |
  | `@eslint-react/use-state` | `react/hook-use-state` also flags `const [store] = useState(create)`, the stable-instance idiom used here |
  | `@eslint-react/no-create-ref` | a `no-restricted-imports` entry would also flag tests, which may use `createRef` |
  | `@eslint-react/no-access-state-in-setstate`, `no-unused-class-component-members`, `rsc-function-definition` | class components and server functions; the packages have neither |
  | `react-hooks/config`, `react-hooks/gating` | validate React Compiler options; no compiler is configured |

- **Re-check when** Oxlint adds one of the gaps natively, or when JS plugins become stable
  (they are alpha in 1.86, which is why `oxlint` is pinned exactly: run the plugin's rule
  tests on every bump).

### N4: oxfmt is the formatter

There was no formatter before: the code was written to a Prettier-like style at widths
between 100 and 160. oxfmt 0.71.0 (Prettier-compatible) runs with Prettier's defaults and
`printWidth: 140`, the width with the least churn (measured on 2026-10-17: about 3,800
changed lines at 140, against 4,800 at 120 and 10,900 at 100); `sortPackageJson` is off so
manifests keep their order. Markdown and MDX (hand-wrapped prose, plus generated changelogs
and API reports), test fixtures and screenshots are not formatted. CI checks it
(`bun run format:check`).

## Compiler options (`@vitavision/config-ts`)

All repositories use these options: `strict`, `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `moduleResolution: "bundler"`,
`jsx: "react-jsx"`, `target`/`lib` ES2022 plus DOM, `isolatedModules`, `skipLibCheck`.
