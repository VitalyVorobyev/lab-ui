# Plan: one component library, one visual language

The roadmap for `@vitavision/*` and the apps that consume it.
- **How to work** (rules, definition of done, workflow): [CLAUDE.md](../../CLAUDE.md).
- **Decisions:** [docs/adrs/](../adrs/).
- **Design spec:** [docs/visual-language.md](../visual-language.md).
- **Open issues:** the GitHub tracker.
- **History:** the full ticket text and done notes of every phase are in
  `git log -- docs/plan/PLAN.md`; the last long version is at commit `d4edfd6`.

## Goal

1. **One home for shared UI.** The shared React UI of the vitavision apps lives here, as independently published `@vitavision/*` packages.
2. **One toolchain.** Every React frontend is on one toolchain baseline: [ADR-0002](../adrs/0002-toolchain-baseline.md), `tools/inventory/baseline.toml`.
3. **One visual language.** Every React frontend speaks one visual language, and an app deletes its local version of a concept once it uses the package's.
4. **One quality bar.** Every shared component meets the definition of done.

## Consumers

The `in_plan` repos are mapped in `tools/inventory/concepts.toml`, and their local versions of each concept are counted in
`docs/measurements/concept-matrix.md` (`bun run inventory:concepts`).

| Repo | Frontend | Uses (default branch, 2026-10-04) |
|---|---|---|
| visual-anomaly-lab | `frontend/` | ui, forms, charts, stage2d |
| vitavision | `/` (server-rendered) | ui, forms, stage2d, overlays |
| calibration-rs | `app/` | ui, forms, charts, stage2d, three, three-react |
| calib-targets-rs | `studio/`, `demo/` | ui (studio); none yet (demo) |
| vision-metrology | `lab/frontend/` | ui, charts, stage2d, workbench |
| caliperbench | `frontend/` | ui, forms, charts, stage2d |
| etendue | `web/apps/studio` | ui, charts, stage2d, workbench, three, three-react |

## Done

| Phase | Outcome |
|---|---|
| L0 | Concept matrix, dependency matrix, stage benchmark |
| L1 | The monorepo, toolchain baseline, Storybook and every CI gate, first publish |
| L2 | Every app upgraded to the baseline |
| L3 | The visual language (IBM Plex, ADR-0003), tokens with contrast tests, `ui` adopted in every app |
| L4 | `SchemaValueForm`; schema-driven detector forms in vitavision |
| L5 | Charts consolidated (`Histogram`, interaction, colour maps) |
| L6 | Stage engine (ADR-0004); point, polyline, area, grid and heatmap layers with one hit-test; three apps off Konva |
| L7 | `@vitavision/overlays`: one `TargetOverlay` for every calibration target |
| L8 | `@vitavision/three` and `three-react` |
| W | `@vitavision/workbench` (ADR-0005) |
| U | What vision-metrology's lab and caliperbench needed: editors, layers menu, image layer, polyline set, overlay roles, chart interaction, sequence navigator |
| L9-1 (part) | `@vitavision/lab-ui` retired; deprecated on npm |

## Open

### L9-1: close-out

Done when:
- the concept matrix shows exactly **one implementation per concept** across the in-scope repos;
- the dependency matrix (`bun run inventory:deps`) shows **0 undocumented deviations**.

What the matrix still counts is mostly local versions in vision-metrology's lab and caliperbench of
things the packages now ship:
- the stage handle and layers menu
- the polyline set and tool model
- the sequence navigator
- chart interaction and colour maps
- a status bar, nav rail and stepper
- the datum layer and image comparison

### Adoption, one PR per app in that app's repo

- **vision-metrology lab and caliperbench.** Move onto the stage2d editors and layers, the charts interaction, and the workbench pieces. Delete each local version, and update `concepts.toml` here.
- **Re-measure.** After each adoption, re-run `inventory:concepts` and `inventory:deps` and commit the regenerated reports.

### Candidates

- **`@vitavision/worker`.** The WASM-worker wrapper pattern that vitavision repeats for each detector. Build it once a second detector app wants it.

## Ideas, not scheduled

- Preview packages for every PR (pkg.pr.new), so an app can try a change before release.
- The stage2d benchmark as a CI regression job that fails on a > 20 % regression.

## Decisions

- **D1, type family:** IBM Plex Sans + IBM Plex Mono (ADR-0003).
- **D2, repo name:** keep `lab-ui`. This is the default; it was never asked to change.
- **D3, Storybook:** GitHub Pages, public. Live at https://vitalyvorobyev.github.io/lab-ui/.
