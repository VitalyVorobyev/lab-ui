# stage2d layers against the frame and hit-test budget

What each `stage2d` overlay layer costs on the benchmark scene (`tools/bench/stage2d`, see
`stage2d-bench.md`), against the budget ADR-0004 sets: **presented and rAF frame time p95 ≤ 16.7 ms
during pan and zoom, pointer hit-test p95 ≤ 2 ms.**

**Machine:** Apple M4 Pro, 12 cores, 24 GB, macOS 26.6, Chromium 153.

**Scene:** a 5472×3648 image with 20,000 points and 250 polylines × 20 segments.

**Index timings:**
- They come from the `*Index.browser.test.ts` files. These run in CI with each package's browser project and are skipped under coverage, whose instrumentation slows them about 50×.
- Each sample is a batch of 50 queries, with 4000 seeded queries over the whole image.
- The timer is coarsened to 100 µs without cross-origin isolation, so per-query figures have 2 µs resolution.
- A band figure is the median of nine calls after one warm-up call.

## The package on the benchmark scene

**Method:**
- Headed Chromium at 1600×1000 CSS px @ 2×, three runs per candidate. The table reports the median by presented-frame p95.
- Run with `bun run.ts --only package,package-plus,a-batched --runs 3 --out <file>` in `tools/bench/stage2d`.
- Measured at `035677b`, then re-run at `97fbe12` after the label code moved into `labelLod.ts`.

| Candidate | Presented p95 (ms) | rAF p95 (ms) | Presented · partial · dropped | Render work p95 (ms) | Hit-test p95 (ms) |
|---|---|---|---|---|---|
| hand-built overlay, one path per layer | 9.27 | 9.27 | 1200 · 0 · 0 | 0.10 | 0.01 |
| `PointSet` (`dot`) + `PolylineSet`, `useStageHitTest` | 7.76 / 9.69 | 7.76 / 9.69 | 1440 · 0 · 0 / 1199 · 0 · 0 | 0.17 / 0.14 | 0.02 |
| `PointSet` (`plus`) + `PolylineSet`, `useStageHitTest` | 7.77 / 8.96 | 13.15 / 9.36 | 2708 · 1353 · 87 / 1909 · 711 · 3 | 7.71 / 5.89 | 0.02 |

**Reading:**
- **`dot` holds the display's refresh.** There are no partial or dropped frames. The render work over the hand-built overlay is the halo path under each batch, plus React reconciling the layers.
- **Compositor noise.** The compositor interval moves between about 7.8 and 9.8 ms from run to run, so the presented p95 moves with it.
- **Hit-testing is cheap.** It goes through the stage registry, which asks every pickable layer and ranks the answers, at about a hundredth of the budget.
- **`plus` costs more.** It is an outline sized in screen pixels, so its path is regenerated at every zoom step for the part of the scene near the viewport.
  - That costs 6–8 ms of render work a frame while zooming.
  - Its JS heap reached 140 MB from the path strings.
  - It passes, but a scene with far more outline markers would not.
  - The answer for that case is a Canvas2D backend for that one layer (ADR-0004). Prefer `dot` for dense scenes.

## Pick indexes

| Index | Items | Build | Hit p50 | Hit p95 | Band (1500×1000 px) |
|---|---|---|---|---|---|
| `polylineIndex` (radius 24 px) | 5,000 segments (250 × 20) | 1.9–2.0 ms | ≤ 2 µs | 2 µs | 0.1 ms |
| | 100,000 segments (20,000 × 5) | 10.7–11.1 ms | 2 µs | 6 µs | 0.3 ms |
| `pointIndex` (radius 21 px) | 20,000 points | 2.5 ms | ≤ 2 µs | 2 µs | 0.2 ms |
| | 100,000 points | 1.4 ms | ≤ 2 µs | 2 µs | 0.6 ms |
| `areaIndex` (radius 21 px, quads 20–60 px at random angles) | 20,000 quads | 7.8–8.3 ms | 2 µs | 6 µs | 0.2 ms |
| | 100,000 quads | 31.6–31.9 ms | 16–18 µs | 22–26 µs | 1.1–1.2 ms |

**Other costs:**
- **Label thinning.** Thinning points to 24 px for labels costs 3.4 ms at 20,000 points and 5.8 ms at 100,000.

**Reading:**
- **Each index is built once per change of its items, not per frame.**
- **Areas build slower.** An area is registered in every grid cell its bounding box covers, which is why its build is slower than the others.
- **The worst hit-test is still well under budget.** The worst case, 100,000 quads, is about 80× under the 2 ms limit.
- **Element-per-feature fails.** The per-element SVG form (candidate a) failed the hit-test half of the budget at 2.09 ms. The batched form with a grid index is what every layer uses.

## DOM cost

Counted by the `LargeSet` and `LargeGrid` stories, which run in CI.

| Scene | Elements |
|---|---|
| `AreaSet`, 4,000 quads in two roles | ≤ 8 `<path>`s, plus at most 200 label `<text>`s |
| `GridLayer`, 10,000 nodes (`dot`), about 19,800 edges | ≤ 8 `<path>`s: two edge batches, the node batch and their halos |
| `HeatmapLayer`, any raster | One `<img>`, rasterised once per change of its data into an object URL. The URL is revoked when replaced and on unmount. |

**Not measured:** frame times while panning a scene that draws `AreaSet` or `GridLayer`. Their strokes are screen-constant, so a zoom step re-renders them without regenerating the outlines.
