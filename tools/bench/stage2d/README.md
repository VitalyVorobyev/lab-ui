# stage2d benchmark (PLAN L0-3)

The measurement that feeds the stage-engine ADR (L6-1). It renders one scene through several
engines and times what matters for an inspection viewer: whether pan and zoom stay smooth, and
how quickly the thing under the pointer can be found.

```sh
bun install
bun run bench                    # build, then 3 headed runs per candidate → docs/measurements/stage2d-bench.md
bun run.ts --only c,a --runs 5   # a subset, after a build
bun run dev                      # open http://localhost:5173/?candidate=c to watch one
```

## Scene (`src/scene.ts`)

- The image is 5472×3648 (20 MP), a deterministic grey-level test image.
- There are 20,000 point markers and 5,000 polyline segments (250 polylines × 20 segments). All of them come from a seeded PRNG.
- Overlay geometry is screen-constant, as the §5 overlay grammar requires: markers are 6 px across and strokes are 1.5 px wide at every zoom.

## Workload (`src/workload.ts`)

The view is a pure function of elapsed time, so a slow engine skips ahead instead of stretching
the script. The 10 s script is:

| Time | Motion |
|---|---|
| 0–4 s | Orbiting pan at 2× fit |
| 4–8 s | Zoom between fit and 16× fit |
| 8–10 s | Pan and zoom at once |

Every frame also hit-tests the point marker under a pointer that sweeps the viewport. One
second of the same motion runs first and is discarded, as warm-up.

## Candidates (`src/candidates/`)

| id | Engine | Hit-test |
|---|---|---|
| `a` | lab-ui `ImageStage` (this repo's `src/`): DOM `<img>` plus an SVG with one element per feature and non-scaling strokes | `document.elementFromPoint` |
| `a-batched` | Same stage, with one SVG `<path>` per layer | Uniform grid |
| `b` | Konva with one node per feature, as vitavision and VAL build it. The overlay layer is cached while the scale holds still | Konva hit canvas |
| `b-nocache` | Same as `b`, without the cache | Konva hit canvas |
| `c` | Canvas2D: one canvas, with each layer a single pre-built `Path2D` stroked once per frame | Uniform grid |

The WebGL candidate (d) is only built if every candidate above fails G6.1. None does.

## Method

- **Frame time** comes from two sources:
  - Chrome's own per-frame verdicts (`PipelineReporter` in a trace): presented, partial, dropped, checkerboarded. From these the runner computes the interval between *presented* frames.
  - The main thread's rAF interval.

  Both are needed. A DOM/SVG layer is rasterized off the main thread, so rAF alone can look perfect while the screen stutters. G6.1 requires both p95 values to be ≤ 16.7 ms.
- **Hit-test time** is the synchronous time for one hit-test per frame, with `performance.now()` at 5 µs resolution (the page is cross-origin isolated).
- **Setup.** Headed Chromium at 1600×1000 CSS px and 2× DPR. Each run gets a fresh page. The median of 3 runs is reported.
- **Refresh rate.** On a ProMotion display the frame budget is 8.3 ms. Scores well under 16.7 ms mean 120 Hz is being held.
