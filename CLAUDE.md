# lab-ui: the `@vitavision/*` frontend packages

A bun workspace that publishes the `@vitavision/*` React packages (`ui`, `forms`, `charts`,
`stage2d`, `overlays`, `workbench`, `three`, `three-react`, `config-{ts,eslint,vitest}`) and the
Storybook docs site (`apps/storybook`, deployed to GitHub Pages from `main`).

Docs map:
- `README.md`: for users.
- `CONTRIBUTING.md`: develop and release.
- `docs/plan/PLAN.md`: open roadmap only.
- `docs/adrs/`: decisions.
- `docs/visual-language.md`: the design spec.
- `docs/measurements/`: generated reports and the stage2d performance evidence. A gate result goes in its PR description, not in a new file here.

## Commands

```bash
bun install
bun run typecheck      # tsc per package + tools/ (siblings resolve to sources: no build needed)
bun run test           # vitest per package (node + Chromium projects) + bun test tools/ packages/config/
bun run test:stories   # every story: interactions, axe light + dark, renderToString. NOT part of `test`
bun run lint           # eslint, 0 warnings allowed
bun run build          # tsdown → packages/*/dist
bun run api            # regenerate packages/*/etc/*.api.md after any public API change (CI runs api:check)
bun run check:deps     # the layering rules below
bun run knip           # also: size, publint, attw, coverage (the other CI gates)
bun run check:consumer # packed tarballs installed into a fresh app: SSR render + Tailwind build
bun run storybook      # docs site on :6006
bun run changeset      # add a changeset
bun run inventory:concepts   # docs/measurements/concept-matrix.md (needs the sibling repos checked out)
bun run inventory:deps       # docs/measurements/deps.md
bun run bench          # stage2d benchmark, headed Chromium
```

Visual regression (`test:visual`) runs only in CI, on macOS.

## Layering (enforced by `tools/inventory/check-deps.ts`)

- `ui`: only `@radix-ui/*`, `clsx`, `tailwind-merge`, `lucide-react`.
- `forms`, `charts`: only `ui`. `stage2d`, `workbench`: `ui` and `lucide-react` (ADR-0005 for workbench).
- `overlays`: no dependencies; `stage2d` is a **peer** (one stage context per app).
- `three`: no dependencies and React-free (no dep, peer or import). `three-react`: `three`. `three` itself is a peer of both, pinned exactly.
- `react` / `react-dom` are always peers. No router or motion library, anywhere.
- Every bare import in `src/` is a declared dependency or peer. A package missing from `ALLOWED` is an error. `config-*` are not checked.
- Every package: ESM only, `exports` with `types`, `sideEffects` limited to CSS. Siblings resolve to sources through the `@vitavision/source` export condition.

## Definition of Done for a component

- [ ] Named exports; React 19 ref-as-prop (no `forwardRef`); `value`/`defaultValue`/`onValueChange`; `className` merged with `cn`; state as `data-*`; links via `asChild`; no module-scope `window`/`document`.
- [ ] TSDoc on every export; api-extractor report committed with 0 `ae-undocumented`; Storybook docs page (purpose, when not to use, props, a11y notes, one story per state).
- [ ] Stories are the fixtures: `composeStories` interaction tests in Vitest browser mode; unit (and property) tests for pure logic; coverage ≥ 90 % logic / ≥ 80 % components, per file.
- [ ] axe: 0 serious/critical in light and dark; `renderToString` of every story with 0 errors/warnings; visual regression (macOS, `maxDiffPixelRatio ≤ 0.001`).
- [ ] publint 0 errors, attw 0 problems, size-limit budget, knip 0 unused.
- [ ] Lint and types: 0 errors, 0 warnings; no `any`; `@ts-expect-error` only with a description.

## Workflow

- **Branches.** Work in a worktree under `.claude/worktrees/<branch>`, branched from a fresh `origin/main`. Other sessions edit the main checkout, so never commit files you didn't write.
- **Changesets.** Every user-facing change needs one. A breaking change is a **minor** (all packages are 0.x).
- **CI.** Push, open a PR, then read **every** line of `gh pr checks`: `--watch` exits 0 even when a check failed. Squash-merge once all checks are green.
- **Visual baselines.**
  1. Label the PR `update-visual-baselines`. CI rewrites the baselines on macOS and uploads them as the `visual-baselines` artifact.
  2. Commit only the PNGs of new or intentionally changed stories. Every rewrite adds rasteriser noise to the others, and `ui-tooltip--hint--dark` is flaky.
  3. Remove the label and push.
- **Release.**
  - `release.yml` keeps a "chore(release): version packages" PR open, and merging it publishes through npm trusted publishing.
  - Merge it only on the owner's explicit go.
  - The registry can lag CI by about 5 minutes.
- **New package.** The first version is published by hand in the owner's terminal (npm OTP; see CONTRIBUTING.md). Then register the trusted publisher, and add the package to:
  - `ALLOWED` in `check-deps.ts`
  - `PACKAGES` in `tools/dod/consumer.ts` and `tools/dod/pack-check.ts`
  - the dist checks in `ci.yml`
  - `.size-limit.json`
  - the lab-ui `manifests` in `tools/inventory/concepts.toml`
  - the root README table

## Constraints

- One repository per PR; one concern (plan ticket or issue) per PR.
- Commit only when asked. The owner has a standing mandate to commit, push and merge plan tickets and issue fixes once CI is green; publishing is not covered by it.
- Build a component once it is reusable beyond a single screen: shape it from the real use cases at hand and ship it with its stories and tests.
- No router imports in packages. No module-scope DOM access (packages must be SSR-safe: vitavision renders on the server).
- Version exceptions only through ADR-0002 and `tools/inventory/baseline.toml`.
- `stage2d` overlay layers:
  - Batch by appearance: one path per state and style.
  - Pick through a pure spatial index, never the DOM.
  - Per-item elements only for handles and the hovered or selected few (ADR-0004).
- **User-facing text never uses internal terms.** User-facing text means READMEs, Storybook, changesets (they become the CHANGELOGs), public TSDoc and the package.json `description`. Internal terms means:
  - plan ticket ids (`L6-4`, `U-5`), `PLAN`, `§`
  - ADR numbers, gate names (`G5.1`)
  - `lab-ui#NN` references
  - internal app names as rationale

  `tools/docs/user-facing.test.ts` enforces it.
