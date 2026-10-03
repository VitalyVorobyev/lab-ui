# U-4: `PolylineSet` hit-testing against G6.1

`PolylineSet` (stage2d) draws many selectable polylines as a few batched paths and resolves the
pointer through a uniform grid of segments (`polylineIndex.ts`), not through the DOM. This
records the hit-test half of gate **G6.1** (pointer hit-test p95 ≤ 2 ms) for that index, on the
L0-3 scene's polyline layer and on a 20k-polyline stress scene.

| | |
|---|---|
| lab-ui commit | `1c80af5` (branch `feat/stage2d-u4-tool-model-polyline-set`) |
| Machine | Apple M4 Pro, macOS 26.6.2 |
| Browser | Chromium (Playwright 1.63, Vitest browser mode, headless) |
| Test | `packages/stage2d/src/components/polylineIndex.browser.test.ts` (runs in CI with the package's browser project; skipped under coverage, whose instrumentation slows it about 50×) |
| Image | 5472×3648, the L0-3 frame size |
| Query | `nearestPolyline` within 24 image px, about 7 screen px at fit on a 1600 px viewport; 4000 seeded points over the whole image |
| Timing | Batches of 50 queries per sample. One query is below the coarsened timer (100 µs without cross-origin isolation), so per-query times have 2 µs resolution. |

| Scene | Segments | Index build | Hit p50 | Hit p95 | Band (1500×1000 px) | G6.1 hit-test |
|---|---|---|---|---|---|---|
| L0-3 polyline layer: 250 polylines × 20 segments | 5,000 | 1.9–2.0 ms | ≤ 2 µs | 2 µs | 0.2 ms | pass |
| Stress: 20,000 polylines × 5 segments | 100,000 | 10.7–11.1 ms | 2 µs | 6 µs | 0.3–0.6 ms | pass |

The table gives the range over three runs.

**Reading.**
- The hit-test sits about 300× under the 2 ms gate even at 20k polylines.
- The index is built once per change of `items`, not per frame: 11 ms for 100k segments,
  about one frame.
- A rubber band is one gesture, not one per frame, and costs under a millisecond.
- The per-element SVG form, candidate (a) in `stage2d-bench.md`, failed this half of the gate
  at 2.09 ms. The batched form with a grid index, (a′) and (c), passed at 0.01 ms. That is the
  form `PolylineSet` takes.

**Engine-agnostic (L6-1).** The stage engine ADR is still open. `PolylineSet` draws with SVG
paths batched per state and colour, which is candidate (a′). Picking goes through
`polylineIndex.ts`, a pure module, which a Canvas2D engine (c) would reuse unchanged. Moving to
(c) would replace only the drawing, not the index or the selection model.

Frame time, the other half of G6.1, is not re-measured here. The rendering is the (a′) shape,
which `stage2d-bench.md` measured at a presented p95 of 7.76 ms.
