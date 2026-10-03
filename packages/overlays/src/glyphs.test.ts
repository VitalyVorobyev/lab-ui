import { describe, expect, it } from "vitest";

import { TARGET_MARKERS, ellipsePath, packAxes, unpackAxes } from "./glyphs";

/** mulberry32. */
function prng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The numbers in a path, in order. */
const numbers = (d: string): number[] => (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);

/** The distance between two directions as lines: modulo π. */
function lineDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % Math.PI;
  return Math.min(d, Math.PI - d);
}

describe("packAxes", () => {
  it("is the angle itself, modulo π, for one axis", () => {
    expect(packAxes(0.5)).toBeCloseTo(0.5, 12);
    expect(packAxes(0.5 + Math.PI)).toBeCloseTo(0.5, 12);
    expect(packAxes(-0.5)).toBeCloseTo(Math.PI - 0.5, 12);
    expect(unpackAxes(packAxes(1))).toHaveLength(1);
  });

  it("keeps two axes apart from one: a packed pair is never a plain angle", () => {
    expect(packAxes(0, 0)).toBeGreaterThanOrEqual(8);
    expect(packAxes(Math.PI - 1e-9, Math.PI - 1e-9)).toBeGreaterThanOrEqual(8);
    expect(unpackAxes(packAxes(0, 0)).length).toBe(2);
  });

  it("round-trips any two directions to 5e-8 rad as lines", () => {
    const random = prng(11);
    for (let run = 0; run < 2000; run++) {
      const a = (random() - 0.5) * 40;
      const b = (random() - 0.5) * 40;
      const [ra, rb] = unpackAxes(packAxes(a, b));
      expect(lineDistance(ra!, a), `run ${run}: ${a}, ${b}`).toBeLessThan(5e-8);
      expect(lineDistance(rb!, b), `run ${run}: ${a}, ${b}`).toBeLessThan(5e-8);
    }
  });

  it("is exact in doubles: the packed value is an integer below 2^53", () => {
    const random = prng(5);
    for (let run = 0; run < 500; run++) {
      const packed = packAxes(random() * 10, random() * 10);
      expect(Number.isInteger(packed)).toBe(true);
      expect(packed).toBeLessThan(2 ** 53);
    }
  });

  it("unpacks nothing from a non-finite value", () => {
    expect(unpackAxes(Number.NaN)).toEqual([]);
    expect(unpackAxes(Infinity)).toEqual([]);
  });
});

describe("TARGET_MARKERS.directed", () => {
  const { directed } = TARGET_MARKERS;

  it("draws one axis as two segments with a gap at the centre", () => {
    // Along +x at 2 image px per screen px: from 16 to 4 left of the centre, and 4 to 16 right.
    expect(numbers(directed.path(100, 50, 2, packAxes(0)))).toEqual([84, 50, 96, 50, 104, 50, 116, 50]);
  });

  it("draws two axes as four segments", () => {
    const d = directed.path(0, 0, 1, packAxes(0, Math.PI / 2));
    expect((d.match(/M/g) ?? []).length).toBe(4);
    // The second axis runs along y.
    const n = numbers(d);
    expect(n.slice(8)).toEqual([0, -8, 0, -2, 0, 2, 0, 8].map((v, k) => (k % 2 === 0 ? 0 : v)));
  });

  it("scales with the zoom: the screen size stays 8 px", () => {
    const small = numbers(directed.path(0, 0, 1, packAxes(0)));
    const big = numbers(directed.path(0, 0, 4, packAxes(0)));
    expect(big.map((v) => v / 4)).toEqual(small);
    expect(directed.size).toBe(8);
  });

  it("draws nothing for a non-finite angle", () => {
    expect(directed.path(0, 0, 1, Number.NaN)).toBe("");
  });
});

describe("TARGET_MARKERS circles", () => {
  it("draws white as a ring and black as a ring with a centre dot", () => {
    const white = TARGET_MARKERS["circle-white"].path(10, 10, 1, 0);
    const black = TARGET_MARKERS["circle-black"].path(10, 10, 1, 0);
    expect((white.match(/M/g) ?? []).length).toBe(1);
    expect((black.match(/M/g) ?? []).length).toBe(2);
    expect(black.startsWith(white)).toBe(true);
  });

  it("sizes the ring in screen pixels", () => {
    // The ring starts at (x + r, y): 5.5 screen px, at 2 image px per screen px.
    expect(TARGET_MARKERS["circle-white"].path(0, 0, 2, 0).startsWith("M11 0")).toBe(true);
  });
});

describe("ellipsePath", () => {
  it("draws an axis-aligned ellipse as two half arcs through the extremes", () => {
    expect(ellipsePath(10, 20, 5, 3)).toBe("M15 20A5 3 0 1 0 5 20A5 3 0 1 0 15 20");
  });

  it("rotates the arcs' end points and the arc's own axis", () => {
    const d = ellipsePath(0, 0, 4, 2, Math.PI / 2);
    expect(numbers(d).slice(0, 2).map(Math.abs)).toEqual([0, 4]);
    expect(d).toContain("A4 2 90 1 0");
  });

  it("puts the two end points opposite each other about the centre, for any ellipse", () => {
    const random = prng(3);
    for (let run = 0; run < 300; run++) {
      const cx = random() * 500;
      const cy = random() * 500;
      const [x0, y0, , , , , , x1, y1] = numbers(ellipsePath(cx, cy, 1 + random() * 40, 1 + random() * 40, (random() - 0.5) * 7));
      expect((x0! + x1!) / 2, `run ${run}`).toBeCloseTo(cx, 2);
      expect((y0! + y1!) / 2, `run ${run}`).toBeCloseTo(cy, 2);
    }
  });

  it("returns nothing for a degenerate or non-finite ellipse", () => {
    expect(ellipsePath(0, 0, 0, 3)).toBe("");
    expect(ellipsePath(0, 0, 3, -1)).toBe("");
    expect(ellipsePath(0, 0, Number.NaN, 3)).toBe("");
    expect(ellipsePath(Infinity, 0, 3, 3)).toBe("");
    expect(ellipsePath(0, 0, 3, 3, Number.NaN)).toBe("");
  });
});
