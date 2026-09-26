/**
 * Property tests for the overlay geometry: invariants of rotations, caliper boxes and
 * dimension leaders, over seeded-random inputs, so a failure reproduces exactly.
 */

import { describe, expect, it } from "vitest";

import {
  arrowHeadPoints,
  caliperArrow,
  caliperCorners,
  crossSegments,
  dimensionGeometry,
  rotatePoint,
  strokeWidthFor,
  type Point,
} from "./measureGeometry";

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

const RUNS = 500;
const TOLERANCE = 1e-7;

function generators(seed: number) {
  const random = prng(seed);
  const between = (low: number, high: number) => low + (high - low) * random();
  const angle = () => between(-4 * Math.PI, 4 * Math.PI);
  const coordinate = () => between(-5000, 5000);
  return { between, angle, coordinate };
}

const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);
const dot = (a: Point, b: Point, c: Point, d: Point) => (b.x - a.x) * (d.x - c.x) + (b.y - a.y) * (d.y - c.y);

describe("measure geometry properties", () => {
  it("rotatePoint preserves length and is undone by the opposite rotation", () => {
    const g = generators(21);
    for (let run = 0; run < RUNS; run += 1) {
      const x = g.coordinate();
      const y = g.coordinate();
      const angle = g.angle();
      const turned = rotatePoint(x, y, angle);
      expect(Math.hypot(turned.x, turned.y)).toBeCloseTo(Math.hypot(x, y), 6);
      const back = rotatePoint(turned.x, turned.y, -angle);
      expect(back.x).toBeCloseTo(x, 6);
      expect(back.y).toBeCloseTo(y, 6);
    }
  });

  it("rotations compose by adding angles", () => {
    const g = generators(22);
    for (let run = 0; run < RUNS; run += 1) {
      const x = g.coordinate();
      const y = g.coordinate();
      const a = g.angle();
      const b = g.angle();
      const once = rotatePoint(x, y, a + b);
      const first = rotatePoint(x, y, a);
      const twice = rotatePoint(first.x, first.y, b);
      expect(twice.x).toBeCloseTo(once.x, 6);
      expect(twice.y).toBeCloseTo(once.y, 6);
    }
  });

  it("a caliper box is a width × height rectangle centred on its centre", () => {
    const g = generators(23);
    for (let run = 0; run < RUNS; run += 1) {
      const cx = g.coordinate();
      const cy = g.coordinate();
      const width = g.between(0.1, 800);
      const height = g.between(0.1, 800);
      const [a, b, c, d] = caliperCorners(cx, cy, width, height, g.angle());
      expect((a.x + b.x + c.x + d.x) / 4).toBeCloseTo(cx, 6);
      expect((a.y + b.y + c.y + d.y) / 4).toBeCloseTo(cy, 6);
      expect(distance(a, b)).toBeCloseTo(width, 6);
      expect(distance(b, c)).toBeCloseTo(height, 6);
      expect(distance(c, d)).toBeCloseTo(width, 6);
      expect(distance(d, a)).toBeCloseTo(height, 6);
      // Right angles: adjacent sides are perpendicular.
      expect(Math.abs(dot(a, b, b, c)) / (width * height)).toBeLessThan(TOLERANCE);
    }
  });

  it("the caliper arrow starts at the centre and points along the box's own axis", () => {
    const g = generators(24);
    for (let run = 0; run < RUNS; run += 1) {
      const cx = g.coordinate();
      const cy = g.coordinate();
      const width = g.between(0.1, 800);
      const angle = g.angle();
      const { from, to } = caliperArrow(cx, cy, width, angle);
      expect(from).toEqual({ x: cx, y: cy });
      // Past the box's edge.
      expect(distance(from, to)).toBeGreaterThan(width / 2);
      const [a, b] = caliperCorners(cx, cy, width, 1, angle);
      const alongAxis = dot(from, to, a, b) / (distance(from, to) * distance(a, b));
      expect(alongAxis).toBeCloseTo(1, 9);
    }
  });

  it("an arrowhead's back points are symmetric about its direction and behind the tip", () => {
    const g = generators(25);
    for (let run = 0; run < RUNS; run += 1) {
      const tip = { x: g.coordinate(), y: g.coordinate() };
      const angle = g.angle();
      const size = g.between(0.1, 40);
      const [left, apex, right] = arrowHeadPoints(tip, angle, size);
      expect(apex).toEqual(tip);
      expect(distance(left, tip)).toBeCloseTo(distance(right, tip), 6);
      const direction = { x: tip.x + Math.cos(angle), y: tip.y + Math.sin(angle) };
      expect(dot(tip, direction, tip, left)).toBeLessThan(0);
      expect(dot(tip, direction, tip, right)).toBeLessThan(0);
    }
  });

  it("a dimension line is parallel to, as long as, and |offset| away from what it measures", () => {
    const g = generators(26);
    for (let run = 0; run < RUNS; run += 1) {
      const p1 = { x: g.coordinate(), y: g.coordinate() };
      const p2 = { x: g.coordinate(), y: g.coordinate() };
      const offset = g.between(-200, 200);
      const geometry = dimensionGeometry(p1.x, p1.y, p2.x, p2.y, offset);
      const [d1, d2] = geometry.dimensionLine;
      expect(distance(d1, d2)).toBeCloseTo(distance(p1, p2), 6);
      expect(distance(p1, d1)).toBeCloseTo(Math.abs(offset), 6);
      expect(distance(p2, d2)).toBeCloseTo(Math.abs(offset), 6);
      // Extension lines are perpendicular to the measured segment.
      const length = distance(p1, p2);
      if (length > 1e-6 && Math.abs(offset) > 1e-6) {
        expect(Math.abs(dot(p1, p2, p1, d1)) / (length * Math.abs(offset))).toBeLessThan(1e-6);
      }
      expect(geometry.labelAnchor.x).toBeCloseTo((d1.x + d2.x) / 2, 6);
      expect(geometry.labelAnchor.y).toBeCloseTo((d1.y + d2.y) / 2, 6);
    }
  });

  it("strokeWidthFor times the scale is the requested screen width", () => {
    const g = generators(27);
    for (let run = 0; run < RUNS; run += 1) {
      const scale = Math.exp(g.between(Math.log(0.001), Math.log(1000)));
      const screen = g.between(0.1, 20);
      expect(strokeWidthFor(scale, screen) * scale).toBeCloseTo(screen, 9);
    }
  });

  it("a cross is two perpendicular segments of length 2·size bisecting each other at the point", () => {
    const g = generators(28);
    for (let run = 0; run < RUNS; run += 1) {
      const x = g.coordinate();
      const y = g.coordinate();
      const size = g.between(0.1, 50);
      const [[h1, h2], [v1, v2]] = crossSegments(x, y, size);
      expect(distance(h1, h2)).toBeCloseTo(2 * size, 6);
      expect(distance(v1, v2)).toBeCloseTo(2 * size, 6);
      expect(dot(h1, h2, v1, v2)).toBeCloseTo(0, 6);
      expect((h1.x + h2.x) / 2).toBeCloseTo(x, 6);
      expect((v1.y + v2.y) / 2).toBeCloseTo(y, 6);
    }
  });
});
