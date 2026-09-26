# lab-ui → central component library + cross-repo visual-language refactor
# Claude Code handoff (plan mode)

> Place at `lab-ui/docs/plan/PLAN.md`. **Plan mode first.** Read §1 before proposing
> anything. Execute one ticket per PR. A PR touches exactly one repository unless the
> ticket says otherwise. Commit only when asked. Every gate result is written to
> `lab-ui/docs/measurements/<gate>.md` with repo name and commit SHA.

## 0. Goal

1. `github.com/VitalyVorobyev/lab-ui` (today one package, `@vitavision/lab-ui@0.5.0`)
   becomes a bun-workspace monorepo of **independently published** `@vitavision/*`
   packages. It is the single home for UI primitives, forms, charts, the 2D image stage,
   calibration overlays, and the 3D scene.
2. All React frontends are upgraded to one **latest-compatible toolchain baseline** (§3).
3. All React frontends converge on **one visual language** (§5), step by step, with each
   app's local duplicate deleted once it has migrated.
4. Every shared component meets the quality bar in §4: written well, documented, tested.

**In scope** (verify the paths; the assumed layout is siblings under `~/vision/`):

| Repo | Frontend path | Current state (read 2026-09-26) |
|---|---|---|
| lab-ui | `/` | tsup; peer `react-router ^8.3`; Radix; Tailwind v4 *source* CSS; IBM Plex |
| visual-anomaly-lab | `frontend/` | consumes lab-ui 0.3; Konva; TS ^7; vitest 4; react-router 8; no eslint |
| vitavision | `/` | **SSR** (`src/entry-server.tsx`), Cloudflare; Konva; framer-motion; react-router-dom 7; TS ~6.0; vitest 5; Inter/Geist Mono/Source Serif |
| calibration-rs | `app/` | Tauri; R3F 9.7 + three 0.185.1; own `components/ui`, `FrameCanvas`, `configForm`; react-router-dom 7; Inter/Geist Mono |
| calib-targets-rs | `studio/`, `demo/` | TS ~5.8; react-router-dom 7; no design system |
| etendue | `web/` (future) | consumes `@vitavision/three*` (see the etendue PLAN update) |

**Out of scope:** Rust dependency upgrades. Those are a separate plan, because
nalgebra is pinned through tiny-solver. The only Rust-side change allowed here is
aligning Tauri crates with `@tauri-apps/*` 2.11.x. The `@vitavision/*` WASM packages
stay in their Rust repos.

## 1. Read first (mandatory)

- `lab-ui/{README.md,package.json,tsup.config.ts,src/styles.css,src/theme.ts,src/index.ts}` and all of `lab-ui/src/components/**`.
- `visual-anomaly-lab/{CLAUDE.md,AGENTS.md}` and `frontend/src/**` (the Konva stage: `AnnotationCanvas`, `LiveStage`, `LabelLayer`, `LiveLayer`).
- `vitavision/{AGENTS.md,.claude/CLAUDE.md,src/entry-server.tsx,src/index.css}`, the editor canvas under `src/components/editor/**`, and `src/lib/wasm/worker/**`.
- `calibration-rs/app/src/{components/**,lib/configForm.tsx,workspaces/**}` and `calibration-rs/docs/adrs/0018-schema-driven-ui.md`.
- `calib-targets-rs/{studio,demo}/src/**`.

**Facts relied on.** Re-verify each; if any is false, stop and report.

- F1: lab-ui `Button.tsx` and `Panel.tsx` import `Link` from `react-router`, which forces
  a router peer dependency on every consumer.
- F2: A jscpd run (min 60 tokens) across the 5 frontends found **3.1% duplication, almost
  all intra-repo**. Cross-repo duplication is *conceptual*: independent
  re-implementations, not copy-paste. Progress is therefore measured with the concept
  matrix (L0-1), not with jscpd.
- F3: 2D stages come in three technologies: lab-ui (DOM image + SVG overlay),
  Konva (vitavision, VAL), and calibration-rs `FrameCanvas`.
- F4: Schema forms exist three times: lab-ui `SchemaForm`, calibration-rs `configForm.tsx`,
  and vitavision's hand-written `*ConfigForm.tsx` per detector.
- F5: vitavision renders on the server, so every shared package must be SSR-safe.
- F6: The intra-repo clones in vitavision are the target overlays (`Charuco`/`Chessboard`/`Markerboard`/`Puzzleboard`,
  sharing 20–41-line blocks) and the WASM worker wrappers (`chessCorners`/`puzzleboard`/`radsym`).
- F7: The tsup README says it is no longer maintained and points to tsdown.

## 2. Target layout

```text
lab-ui/                                  bun workspace · changesets · one CI
├── packages/
│   ├── ui/            @vitavision/ui           tokens (Tailwind v4 source CSS), theme, primitives
│   ├── forms/         @vitavision/forms        JSON Schema (draft 2020-12, schemars output) → form
│   ├── charts/        @vitavision/charts       Histogram, Line, LineProfile, Bar, scales
│   ├── stage2d/       @vitavision/stage2d      view transform, zoom/pan, layered overlays, hit-test, measure
│   ├── overlays/      @vitavision/overlays     calib-target / feature overlays on stage2d
│   ├── three/         @vitavision/three        framework-agnostic 3D (spec: etendue PLAN §2–§4, P2-2)
│   ├── three-react/   @vitavision/three-react  thin R3F bindings (etendue PLAN P2-3)
│   ├── lab-ui/        @vitavision/lab-ui       DEPRECATED compat re-export of ui+forms+charts+stage2d
│   └── config/        @vitavision/config-{ts,eslint,vitest}  shared presets (private: false)
├── apps/storybook/                             Storybook 10: docs site + story source for tests
├── tools/inventory/                            concept matrix + dependency matrix scripts
├── tools/bench/                                stage2d benchmark harness (Playwright)
└── docs/{visual-language.md,adrs/,measurements/,plan/}
```

**Dependency rules** (enforced by `tools/inventory/check-deps.ts` in CI):

- `ui` depends only on Radix, `clsx`, `tailwind-merge`, and `lucide-react`. It has **no
  router and no motion library**.
- `forms` and `charts` depend on `ui`. `stage2d` depends on `ui`. `overlays` depends on
  `stage2d`, and on `@vitavision/{calib-targets,chess-corners,ringgrid,radsym}` as
  **optional peers used for types only**.
- `three-react` depends on `three`, and `three` never imports React.
- `react` and `react-dom` are always peer dependencies. No package depends on a router.
- Every package has `sideEffects` limited to CSS, is ESM only, and ships `exports` with
  `types`.

## 3. Toolchain baseline

Rule: take the latest version, **unless a peer range blocks it**. In that case, pin the
newest compatible version and record the blocker plus its re-check trigger in
`docs/adrs/0002-toolchain-baseline.md`. Versions below were read from the npm registry on
2026-09-26. **Re-read them in L1-1** with `npm view <pkg> version peerDependencies`;
if newer versions have appeared, the rule still applies.

| Package | Baseline | Note |
|---|---|---|
| react, react-dom | 19.3.0 | R3F 9.8.1 peers `>=19 <19.4` — watch before 19.4 |
| react-router | 8.4.0 | **replaces react-router-dom** (whose latest is 7.18.4; there is no 8.x `-dom`). 81 files import `react-router-dom` across vitavision and the calibration-rs app |
| typescript | **6.0.3 (not 7.0.2)** | Blocker: typescript-eslint 8.70.1 peers `typescript <6.1.0`. VAL goes **down** from ^7. Trigger: typescript-eslint admits 7 |
| vite / @vitejs/plugin-react | 8.3.1 / 6.1.1 | |
| vitest / @vitest/browser-playwright | 5.0.2 / 5.0.2 | VAL goes up from 4 |
| tailwindcss / @tailwindcss/vite | 4.3.3 / 4.3.3 | |
| eslint / typescript-eslint | 10.11.0 / 8.70.1 | plus `@eslint-react/eslint-plugin` 5.20.8, `eslint-plugin-react-hooks` 7.1.1, `eslint-plugin-storybook` 10.6.0 |
| eslint-plugin-jsx-a11y | **excluded** | Peer eslint ≤9, last release 2024-10. Accessibility is enforced by axe in story tests (§4) |
| storybook (+ addon-docs, addon-a11y) | 10.6.0 | **`@storybook/addon-vitest` excluded**: it peers vitest ^3‖^4. Stories are tested through `composeStories` in Vitest browser mode instead. Trigger: the addon admits vitest 5 |
| tsdown | 0.23.0 | Replaces tsup (F7). It is 0.x, so pin exactly |
| three / @types/three | 0.186.1 / 0.186.0 | **Exact pin**: three breaks on minor releases |
| @react-three/fiber / drei | 9.8.1 / 10.7.9 | |
| konva / react-konva | 10.7.0 / 19.3.0 | Only until the L6 decision |
| motion | 13.4.4 | Replaces `framer-motion` (same version line, renamed). Apps only, never in `ui` |
| radix-ui (umbrella) or @radix-ui/* | 1.6.7 / per package | Keep per-package imports; the umbrella is optional |
| lucide-react | 1.48.0 | |
| @playwright/test | 1.63.0 | plus `@axe-core/playwright` 4.13.0 |
| @changesets/cli | 3.0.3 | |
| size-limit | 14.0.1 | |
| @microsoft/api-extractor | 7.59.2 | API reports and TSDoc-completeness checks |
| publint / @arethetypeswrong/cli / knip | 0.3.24 / 0.18.5 / 6.38.0 | |
| bun | 1.4.2 | Pinned in `packageManager` |
| @tauri-apps/api / cli | 2.11.1 / 2.11.5 | calibration-rs and VAL |

TS compiler options for all repos, via `@vitavision/config-ts`: `strict`,
`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`,
`moduleResolution: "bundler"`, `jsx: "react-jsx"`.

## 4. Quality bar: component Definition of Done (checked in CI per package)

A component or module is "done" when **all** of the following hold:

1. **API.** Named exports only. React 19 ref-as-prop, with no `forwardRef`. Controlled
   and uncontrolled pairs follow the `value`/`defaultValue`/`onValueChange` convention.
   It accepts `className` merged with `cn`, and exposes state as `data-*` attributes.
   Links go through `asChild` (Radix `Slot`), never a router import. There is no module
   scope access to `window` or `document`.
2. **Docs.** Every exported symbol has TSDoc. The api-extractor report
   (`packages/*/etc/*.api.md`) is committed and has **0 `ae-undocumented` findings**;
   an API change without an updated report fails CI. Each component has a Storybook docs
   page covering purpose, when *not* to use it, props (autodocs), accessibility notes,
   and one story per meaningful state.
3. **Tests.**
   - Stories are the fixtures. `*.test.tsx` imports them via `composeStories` and runs
     interaction tests in Vitest browser mode (Chromium via `@vitest/browser-playwright`).
   - Pure logic (`*.ts`) has unit tests, with property tests where the domain allows it
     (view transforms, scales, schema mapping).
   - Coverage is **≥90% of lines for `*.ts` logic** and **≥80% for components**.
   - **Accessibility**: axe finds 0 serious or critical violations for every story, in
     both light and dark themes.
   - **SSR**: `renderToString` of every story runs in Node with 0 errors and 0 warnings.
   - **Visual regression**: Playwright screenshots of every story in both themes, on the
     **macOS runner only** because font rendering differs by OS, with
     `maxDiffPixelRatio ≤ 0.001`.
4. **Packaging.** publint reports 0 errors and attw reports 0 problems. Each package has a
   size-limit budget, set in L1 to the measured size +10% and failing CI on excess.
   knip reports 0 unused exports and dependencies.
5. **Lint and types.** 0 errors and 0 warnings. No `any`; `@ts-expect-error` only with a
   linked issue.

## 5. Visual language

`docs/visual-language.md` is the normative spec, and Storybook "Foundations" is its
living specimen. The starting point is lab-ui's existing principle: an *instrument*
design system with true-neutral greys, one accent (`signal`), and verdict colours
(`normal`/`defect`/`warn`) reserved for verdicts. Semantic tokens follow
lab-ui `styles.css` (`ground`, `surface`, `raised`, `overlay`, `line`, `canvas`, `fg*`,
`signal*`, radii `control`/`panel`).

The spec must add the following:

- **Type.** The repos currently disagree: IBM Plex Sans/Mono in lab-ui and VAL,
  Inter/Geist Mono in vitavision and calibration-rs, plus Source Serif in vitavision's
  editorial pages. Decision **D1** in §8 settles the default. Numerals are tabular, and
  the mono font uses a slashed zero.
- **Scales.** Spacing and type scales, plus density (`Density.tsx` exists; formalise
  compact and comfortable).
- **Data-visualisation palette.** Categorical and sequential colour-vision-safe palettes
  for charts, overlays and heatmaps, and the rule that overlay colours never reuse verdict
  colours.
- **Overlay grammar** for stage2d and three: stroke widths in *screen* pixels regardless
  of zoom, marker shapes per feature kind, and a selection/hover/dimmed state model.
- **Motion.** Shared packages use CSS transitions only and respect `prefers-reduced-motion`.
- **Boundary.** vitavision's editorial and blog pages keep their typography and layout.
  Only their tokens migrate: colours, radii, spacing. Everything interactive (editor,
  demos, canvas, forms) adopts the packages.

**Gate G5.1**: 0 raw Tailwind palette classes (for example `bg-gray-500` or
`text-blue-600`) and 0 hex literals in the component sources of migrated areas. It is
enforced by a lint rule in `@vitavision/config-eslint`, scoped to each app's migrated
directories list.

## 6. Phases and tickets

Format: `ID — title · Repo · Files · Done when`.

### L0 — Measure before changing

- **L0-1 — Concept matrix.** Repo: lab-ui. Files: `tools/inventory/{concepts.toml,matrix.ts}`.
  `concepts.toml` explicitly maps each concept (button, panel, table, select, dialog,
  tooltip, slider, schema-form, histogram, line-chart, image-stage, target-overlay,
  3d-frustum, …) to implementing file paths per repo. The mapping is explicit: no
  heuristics. `matrix.ts` renders `docs/measurements/concept-matrix.md`.
  Done when every in-scope repo is mapped. Also enumerate *all* of the user's GitHub repos
  with a `package.json` depending on `react` (`gh repo list` plus a code search) and
  report any missing from §0.
- **L0-2 — Dependency matrix.** Files: `tools/inventory/deps.ts` → `docs/measurements/deps.md`.
  Lists package × repo × version, flagging deviations from §3. Done when it runs in CI.
- **L0-3 — Stage benchmark harness.** Files: `tools/bench/stage2d/`. The scene is a
  20 MP image (5472×3648) with 20k point markers and 5k polyline segments; the workload
  is scripted continuous pan and zoom plus pointer-move hit-testing in Chromium on
  M-series.
  Candidates are (a) lab-ui SVG-over-DOM, (b) Konva with layer caching, and (c) batched
  Canvas2D layers; add (d) a WebGL points layer only if (a)–(c) all fail.
  Done when all candidates are measured and recorded (feeds L6-1).

### L1 — Monorepo and baseline in lab-ui

- **L1-1 — Toolchain ADR.** Re-verify §3 versions and write `docs/adrs/0002-toolchain-baseline.md`.
- **L1-2 — Workspace conversion.** Move `src/` into `packages/ui` (primitives, theme,
  tokens), `packages/forms` (`SchemaForm`, `api/schemaForm*`, `api/mapValues*`),
  `packages/charts` (`components/charts/*`), and `packages/stage2d` (`components/stage/*`,
  `ZoomPanCanvas`, `MeasureOverlay`, `measureGeometry`). Switch tsup → tsdown and add the
  shared config packages and changesets. `packages/lab-ui` becomes a re-export with a
  console-free deprecation notice in its README and a `deprecated` field on publish.
  Done when every existing test passes unchanged in its new location.
- **L1-3 — Router decoupling.** Give `Button` and `Panel` `asChild` via `@radix-ui/react-slot`
  and remove the `react-router` peer everywhere. This is a breaking change, recorded as a
  changeset minor for 0.x. Done when `grep -r "react-router" packages/*/src` is empty.
- **L1-4 — Storybook and test harness.** Covers `apps/storybook`, the composeStories +
  Vitest browser setup, axe, SSR render tests, and Playwright visual tests.
  Done when the §4 CI jobs exist and run on the moved components; failures are listed,
  not yet fixed.
- **L1-5 — Bring existing components to DoD.** One PR per package. Done when every §4
  gate is green for `ui`, `forms`, `charts` and `stage2d` (stage2d gets its API only;
  the engine is decided in L6).
- **L1-6 — Publish** `@vitavision/{ui,forms,charts,stage2d}@0.6.0` and the
  `lab-ui` compat package. Storybook is deployed to GitHub Pages. Done when
  `bun add` into a scratch Vite app renders every story.

### L2 — Upgrade the apps to the baseline (one PR per repo, before any component migration)

Order: VAL, then calib-targets-rs `studio`/`demo`, then calibration-rs `app`, then
vitavision. The last is last because of SSR and the router.

- **L2-n — Upgrade `<repo>`.** Apply §3 and `@vitavision/config-*`. This includes
  react-router-dom → react-router 8 (vitavision and calibration-rs), framer-motion → motion
  (vitavision, 4 files), TS 7 → 6.0.3 (VAL), and TS 5.8 → 6.0.3 (calib-targets).
  **No UI changes in this phase.**
  Done when:
  - typecheck, lint, unit and e2e tests are green;
  - L0-2 shows 0 deviations except documented exceptions;
  - Playwright screenshots of the app's main routes show `maxDiffPixelRatio ≤ 0.001`
    against the pre-upgrade baseline (captured first in the same PR);
  - the production bundle-size delta is reported;
  - for vitavision, the SSR build and `entry-server.test.tsx` are green.

### L3 — Visual language and `ui` adoption

- **L3-1 — `docs/visual-language.md` and Storybook Foundations** (tokens, type, scales,
  data-vis palette, overlay grammar), resolving D1.
  Done when the user approves the specimen page.
- **L3-2 — Token update in `ui`**, with contrast checks for every text/background token
  pair: **WCAG AA ≥ 4.5:1** for text and ≥ 3:1 for UI boundaries, in both themes, as
  unit tests.
- **L3-3..n — Adopt `ui` per app.** In calibration-rs, delete `app/src/components/ui/*`.
  In VAL, move to `@vitavision/ui`. In calib-targets studio, adopt it. In vitavision,
  migrate tokens for the editorial pages and components for the interactive areas.
  Done when the concept matrix shows 0 local implementations for the ui concepts in that
  repo and G5.1 holds in the migrated directories.

### L4 — Forms

- **L4-1 — Merge implementations.** Merge lab-ui `SchemaForm` and calibration-rs
  `configForm.tsx` into `@vitavision/forms`. Done when both apps' existing form tests
  pass against the package, **and** each schema in `calibration-rs/app/src/schemas/*.json`
  round-trips: the default value renders, then serialises back identical.
- **L4-2 — Schemas for the WASM detectors.** Upstream tickets in the Rust repos
  (chess-corners-rs, calib-targets-rs, ringgrid, radsym) ask them to ship the schemars
  JSON Schema of each config in their npm package. **These are drafts for user review.**
- **L4-3 — Replace vitavision's hand-written `*ConfigForm.tsx`** with schema-driven forms.
  Done when the forms are functionally identical: e2e tests set every field and produce
  the same config JSON as before.

### L5 — Charts

- **L5-1 — Consolidate** VAL `CurveChart`/`CompareCurves` and calibration-rs `Histogram`
  onto `@vitavision/charts`. Done when the concept matrix shows one implementation per
  chart concept.

### L6 — 2D stage

- **L6-1 — ADR: stage engine.** Choose the simplest candidate from L0-3 that passes
  gate **G6.1**: p95 frame time ≤ 16.7 ms during pan and zoom, and pointer hit-test
  p95 ≤ 2 ms, on the L0-3 scene. If none passes, add the WebGL candidate and re-measure.
- **L6-2 — Implement `stage2d`** on the chosen engine. The API is layered: an image layer,
  typed overlay layers (points, polylines, polygons, grids, heatmap), a hit-test API, the
  measure tool, and a view-transform core reused from lab-ui `stage/view.ts`.
  Done when §4 holds and G6.1 is re-measured on the package build.
- **L6-3..5 — Migrate** calibration-rs `FrameCanvas`, VAL `AnnotationCanvas`/`LiveStage`,
  and the vitavision editor canvas, one PR each. Done when each app's e2e tests pass,
  Konva is removed from that app's dependencies, and the concept matrix is updated.

### L7 — Overlays

- **L7-1 — `@vitavision/overlays`.** One generic target-overlay component parameterised
  by feature kind, replacing vitavision's Charuco/Chessboard/Markerboard/Puzzleboard/Radsym
  overlays (F6).
  Done when:
  - the jscpd intra-repo clone count in `vitavision/src/components/editor/**` drops to 0;
  - screenshot parity on the demo pages is ≤ 0.001.

### L8 — 3D

- **L8-1 — Build `@vitavision/three` and `@vitavision/three-react`** per etendue PLAN
  P2-2/P2-3, including the calibration-rs `Viewer3DWorkspace` extraction proof (P2-4).
  The gates are unchanged (G2.2 and the rest).

### L9 — Close-out

- **L9-1 — Final state.** Done when:
  - the concept matrix has exactly one implementation per concept across all repos;
  - `@vitavision/lab-ui` is marked deprecated on npm with 0 remaining consumers;
  - the dependency matrix shows 0 undocumented deviations.

### Promotion rule (standing)

A component enters the library only when a **second** app needs it now, and it moves
with its stories and tests. The WASM-worker wrapper pattern (F6) is the next candidate,
as `@vitavision/worker`. Promote it only when VAL or another app needs it.

## 7. Release and CI

- Changesets with independent versions, all 0.x. Every PR with a user-facing change
  carries a changeset.
- Every PR publishes preview packages via pkg.pr.new, so apps can try a change before
  release. Local cross-repo work uses `bun link`.
- CI jobs: lint, typecheck, unit + browser tests, axe, SSR, api-extractor, publint,
  attw, knip, size-limit, and visual tests (macOS), plus the monthly L0-2 report and the
  L0-3 benchmark as a regression job (fails on a >20% regression).

## 8. Decisions for the user (defaults apply if not answered)

- **D1 Type family.** IBM Plex Sans/Mono (lab-ui, VAL) vs Inter + Geist Mono
  (vitavision, calibration-rs). Default: render both in the Foundations specimen
  (L3-1) and the user picks. Source Serif stays for vitavision's editorial pages either way.
- **D2 Repo name.** Keep `lab-ui` or rename it to something like `vitavision-ui`. Default:
  keep it (GitHub redirects renames, but the packages move to new names regardless).
- **D3 Storybook deployment.** Default: GitHub Pages, public.

## 9. CLAUDE.md for lab-ui (create in L1-2)

Include the commands (`bun run {build,test,lint,typecheck,storybook,bench}`), the §2
layering rules, the §4 DoD as a checklist, and these constraints: one repo per PR, commit
only when asked, no speculative components (the promotion rule), no router imports in
packages, no module-scope DOM access, and version exceptions only through ADR-0002.
