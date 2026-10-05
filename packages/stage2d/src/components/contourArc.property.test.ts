/**
 * Property tests for the arc-length helpers, over seeded-random paths, so a failure
 * reproduces exactly.
 */

import { describe, expect, it } from "vitest";

import { arcLengths, deformContour, eraseArc, normalAtArc, pointAtArc, projectToArc, subPath } from "./contourArc";
import type { Point } from "./measureGeometry";

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

/** A path of 2 to 12 vertices, sometimes with a repeated vertex (a zero-length segment). */
function randomPath(rand: () => number): Point[] {
  const n = 2 + Math.floor(rand() * 11);
  const out: Point[] = [];
  for (let i = 0; i < n; i++) {
    const previous = out[i - 1];
    out.push(previous && rand() < 0.1 ? { ...previous } : { x: rand() * 400 - 100, y: rand() * 300 - 50 });
  }
  return out;
}

const length = (points: readonly Point[]) => arcLengths(points).at(-1) ?? 0;
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const CASES = 1500;

describe("arc length", () => {
  it("never decreases, and every vertex sits at its own arc length", () => {
    const rand = prng(101);
    for (let n = 0; n < CASES; n++) {
      const points = randomPath(rand);
      const closed = rand() < 0.5;
      const cum = arcLengths(points, closed);
      expect(cum).toHaveLength(points.length + (closed ? 1 : 0));
      for (let i = 1; i < cum.length; i++) expect(cum[i]!).toBeGreaterThanOrEqual(cum[i - 1]!);
      points.forEach((p, i) => {
        const at = pointAtArc(points, cum[i]!, closed);
        expect(distance(at, p)).toBeLessThan(1e-9);
      });
    }
  });
});

describe("projectToArc", () => {
  it("is never farther than the nearest vertex, and lands where its arc length says", () => {
    const rand = prng(202);
    for (let n = 0; n < CASES; n++) {
      const points = randomPath(rand);
      const closed = rand() < 0.5;
      const p = { x: rand() * 600 - 200, y: rand() * 500 - 150 };
      const hit = projectToArc(points, p, closed);
      const nearestVertex = Math.min(...points.map((v) => distance(v, p)));
      expect(hit.distance).toBeLessThanOrEqual(nearestVertex + 1e-9);
      expect(hit.distance).toBeCloseTo(distance(hit.point, p), 9);
      expect(distance(pointAtArc(points, hit.s, closed), hit.point)).toBeLessThan(1e-6);
    }
  });
});

describe("subPath", () => {
  it("starts and ends at the places its arc lengths name, and is as long as the stretch", () => {
    const rand = prng(303);
    for (let n = 0; n < CASES; n++) {
      const points = randomPath(rand);
      const closed = rand() < 0.5;
      const total = length(closed ? [...points, points[0]!] : points);
      const s0 = rand() * total;
      const s1 = rand() * total;
      const piece = subPath(points, s0, s1, closed);
      const [from, to] = closed || s0 <= s1 ? [s0, s1] : [s1, s0];
      expect(distance(piece[0]!, pointAtArc(points, from, closed))).toBeLessThan(1e-9);
      expect(distance(piece.at(-1)!, pointAtArc(points, to, closed))).toBeLessThan(1e-9);
      const expected = closed && s0 > s1 ? total - s0 + s1 : Math.abs(s1 - s0);
      expect(length(piece)).toBeCloseTo(expected, 6);
    }
  });
});

describe("eraseArc", () => {
  it("leaves exactly the length it did not erase", () => {
    const rand = prng(404);
    for (let n = 0; n < CASES; n++) {
      const points = randomPath(rand);
      const closed = rand() < 0.5;
      const total = length(closed ? [...points, points[0]!] : points);
      const s0 = rand() * total;
      const s1 = rand() * total;
      const pieces = eraseArc(points, s0, s1, closed);
      if (!(total > 0)) continue;
      const erased = closed ? (s1 - s0 + total) % total : Math.abs(s1 - s0);
      const left = pieces.reduce((sum, piece) => sum + length(piece), 0);
      expect(left).toBeCloseTo(total - erased, 6);
      expect(pieces.length).toBeLessThanOrEqual(closed ? 1 : 2);
      for (const piece of pieces) expect(piece.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("normalAtArc", () => {
  it("is a unit vector at right angles to the path", () => {
    const rand = prng(505);
    for (let n = 0; n < CASES; n++) {
      const points = randomPath(rand);
      const closed = rand() < 0.5;
      if (length(closed ? [...points, points[0]!] : points) === 0) continue;
      const total = length(closed ? [...points, points[0]!] : points);
      const s = rand() * total;
      const normal = normalAtArc(points, s, closed);
      expect(Math.hypot(normal.x, normal.y)).toBeCloseTo(1, 9);
      // A small step along the path near `s` moves at right angles to the normal, unless it
      // crossed a vertex.
      const a = pointAtArc(points, s, closed);
      const b = pointAtArc(points, s + 1e-6, closed);
      const step = distance(a, b);
      if (step > 5e-7) expect(Math.abs(((b.x - a.x) * normal.x + (b.y - a.y) * normal.y) / step)).toBeLessThan(1e-3);
    }
  });
});

describe("deformContour", () => {
  it("moves nothing outside the brush, never more than the push, and spaces vertices under it", () => {
    const rand = prng(606);
    for (let n = 0; n < CASES / 3; n++) {
      const points = randomPath(rand);
      const closed = rand() < 0.5;
      const centre = { x: rand() * 300, y: rand() * 200 };
      const delta = { x: rand() * 20 - 10, y: rand() * 20 - 10 };
      const radius = 5 + rand() * 60;
      // With no push, the result is the divided path the brush then moves.
      const dense = deformContour(points, centre, { x: 0, y: 0 }, radius, closed);
      const out = deformContour(points, centre, delta, radius, closed);
      expect(out).toHaveLength(dense.length);
      // The original vertices are all still there, in order.
      let j = 0;
      for (const p of points) {
        while (j < dense.length && !(dense[j]!.x === p.x && dense[j]!.y === p.y)) j++;
        expect(j).toBeLessThan(dense.length);
        j++;
      }
      const push = Math.hypot(delta.x, delta.y);
      dense.forEach((d, i) => {
        const moved = distance(out[i]!, d);
        if (distance(d, centre) >= radius) expect(moved).toBe(0);
        else expect(moved).toBeLessThanOrEqual(push + 1e-9);
      });
      // Under the brush the vertices are at most a quarter of its radius apart.
      for (let i = 1; i < dense.length; i++) {
        if (distance(dense[i - 1]!, centre) < radius && distance(dense[i]!, centre) < radius) {
          expect(distance(dense[i - 1]!, dense[i]!)).toBeLessThanOrEqual(radius / 4 + 1e-9);
        }
      }
    }
  });

  it("gives the whole push at the centre and none at the rim", () => {
    const rand = prng(707);
    for (let n = 0; n < 200; n++) {
      const radius = 5 + rand() * 50;
      const centre = { x: rand() * 100, y: rand() * 100 };
      const delta = { x: rand() * 10 - 5, y: rand() * 10 - 5 };
      const rim = { x: centre.x + radius, y: centre.y };
      const out = deformContour([centre, rim], centre, delta, radius);
      expect(distance(out[0]!, { x: centre.x + delta.x, y: centre.y + delta.y })).toBeLessThan(1e-9);
      expect(out.at(-1)).toEqual(rim);
    }
  });
});
