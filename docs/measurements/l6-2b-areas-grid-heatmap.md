# L6-2b: `AreaSet`, `GridLayer`, `HeatmapLayer` and the shape tools against G6.1

L6-2 (part b) adds the area, grid and heatmap layers, the rotated `ShapeEditor`, `DraftShape` /
`MarqueeRect` and `useShapeDrag`. This records the G6.1 re-measurement for what is new on the hot
path (the area index), a regression run of the part-(a) layers that this change touched (the label
level-of-detail code moved out of `PointSet` into `labelLod.ts`), and what the new layers cost in the DOM.

| | |
|---|---|
| lab-ui base | `97fbe12` (branch `feat/stage2d-areas-grid-heatmap`) |
| Machine | Apple M4 Pro, 12 cores, 24 GB, macOS 26.6 |
| Browser | Chromium 153.0.8010.12 |

## The package build on the L0-3 scene (regression)

Headed Chromium at 1600×1000 CSS px @ 2×, three runs per candidate, the median by presented-frame
p95 reported, as in `l6-2a-points-hit-test.md`. Run with
`bun run.ts --only package,package-plus --runs 3 --out <file>` in `tools/bench/stage2d`. This scene
has points and polylines only; it checks that the shared label code did not slow the part-(a) layers.

| Candidate | Presented p95 (ms) | rAF p95 (ms) | Presented · partial · dropped | Render work p95 (ms) | Hit-test p95 (ms) | G6.1 |
|---|---|---|---|---|---|---|
| (p) `PointSet` (dot) + `PolylineSet`, `useStageHitTest` | **9.69** | 9.69 | 1199 · 0 · 0 | 0.14 | **0.02** | pass |
| (p+) `PointSet` (`plus`) + `PolylineSet`, `useStageHitTest` | **8.96** | 9.36 | 1909 · 711 · 3 | 5.89 | **0.01** | pass |

Gate: presented p95 ≤ 16.7 ms and rAF p95 ≤ 16.7 ms, hit-test p95 ≤ 2 ms.

**Reading.** Both pass with the same shape as in part (a): the `dot` marker holds the display's
refresh with no partial or dropped frames and 0.14 ms of render work; the `plus` marker, whose outlines are
regenerated at each zoom step, costs 5.9 ms of render work a frame and drops 3 of 1,912. The compositor
interval moves between roughly 7.8 and 9.8 ms from run to run on this machine (part (a) saw 7.76 and 9.27 for the
same layers), so the 9.69 against 7.76 is not a regression in the code that was moved: render work is 0.14 against
0.17 ms.

## The area index

`areaIndex.browser.test.ts` (in CI with the package's browser project; skipped under coverage), batches of
50 queries per sample, 4000 seeded queries over the whole 5472×3648 image, radius 21 image px (6 screen px at fit
on a 1600 px viewport). The scene is marker quads 20 to 60 px across at random angles; a query tests the polygons whose
bounding box is near the pointer for containment and for the distance to the outline. Three runs:

| Quads | Index build | Hit p50 | Hit p95 | Band (1500×1000 px) |
|---|---|---|---|---|
| 20,000 | 7.8–8.3 ms | 2 µs | 6 µs | 0.2 ms |
| 100,000 | 31.6–31.9 ms | 16–18 µs | 22–26 µs | 1.1–1.2 ms |

The hit-test p95 is about 80 to 330 times under the 2 ms gate. The timer is coarsened to 100 µs without cross-origin
isolation, so the per-query figures have a resolution of 2 µs. The index is built once per change of the items, not
per frame. `PointSet`'s index builds 20,000 points in 2.5 ms; a polygon is registered in every grid cell its
bounding box covers, which is what the extra time buys.

## What the layers cost in the DOM

Counted by the stories (`LargeSet`, `LargeGrid`), which run in CI: batching by appearance holds for the new layers.

| Scene | Elements |
|---|---|
| `AreaSet`, 4,000 quads in two roles | ≤ 8 `<path>`s, plus at most 200 label `<text>`s |
| `GridLayer`, 10,000 nodes (`dot`) and about 19,800 edges | ≤ 8 `<path>`s: two edge batches, the node batch and their halos |
| `HeatmapLayer`, any raster | one `<img>`; rasterised once per change of its data, in an effect, into an object URL that is revoked when replaced and on unmount |

Not measured here: frame times of a scene that draws `AreaSet` or `GridLayer` while panning (the bench scene has
none). The area layer's strokes are screen-constant and its outlines do not depend on the zoom, so a zoom step
re-renders without regenerating them; only the optional `firstVertexTick` is rebuilt per zoom step, in O(areas).
