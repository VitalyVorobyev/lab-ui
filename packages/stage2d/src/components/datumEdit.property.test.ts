/**
 * Property tests for the datum arithmetic: angles stay in range, snapping is idempotent and
 * lands on the grid, and a press goes to the nearer part, over seeded-random datums, so a
 * failure reproduces exactly.
 */

import { describe, expect, it } from "vitest";

import { DATUM_HANDLE_PX, DATUM_RING_PX, datumAxes, datumPress, moveDatum, rotateDatum, type Datum } from "./datumEdit";
import { closestOnSegment } from "./polylineIndex";
import { snapAngle } from "./shapeEdit";

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

const RUNS = 1000;

function generators(seed: number) {
  const rand = prng(seed);
  const between = (low: number, high: number) => low + (high - low) * rand();
  const datum = (): Datum => ({ origin: { x: between(-500, 1500), y: between(-500, 1500) }, angle: between(-10, 10) });
  const point = () => ({ x: between(-500, 1500), y: between(-500, 1500) });
  return { rand, between, datum, point };
}

describe("datum properties", () => {
  it("rotateDatum's angle is in (−π, π], snapped or not, and the origin never moves", () => {
    const g = generators(54);
    for (let run = 0; run < RUNS; run++) {
      const d = g.datum();
      const snap = g.rand() < 0.5 ? 0 : g.between(0.01, 1);
      const turned = rotateDatum(d, g.point(), snap);
      expect(turned.angle).toBeGreaterThan(-Math.PI);
      expect(turned.angle).toBeLessThanOrEqual(Math.PI);
      expect(turned.origin).toBe(d.origin);
    }
  });

  it("an unsnapped turn points the i axis at the pointer", () => {
    const g = generators(55);
    for (let run = 0; run < RUNS; run++) {
      const d = g.datum();
      const to = g.point();
      const length = Math.hypot(to.x - d.origin.x, to.y - d.origin.y);
      if (length < 1e-6) continue;
      const { i } = datumAxes(rotateDatum(d, to), length);
      expect(i.x).toBeCloseTo(to.x, 6);
      expect(i.y).toBeCloseTo(to.y, 6);
    }
  });

  it("snapAngle is idempotent and lands on a multiple of its step, within half a step", () => {
    const g = generators(56);
    for (let run = 0; run < RUNS; run++) {
      const angle = g.between(-20, 20);
      const step = g.between(0.01, 2);
      const once = snapAngle(angle, step);
      expect(snapAngle(once, step)).toBe(once);
      expect(Math.abs(once / step - Math.round(once / step))).toBeLessThan(1e-9);
      expect(Math.abs(once - angle)).toBeLessThanOrEqual(step / 2 + 1e-12);
      expect(snapAngle(angle, 0)).toBe(angle);
    }
  });

  it("a snapped turn is idempotent: turning to its own i axis again changes nothing", () => {
    const g = generators(57);
    for (let run = 0; run < RUNS; run++) {
      const d = g.datum();
      const snap = Math.PI / 12;
      const once = rotateDatum(d, g.point(), snap);
      const twice = rotateDatum(once, datumAxes(once, 100).i, snap);
      expect(Math.cos(twice.angle)).toBeCloseTo(Math.cos(once.angle), 9);
      expect(Math.sin(twice.angle)).toBeCloseTo(Math.sin(once.angle), 9);
      // A multiple of 15°.
      const degrees = (once.angle * 180) / Math.PI;
      expect(Math.abs(degrees / 15 - Math.round(degrees / 15))).toBeLessThan(1e-9);
    }
  });

  it("moveDatum on a grid is idempotent and stays in bounds", () => {
    const g = generators(58);
    for (let run = 0; run < RUNS; run++) {
      const d = g.datum();
      const grid = g.rand() < 0.3 ? 0 : g.between(0.5, 20);
      const bounds = { x: g.between(-100, 100), y: g.between(-100, 100), width: g.between(0, 800), height: g.between(0, 800) };
      const moved = moveDatum(d, g.point(), { grid, bounds });
      expect(moved.angle).toBe(d.angle);
      expect(moved.origin.x).toBeGreaterThanOrEqual(bounds.x);
      expect(moved.origin.x).toBeLessThanOrEqual(bounds.x + bounds.width);
      expect(moved.origin.y).toBeGreaterThanOrEqual(bounds.y);
      expect(moved.origin.y).toBeLessThanOrEqual(bounds.y + bounds.height);
      const again = moveDatum(moved, moved.origin, { grid, bounds });
      expect(again.origin.x).toBeCloseTo(moved.origin.x, 9);
      expect(again.origin.y).toBeCloseTo(moved.origin.y, 9);
    }
  });

  it("datumPress picks the nearer of the origin and the arm, and nothing out of reach", () => {
    const g = generators(59);
    for (let run = 0; run < RUNS * 4; run++) {
      const d: Datum = { origin: { x: 0, y: 0 }, angle: g.between(-Math.PI, Math.PI) };
      const scale = g.between(0.2, 8);
      const radius = g.rand() < 0.5 ? 6 : 12;
      const armLength = g.between(20, 80);
      // Presses near the glyph, in screen pixels about the origin.
      const sx = g.between(-armLength - 30, armLength + 30);
      const sy = g.between(-armLength - 30, armLength + 30);
      const decision = datumPress(d, { x: sx / scale, y: sy / scale }, scale, radius, { armLength });
      const origin = Math.max(0, Math.hypot(sx, sy) - DATUM_RING_PX);
      const c = Math.cos(d.angle);
      const s = Math.sin(d.angle);
      const start = Math.min(DATUM_RING_PX, armLength);
      const q = closestOnSegment({ x: sx, y: sy }, start * c, start * s, armLength * c, armLength * s);
      const arm = Math.min(Math.hypot(q.x - sx, q.y - sy), Math.max(0, Math.hypot(sx - armLength * c, sy - armLength * s) - DATUM_HANDLE_PX));
      const expected = origin <= radius && origin <= arm ? "origin" : arm <= radius ? "arm" : null;
      expect(decision).toBe(expected);
      if (decision === "origin") expect(origin).toBeLessThanOrEqual(arm);
      if (decision === "arm") expect(arm).toBeLessThan(origin);
      if (decision === null) expect(Math.min(origin, arm)).toBeGreaterThan(radius);
    }
  });
});
