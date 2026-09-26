# Stage2D benchmark: reading the numbers (L0-3 → L6-1)

The raw results are in [stage2d-bench.md](stage2d-bench.md), and the method is in `tools/bench/stage2d/README.md`.
The measurement was taken on 2026-09-26, on an Apple M-series machine with a 120 Hz display.

**Summary: the batched engines (`a-batched` and `c`) pass G6.1 with a wide margin, and every Konva variant fails it.**

## Batched: pass

**Canvas2D (c)** and **SVG with one path per layer (a′)** both pass. Both hold 120 Hz: presented-frame p95 is about 7.8 ms, with 0 dropped and 0 partial frames. Hit-tests cost about 10 µs through the grid index.

- Canvas2D does **0.04 ms** of main-thread work per frame and mounts in 3 ms.
- The SVG stage does 0.14 ms of work per frame and mounts in about 90 ms.
- Across runs, Canvas2D was the most stable.

## lab-ui SVG, one element per feature: frames pass, hit-test fails

For **lab-ui SVG with one element per feature (a)**, frame rendering passes. Median p95 is 9 ms, although one run of three hit 17 ms, and 719 of about 1,900 frames were presented *partial*. Its native DOM hit-test (`elementFromPoint` over 20k elements) fails at **p95 ≈ 2.1 ms**, just over the 2 ms gate.

The engine is fine. What does not scale is the "one element per feature" layout plus native hit-testing.

## Konva: fail

All **Konva** variants fail by 4×:

| | Presented p95 | Frames dropped |
|---|---|---|
| With layer caching (b) | 62 ms | about half |
| Without caching (b′) | 69 ms | about 80% |

Hit-tests take 6–14 ms. Per-node scene-graph drawing of 25k nodes is the cost. Layer caching only helps during pure pans, because every zoom step invalidates the cache.

## Implication for L6-1

PLAN asks for the simplest candidate that passes. There are two:

1. **SVG batched (a′).** This keeps lab-ui's existing `ImageStage` and view core. Overlays would render one path per layer, with a JS spatial index for hit-testing, instead of per-element SVG.
2. **Canvas2D (c).** This costs the least per frame and has headroom for heatmaps and larger scenes. It needs its own text and label rendering and accessibility work.

L6-1 should weigh those two. Konva is ruled out, which supports removing it from vitavision and VAL in L6-3..5. The WebGL candidate (d) is not needed.

Both batched variants hit-test through the same grid index. The hit-test result is therefore a property of the data structure, not of the engine.
