/**
 * Property tests for the measurement hit-test: the box filter never changes the answer of the
 * plain scan, distances are what the drawing says, over seeded-random scenes, so a failure
 * reproduces exactly.
 */

import { describe, expect, it } from "vitest";

import type { MeasurePrimitive } from "./MeasureOverlay";
import { measurePrimitiveDistance, nearestMeasurePrimitive } from "./measureHit";

/** mulberry32: a small, fast, seedable PRNG — deterministic runs without a dependency. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const EXTENT = 400;

/** One random primitive of every kind in turn, about half with an id. */
function scene(rand: () => number, count: number): MeasurePrimitive[] {
  const c = () => rand() * EXTENT;
  const size = () => 2 + rand() * 60;
  const angle = () => (rand() - 0.5) * 4 * Math.PI;
  return Array.from({ length: count }, (_, n): MeasurePrimitive => {
    const id = rand() < 0.5 ? `p${n}` : undefined;
    switch (n % 8) {
      case 0:
        return { kind: "point", id, x: c(), y: c(), radius: 1 + rand() * 6, cross: rand() < 0.5 };
      case 1:
        return { kind: "segment", id, x1: c(), y1: c(), x2: c(), y2: c() };
      case 2:
        return { kind: "segments", id, points: Array.from({ length: 4 * Math.floor(1 + rand() * 6) }, c) };
      case 3:
        return { kind: "circle", id, cx: c(), cy: c(), r: size(), filled: rand() < 0.5 };
      case 4:
        return { kind: "arc", id, cx: c(), cy: c(), r: size(), startAngle: angle(), endAngle: angle() };
      case 5:
        return { kind: "caliper", id, cx: c(), cy: c(), width: size(), height: size(), angle: angle(), showDirection: rand() < 0.7 };
      case 6:
        return { kind: "dimension", id, x1: c(), y1: c(), x2: c(), y2: c(), label: "d", offset: (rand() - 0.5) * 60 };
      default:
        return { kind: "polyline", id, points: Array.from({ length: 2 * Math.floor(1 + rand() * 8) }, c), closed: rand() < 0.5 };
    }
  });
}

/** The obvious answer: every primitive with an id, measured, the last of the nearest winning. */
function scan(primitives: readonly MeasurePrimitive[], p: { x: number; y: number }, radius: number, scale: number) {
  let best: { id: string; distance: number } | null = null;
  for (const primitive of primitives) {
    if (primitive.id === undefined) continue;
    const distance = measurePrimitiveDistance(primitive, p, scale);
    if (distance <= radius && (best === null || distance <= best.distance)) best = { id: primitive.id, distance };
  }
  return best;
}

describe("measure hit-test properties", () => {
  it("nearestMeasurePrimitive agrees with a plain scan of every primitive", () => {
    const rand = prng(84);
    for (let run = 0; run < 40; run++) {
      // Small scenes grid coarsely; large ones finely, with long primitives kept off the grid.
      const primitives = scene(rand, run % 2 === 0 ? 60 : 600);
      const scale = 0.25 + rand() * 4;
      for (let q = 0; q < 50; q++) {
        const p = { x: rand() * EXTENT, y: rand() * EXTENT };
        const radius = rand() * 30;
        expect(nearestMeasurePrimitive(primitives, p, radius, scale)).toEqual(scan(primitives, p, radius, scale));
      }
    }
  });

  it("a distance is never negative, and is 0 on the primitive's own defining points", () => {
    const rand = prng(85);
    for (let run = 0; run < 400; run++) {
      const [primitive] = scene(rand, 1 + Math.floor(rand() * 8)).slice(-1) as [MeasurePrimitive];
      const scale = 0.25 + rand() * 4;
      const p = { x: rand() * EXTENT, y: rand() * EXTENT };
      expect(measurePrimitiveDistance(primitive, p, scale)).toBeGreaterThanOrEqual(0);
      switch (primitive.kind) {
        case "point":
          expect(measurePrimitiveDistance(primitive, { x: primitive.x, y: primitive.y }, scale)).toBe(0);
          break;
        case "segment":
          expect(measurePrimitiveDistance(primitive, { x: primitive.x2, y: primitive.y2 }, scale)).toBeCloseTo(0, 9);
          break;
        case "caliper":
          expect(measurePrimitiveDistance(primitive, { x: primitive.cx, y: primitive.cy }, scale)).toBe(0);
          break;
        case "circle":
          expect(measurePrimitiveDistance(primitive, { x: primitive.cx + primitive.r, y: primitive.cy }, scale)).toBeCloseTo(0, 9);
          break;
        default:
          break;
      }
    }
  });

  it("a distance is 1-Lipschitz: moving the point by d changes it by at most d", () => {
    const rand = prng(86);
    for (let run = 0; run < 2000; run++) {
      const [primitive] = scene(rand, 1 + Math.floor(rand() * 8)).slice(-1) as [MeasurePrimitive];
      const scale = 0.25 + rand() * 4;
      const p = { x: rand() * EXTENT, y: rand() * EXTENT };
      const step = rand() * 5;
      const a = rand() * 2 * Math.PI;
      const q = { x: p.x + step * Math.cos(a), y: p.y + step * Math.sin(a) };
      const dp = measurePrimitiveDistance(primitive, p, scale);
      const dq = measurePrimitiveDistance(primitive, q, scale);
      if (!Number.isFinite(dp)) {
        expect(dq).toBe(Infinity);
        continue;
      }
      expect(Math.abs(dp - dq)).toBeLessThanOrEqual(step + 1e-9);
    }
  });
});
