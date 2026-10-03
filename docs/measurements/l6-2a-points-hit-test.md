# L6-2a: `PointSet` and the stage hit-test against G6.1

L6-2 (part a) adds `PointSet`, one hit-test across layers (`useStageHitTest`) and touch and
right-button input to `ImageStage`. This records the G6.1 re-measurement for the point layer: the
L0-3 scene rendered by the package's own layers, and the point index on its own.

| | |
|---|---|
| lab-ui base | `035677b` (branch `feat/stage2d-points-hittest`) |
| Machine | Apple M4 Pro, 12 cores, 24 GB, macOS 26.6 |
| Browser | Chromium 153.0.8010.12 |
| Scene | L0-3: 5472×3648 image, 20,000 points, 250 polylines × 20 segments (`tools/bench/stage2d`) |

## The package build on the L0-3 scene

Headed Chromium at 1600×1000 CSS px @ 2×, three runs per candidate, the median by presented-frame
p95 reported, as in `stage2d-bench.md`. Run with
`bun run.ts --only package,package-plus,a-batched --runs 3 --out <file>` in `tools/bench/stage2d`
(these candidates are not in the default run).

| Candidate | Presented p95 (ms) | rAF p95 (ms) | Presented · partial · dropped | Render work p95 (ms) | Hit-test p95 (ms) | G6.1 |
|---|---|---|---|---|---|---|
| (a′) hand-built overlay, one path per layer (this run) | 9.27 | 9.27 | 1200 · 0 · 0 | 0.10 | 0.01 | pass |
| (p) `PointSet` (dot) + `PolylineSet`, `useStageHitTest` | **7.76** | 7.76 | 1440 · 0 · 0 | 0.17 | **0.02** | pass |
| (p+) `PointSet` (`plus`) + `PolylineSet`, `useStageHitTest` | **7.77** | 13.15 | 2708 · 1353 · 87 | 7.71 | **0.02** | pass |

Gate: presented p95 ≤ 16.7 ms and rAF p95 ≤ 16.7 ms, hit-test p95 ≤ 2 ms.

**Reading.**
- With the `dot` marker the package holds the display's 120 Hz with no partial or dropped
  frames, and its render work is 0.17 ms a frame against 0.10 ms for the hand-built overlay. The
  difference is the halo (a second path under each batch) and React reconciling the layers on
  each view change. (a′ presented at 7.76 ms in the L0-3 run and 9.27 ms here; the compositor
  interval moves between 7.76 and 9.3 ms from run to run.)
- The hit-test goes through the stage registry, which asks both layers (a point grid and a
  segment grid) and ranks the answers. It costs 0.02 ms, a hundredth of the gate.
- The `plus` marker is an outline sized in screen pixels, so its path is regenerated at every
  zoom step, for the part of the scene near the viewport. That costs 7.7 ms a frame on this scene
  while zooming (the workload zooms for 6 of its 10 s), 45× the dot. It passes the gate (rAF p95
  13.2 ms), but 3 % of its frames dropped and half were partial, and the JS heap reached 140 MB
  from the strings. A scene with many more outline markers than 20,000 would fail; the answer
  ADR-0004 gives for that is a Canvas2D drawing backend for the one layer, behind the same props.
  Prefer `dot` for dense scenes.

## The point index

`pointIndex.browser.test.ts` (in CI with the package's browser project; skipped under coverage),
batches of 50 queries per sample, 4000 seeded queries over the whole image, radius 21 image px
(6 screen px at fit on a 1600 px viewport).

| Points | Index build | Hit p50 | Hit p95 | Band (1500×1000 px) | Thinning to 24 px (labels) |
|---|---|---|---|---|---|
| 20,000 | 2.5 ms | ≤ 2 µs | 2 µs | 0.2 ms | 3.4 ms |
| 100,000 | 1.4 ms | ≤ 2 µs | 2 µs | 0.6 ms | 5.8 ms |

The timer here is coarsened to 100 µs without cross-origin isolation, so per-query times have a
resolution of 2 µs; the bench page is cross-origin isolated and measures the same query path in
the table above.
