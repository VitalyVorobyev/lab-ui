/**
 * The hit-test gate (G6.1: pointer hit-test p95 ≤ 2 ms) for the area layer, measured in
 * Chromium on 20,000 and 100,000 marker quads over the L0-3 image. The numbers are recorded
 * in `docs/measurements/l6-2b-areas-grid-heatmap.md`. As in `pointIndex.browser.test.ts`, the
 * assertion is the gate itself, so a slow CI machine does not flake it while a real regression
 * still fails.
 *
 * Skipped in the coverage run: V8 precise coverage slows this code by an order of magnitude,
 * so a timing would measure the instrumentation, not the index.
 */

import { describe, expect, it } from "vitest";
import { server } from "vitest/browser";

import { areasInRect, buildAreaIndex, nearestArea, type Area } from "./areaIndex";

const WIDTH = 5472;
const HEIGHT = 3648;

function scene(count: number, seed: number): Area[] {
  let s = seed;
  const random = () => {
    s = (s * 1103515245 + 12345) % 2 ** 31;
    return s / 2 ** 31;
  };
  return Array.from({ length: count }, (_, id) => {
    // A marker quad 20 to 60 px across, turned by a random angle.
    const cx = random() * WIDTH;
    const cy = random() * HEIGHT;
    const r = 10 + random() * 20;
    const a = random() * Math.PI;
    const points = [0, 1, 2, 3].flatMap((k) => [cx + r * Math.SQRT2 * Math.cos(a + (k * Math.PI) / 2), cy + r * Math.SQRT2 * Math.sin(a + (k * Math.PI) / 2)]);
    return { id, points: new Float32Array(points) };
  });
}

function percentile(values: number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
}

function measure(count: number, label: string) {
  const items = scene(count, count);
  const t0 = performance.now();
  const index = buildAreaIndex(items);
  const build = performance.now() - t0;
  // At fit on a 1600 px wide viewport, 6 screen px is about 21 image px.
  const radius = 21;
  // One query is far below the browser's coarsened timer, so time batches of 50 and take
  // each batch's mean as a sample.
  const BATCH = 50;
  const times: number[] = [];
  let found = 0;
  let s = 7;
  for (let b = 0; b < 4000 / BATCH; b++) {
    const queries: { x: number; y: number }[] = [];
    for (let q = 0; q < BATCH; q++) {
      s = (s * 1103515245 + 12345) % 2 ** 31;
      const x = (s / 2 ** 31) * WIDTH;
      s = (s * 1103515245 + 12345) % 2 ** 31;
      queries.push({ x, y: (s / 2 ** 31) * HEIGHT });
    }
    const start = performance.now();
    for (const q of queries) if (nearestArea(index, q, radius)) found++;
    times.push((performance.now() - start) / BATCH);
  }
  // A band is one call: warm it once and take the median of nine.
  const rect = { x: 1000, y: 800, width: 1500, height: 1000 };
  areasInRect(index, rect);
  const bands: number[] = [];
  for (let k = 0; k < 9; k++) {
    const start = performance.now();
    areasInRect(index, rect);
    bands.push(performance.now() - start);
  }
  const p50 = percentile(times, 0.5);
  const p95 = percentile(times, 0.95);
  const band = percentile(bands, 0.5);
  console.info(
    `${label}: build ${build.toFixed(1)} ms · hit p50 ${(p50 * 1000).toFixed(1)} µs · p95 ${(p95 * 1000).toFixed(1)} µs · ` +
      `${found}/4000 hits · band ${band.toFixed(2)} ms`,
  );
  return { p95, band };
}

describe.skipIf(server.config.coverage.enabled)("AreaSet hit-test gate (G6.1)", () => {
  it("20,000 marker quads", () => {
    const { p95, band } = measure(20_000, "20k quads");
    expect(p95).toBeLessThanOrEqual(2);
    expect(band).toBeLessThanOrEqual(16.7);
  });

  it("100,000 marker quads", () => {
    const { p95, band } = measure(100_000, "100k quads");
    expect(p95).toBeLessThanOrEqual(2);
    // Five times the 20k scene, far past any real one: the band only guards against an
    // accidental O(n²) here (CI runners measure about 22 ms, an M4 about 1.2 ms). The
    // frame-budget gate is the 20k case above.
    expect(band).toBeLessThanOrEqual(100);
  });
});
