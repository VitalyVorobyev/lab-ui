/**
 * The hit-test gate (G6.1: pointer hit-test p95 ≤ 2 ms), measured in Chromium on the scenes
 * `PolylineSet` is for. The numbers are recorded in `docs/measurements/stage2d-layer-budgets.md`.
 * The assertion is the gate itself, not a tighter bound, so a slow CI machine does not
 * flake it while a real regression still fails.
 *
 * Skipped in the coverage run: V8 precise coverage slows this code by about 50× (a band took
 * 27.6 ms there against 0.3–0.6 ms uninstrumented), so a timing would measure the
 * instrumentation, not the index. `bun run test` runs the gate uninstrumented.
 */

import { describe, expect, it } from "vitest";
import { server } from "vitest/browser";

import { buildPolylineIndex, nearestPolyline, polylinesInRect, type Polyline } from "./polylineIndex";

const WIDTH = 5472;
const HEIGHT = 3648;

function scene(polylines: number, segments: number, seed: number): Polyline[] {
  let s = seed;
  const random = () => {
    s = (s * 1103515245 + 12345) % 2 ** 31;
    return s / 2 ** 31;
  };
  return Array.from({ length: polylines }, (_, i) => {
    let x = random() * WIDTH;
    let y = random() * HEIGHT;
    const points: number[] = [x, y];
    for (let k = 0; k < segments; k++) {
      x = Math.min(WIDTH, Math.max(0, x + (random() - 0.5) * 120));
      y = Math.min(HEIGHT, Math.max(0, y + (random() - 0.5) * 120));
      points.push(x, y);
    }
    return { id: i, points };
  });
}

function percentile(values: number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
}

function measure(items: Polyline[], label: string) {
  const t0 = performance.now();
  const index = buildPolylineIndex(items);
  const build = performance.now() - t0;
  // At fit on a 1600 px wide viewport, 7 screen px is about 24 image px.
  const radius = 24;
  // One query is far below the browser's coarsened timer (100 µs without cross-origin
  // isolation), so time batches of 50 and take each batch's mean as a sample.
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
    for (const q of queries) if (nearestPolyline(index, q, radius)) found++;
    times.push((performance.now() - start) / BATCH);
  }
  // A band is one call, so a single timing is at the mercy of a cold JIT or a busy runner
  // (CI tests every package at once; one cold band took 18.7 ms there). Warm it once and
  // take the median of nine.
  const rect = { x: 1000, y: 800, width: 1500, height: 1000 };
  polylinesInRect(index, rect);
  const bands: number[] = [];
  for (let k = 0; k < 9; k++) {
    const start = performance.now();
    polylinesInRect(index, rect);
    bands.push(performance.now() - start);
  }
  const band = percentile(bands, 0.5);
  const p50 = percentile(times, 0.5);
  const p95 = percentile(times, 0.95);
  console.info(
    `${label}: build ${build.toFixed(1)} ms · hit p50 ${(p50 * 1000).toFixed(1)} µs · p95 ${(p95 * 1000).toFixed(1)} µs · ` +
      `${found}/4000 hits · band ${band.toFixed(2)} ms`,
  );
  return { p95, band };
}

describe.skipIf(server.config.coverage.enabled)("PolylineSet hit-test gate (G6.1)", () => {
  it("L0-3 polyline layer: 250 polylines × 20 segments", () => {
    const { p95 } = measure(scene(250, 20, 1), "L0-3 5k segments");
    expect(p95).toBeLessThanOrEqual(2);
  });

  it("20,000 polylines × 5 segments (100k segments)", () => {
    const { p95, band } = measure(scene(20_000, 5, 2), "20k polylines");
    expect(p95).toBeLessThanOrEqual(2);
    // A band is one gesture, not one per frame; a frame's budget is the bound.
    expect(band).toBeLessThanOrEqual(16.7);
  });
});
