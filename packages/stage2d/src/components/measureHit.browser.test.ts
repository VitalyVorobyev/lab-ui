/**
 * The hit-test budget for `MeasureOverlay`: a pick over 10,000 primitives of every kind, measured
 * in Chromium, stays under 2 ms. As in `areaIndex.browser.test.ts`, the assertion is the budget
 * itself, so a slow CI machine does not flake it while a real regression still fails.
 *
 * Skipped in the coverage run: V8 precise coverage slows this code by an order of magnitude,
 * so a timing would measure the instrumentation, not the hit-test.
 */

import { describe, expect, it } from "vitest";
import { server } from "vitest/browser";

import type { MeasurePrimitive } from "./MeasureOverlay";
import { nearestMeasurePrimitive } from "./measureHit";

const WIDTH = 5472;
const HEIGHT = 3648;

function scene(count: number, seed: number): MeasurePrimitive[] {
  let s = seed;
  const random = () => {
    s = (s * 1103515245 + 12345) % 2 ** 31;
    return s / 2 ** 31;
  };
  return Array.from({ length: count }, (_, n): MeasurePrimitive => {
    const id = `m${n}`;
    const x = random() * WIDTH;
    const y = random() * HEIGHT;
    switch (n % 6) {
      case 0:
        // A caliper box across an edge, the commonest primitive in an inspection result.
        return { kind: "caliper", id, cx: x, cy: y, width: 40, height: 16, angle: random() * Math.PI };
      case 1:
        return { kind: "point", id, x, y, cross: true };
      case 2:
        return { kind: "circle", id, cx: x, cy: y, r: 5 + random() * 40 };
      case 3:
        return { kind: "segment", id, x1: x, y1: y, x2: x + 30, y2: y + random() * 30 };
      case 4:
        return { kind: "arc", id, cx: x, cy: y, r: 20, startAngle: 0, endAngle: random() * 6 };
      default:
        // A short contour: 16 points.
        return { kind: "polyline", id, points: Array.from({ length: 16 }, (_, k) => [x + k * 3, y + Math.sin(k) * 6]).flat() };
    }
  });
}

function percentile(values: number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
}

describe.skipIf(server.config.coverage.enabled)("MeasureOverlay hit-test budget", () => {
  it("10,000 primitives: a pick under 2 ms", () => {
    const primitives = scene(10_000, 10_000);
    // At fit on a 1600 px wide viewport the scale is about 0.29, and 6 screen px is about 21 image px.
    const scale = 0.29;
    const radius = 21;
    const t0 = performance.now();
    nearestMeasurePrimitive(primitives, { x: 0, y: 0 }, radius, scale);
    const first = performance.now() - t0;
    // One query is near the browser's coarsened timer, so time batches of 20 and take each
    // batch's mean as a sample.
    const BATCH = 20;
    const times: number[] = [];
    let found = 0;
    let s = 7;
    for (let b = 0; b < 1000 / BATCH; b++) {
      const queries: { x: number; y: number }[] = [];
      for (let q = 0; q < BATCH; q++) {
        s = (s * 1103515245 + 12345) % 2 ** 31;
        const x = (s / 2 ** 31) * WIDTH;
        s = (s * 1103515245 + 12345) % 2 ** 31;
        queries.push({ x, y: (s / 2 ** 31) * HEIGHT });
      }
      const start = performance.now();
      for (const q of queries) if (nearestMeasurePrimitive(primitives, q, radius, scale)) found++;
      times.push((performance.now() - start) / BATCH);
    }
    const p50 = percentile(times, 0.5);
    const p95 = percentile(times, 0.95);
    console.info(
      `10k primitives: first pick (boxes built) ${first.toFixed(1)} ms · pick p50 ${(p50 * 1000).toFixed(1)} µs · p95 ${(p95 * 1000).toFixed(1)} µs · ${found}/1000 hits`,
    );
    expect(p95).toBeLessThan(2);
    expect(found).toBeGreaterThan(0);
  });
});
