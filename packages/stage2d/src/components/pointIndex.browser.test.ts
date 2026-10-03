/**
 * The hit-test gate (G6.1: pointer hit-test p95 ≤ 2 ms) for the point layer, measured in
 * Chromium on the L0-3 scene's marker count and on a 100k-point stress scene. The numbers
 * are recorded in `docs/measurements/l6-2a-points-hit-test.md`. As in
 * `polylineIndex.browser.test.ts`, the assertion is the gate itself, so a slow CI machine
 * does not flake it while a real regression still fails.
 *
 * Skipped in the coverage run: V8 precise coverage slows this code by an order of magnitude,
 * so a timing would measure the instrumentation, not the index.
 */

import { describe, expect, it } from "vitest";
import { server } from "vitest/browser";

import { buildPointIndex, nearestPoint, pointsInRect, thinPoints } from "./pointIndex";

const WIDTH = 5472;
const HEIGHT = 3648;

function scene(count: number, seed: number): Float32Array {
  let s = seed;
  const random = () => {
    s = (s * 1103515245 + 12345) % 2 ** 31;
    return s / 2 ** 31;
  };
  const xy = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    xy[2 * i] = random() * WIDTH;
    xy[2 * i + 1] = random() * HEIGHT;
  }
  return xy;
}

function percentile(values: number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
}

function measure(count: number, label: string) {
  const xy = scene(count, count);
  const t0 = performance.now();
  const index = buildPointIndex(xy);
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
    for (const q of queries) if (nearestPoint(index, q.x, q.y, radius)) found++;
    times.push((performance.now() - start) / BATCH);
  }
  // A band is one call: warm it once and take the median of nine.
  const rect = { x: 1000, y: 800, width: 1500, height: 1000 };
  pointsInRect(index, rect);
  const bands: number[] = [];
  for (let k = 0; k < 9; k++) {
    const start = performance.now();
    pointsInRect(index, rect);
    bands.push(performance.now() - start);
  }
  // Labels: thin every point to 24 screen px (about 84 image px at fit), once per zoom.
  thinPoints(xy, 84);
  const thinStart = performance.now();
  thinPoints(xy, 84);
  const thin = performance.now() - thinStart;
  const p50 = percentile(times, 0.5);
  const p95 = percentile(times, 0.95);
  const band = percentile(bands, 0.5);
  console.info(
    `${label}: build ${build.toFixed(1)} ms · hit p50 ${(p50 * 1000).toFixed(1)} µs · p95 ${(p95 * 1000).toFixed(1)} µs · ` +
      `${found}/4000 hits · band ${band.toFixed(2)} ms · thin ${thin.toFixed(2)} ms`,
  );
  return { p95, band, thin };
}

describe.skipIf(server.config.coverage.enabled)("PointSet hit-test gate (G6.1)", () => {
  it("L0-3 point layer: 20,000 points", () => {
    const { p95, band } = measure(20_000, "L0-3 20k points");
    expect(p95).toBeLessThanOrEqual(2);
    expect(band).toBeLessThanOrEqual(16.7);
  });

  it("100,000 points", () => {
    const { p95, band, thin } = measure(100_000, "100k points");
    expect(p95).toBeLessThanOrEqual(2);
    // A band and a label pass are one gesture or one zoom step, not one per frame; a
    // frame's budget is the bound.
    expect(band).toBeLessThanOrEqual(16.7);
    expect(thin).toBeLessThanOrEqual(50);
  });
});
