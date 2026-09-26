# lab-ui — the `@vitavision/*` frontend packages

A bun-workspace monorepo. `docs/plan/PLAN.md` is the roadmap; `docs/adrs/` records decisions;
every gate result goes to `docs/measurements/<gate>.md` with the repo and commit SHA.

## Commands

```bash
bun install
bun run build        # tsdown → packages/*/dist
bun run test         # vitest per package, bun test for tools/ and packages/config/
bun run lint         # eslint via @vitavision/config-eslint (from L1-4)
bun run typecheck    # tsc per package + tools/
bun run storybook    # apps/storybook (from L1-4)
bun run bench        # tools/bench/stage2d, headed Chromium
bun run check:deps   # PLAN §2 layering rules
```

## Layering (PLAN §2, enforced by `tools/inventory/check-deps.ts`)

- `ui` depends only on Radix, `clsx`, `tailwind-merge`, `lucide-react`. No router, no motion library.
- `forms`, `charts`, `stage2d` depend on `ui`. `overlays` on `stage2d` (and the WASM packages as optional type-only peers). `three-react` on `three`; `three` never imports React.
- `react` / `react-dom` are always peers. No package depends on a router.
- Every package: ESM only, `exports` with `types`, `sideEffects` limited to CSS.
- Workspace siblings resolve to their sources via the `@vitavision/source` export condition.

## Definition of Done for a component (PLAN §4)

- [ ] Named exports; React 19 ref-as-prop (no `forwardRef`); `value`/`defaultValue`/`onValueChange`; `className` merged with `cn`; state as `data-*`; links via `asChild`; no module-scope `window`/`document`.
- [ ] TSDoc on every export; api-extractor report committed with 0 `ae-undocumented`; Storybook docs page (purpose, when not to use, props, a11y notes, one story per state).
- [ ] Stories are the fixtures: `composeStories` interaction tests in Vitest browser mode; unit (and property) tests for pure logic; coverage ≥ 90 % logic / ≥ 80 % components.
- [ ] axe: 0 serious/critical in light and dark; `renderToString` of every story with 0 errors/warnings; visual regression (macOS, `maxDiffPixelRatio ≤ 0.001`).
- [ ] publint 0 errors, attw 0 problems, size-limit budget, knip 0 unused.
- [ ] Lint and types: 0 errors, 0 warnings; no `any`; `@ts-expect-error` only with a linked issue.

## Constraints

- One repository per PR; one PLAN ticket per PR; a changeset with every user-facing change.
- Commit only when asked (the owner has granted a standing mandate for PLAN tickets — see the PR history).
- No speculative components: a component enters only when a **second** app needs it now, with its stories and tests (the promotion rule).
- No router imports in packages. No module-scope DOM access (packages must be SSR-safe: vitavision renders on the server).
- Version exceptions only through ADR-0002 and `tools/inventory/baseline.toml`.
