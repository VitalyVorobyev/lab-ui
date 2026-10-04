# ADR-0004: The 2D stage stays SVG over a DOM image, with batched overlay layers

- Status: Accepted
- Date: 2026-10-03
- Plan: `docs/plan/PLAN.md` §6, ticket L6-1
- Data: `docs/measurements/stage2d-bench.md` (L0-3), `docs/measurements/stage2d-bench-analysis.md`,
  `docs/measurements/stage2d-layer-budgets.md`

## Context

L6-1 asks for the **simplest** stage engine from the L0-3 benchmark that passes gate **G6.1**:
presented-frame p95 ≤ 16.7 ms during continuous pan and zoom, and pointer hit-test p95 ≤ 2 ms,
on a 20 MP image (5472×3648) with 20k point markers and 5k polyline segments.

The benchmark measured four candidates on an Apple M4 Pro in Chromium at 120 Hz:

| Candidate | Presented p95 | Render work p95 | Hit-test p95 | Mount | G6.1 |
|---|---|---|---|---|---|
| (a) `ImageStage`: DOM image + SVG, one element per feature | 9 ms (one run of three: 17 ms) | 0.28 ms | 2.09 ms (DOM) | 141 ms | fail |
| (a′) `ImageStage`: DOM image + SVG, one path per layer | 7.76 ms | 0.14 ms | 0.01 ms (grid) | 91 ms | **pass** |
| (b) Konva, node per feature, cached while panning | 62.5 ms | 30.9 ms | 6.5 ms | 157 ms | fail |
| (b′) Konva, node per feature, no caching | 69.4 ms | 35.6 ms | 14.3 ms | 158 ms | fail |
| (c) Canvas2D, batched `Path2D` layers | 7.77 ms | 0.04 ms | 0.01 ms (grid) | 3 ms | **pass** |

Two candidates pass, and both hold the display's 120 Hz with no dropped or partial frames. Two
things decide the outcome, and the engine is neither of them:

- **Batching.** One drawable per layer instead of one per feature. The same SVG engine fails
  with an element per feature (a) and passes with a path per layer (a′).
- **Picking through a spatial index**, not through the renderer. The hit-test number in both
  passing rows belongs to the same uniform-grid index. U-4 reproduced it in the package:
  `nearestPolyline` answers in 2 µs at p95 on 100k segments, about 300× under the gate.

Konva's scene graph costs 30 ms of work per frame at this scene size, and layer caching does not
help once the user zooms. It fails by about 4×. The WebGL candidate (d) was to be added only if
(a)–(c) all failed, so it was not built.

## Decision

**`stage2d` keeps its current engine: an HTML image under an SVG overlay, positioned by the
view-transform core in `stage/view.ts`.** That is candidate (a′), and the following rules hold
for every overlay layer the package ships:

1. **Batch by appearance.** A layer that can hold more than a few hundred items draws one
   `<path>` per combination of visual state and style, not one element per item. `PolylineSet` is the reference: hover, selected and dimmed are separate
   batched paths.
2. **Pick through a pure index.** A layer resolves the pointer with a geometric query over a
   spatial index built once per change of its items (the `polylineIndex.ts` pattern), never with
   `document.elementFromPoint` or per-element event handlers. The index module imports no React
   and no DOM.
3. **Per-item elements are for the few.** Handles, the hovered item's highlight, a selected
   item's label and editing affordances may be their own elements, because their count does not
   grow with the scene.
4. **Strokes and markers are sized in screen pixels** (`useScreenPx`), per the overlay grammar in
   `visual-language.md`, so a batched path does not need re-generating on zoom.
5. **Rasters are images.** A heatmap, mask or response map is an image layer (`ImageLayer`, or a
   bitmap the app renders off-thread), not vector geometry.

### Why (a′) and not (c)

(c) does less work per frame (0.04 ms against 0.14 ms) and mounts in 3 ms instead of 91 ms.
Neither number is visible to the user: both stages present every frame at 120 Hz, and the mount
happens once per image. Against that, a Canvas2D stage would have to rebuild what SVG gives for
free and what the package already relies on:

- **Theme tokens.** SVG strokes take CSS custom properties directly, so overlay roles
  (`overlayRole.ts`) and dark mode work with no repaint logic. A canvas resolves every token in
  JavaScript and repaints on a theme change.
- **Text.** Labels, readouts and measurement captions are SVG text with the app's fonts and
  tabular numerals. On a canvas they need their own layout and high-DPI handling.
- **Accessibility and testing.** Handles and editors (`RectRoiEditor`, `ContourEditor`,
  `MeasureOverlay`) are focusable elements with roles, and tests query them as such.
- **Vector output.** What an SVG stage draws can be serialised as SVG, as true vector geometry.
  A canvas can only hand over a raster.
- **Existing code.** `ImageStage`, `StageSurface`, `ImageLayer`, `PolylineSet`, `RectRoiEditor`,
  `MeasureOverlay`, `ContourEditor` and `MaskEditor` are all SVG today (U-2..U-5 shipped on it).
  (a′) is the simplest candidate because it is the one already built.

### When to revisit

If a consumer's real scene fails G6.1 on (a′), for example hundreds of thousands of visible
markers, that **one layer** gets a Canvas2D drawing backend behind the same layer props. The
rules above make that a local change: the index, the selection model and the props stay, and
only the drawing moves (`stage2d-layer-budgets.md` makes the same point for `PolylineSet`). A move of
the whole stage to Canvas2D, or adding WebGL, needs a new ADR with a benchmark of that scene.

## Consequences

- **Konva leaves the apps.** L6-3..5 migrate calibration-rs `FrameCanvas`, VAL's annotation
  canvas and vitavision's editor canvas off Konva onto `stage2d`, and remove the dependency.
- **L6-2 is a completion ticket, not a rewrite.** The engine, view core, image layer, polyline
  layer, ROI and measure tools exist. What the PLAN's layer list still lacks, each following the
  rules above:
  - a **point layer**: many markers in a few batched paths, with a marker shape per feature kind
    (the overlay grammar), hover/selected/dimmed states and a grid index, plus a rubber band;
  - a **grid layer**: a lattice of labelled corners with its edges, for calibration targets;
  - a **heatmap layer**: a scalar field shown through a sequential colour map (the `charts`
    `viridis`/`cividis` maps), as an image;
  - one **hit-test API** across layers, so a stage can ask "what is under the pointer" without
    each app arbitrating between layers.
  L6-2 is done when §4 holds for these and G6.1 is re-measured on the package build, on the L0-3
  scene, with the bench's (a′) candidate replaced by the package's own layers.
- **L7-1 builds on the point and grid layers.** Target-specific glyphs (ArUco cells, ring
  markers, directed points) become path generators that feed a batched layer, not components
  per marker.
- **The bench should become the regression job** PLAN §7 describes. It is not in CI yet. Until
  it is, a change that breaks batching shows up only when someone re-runs `bun run bench`.
