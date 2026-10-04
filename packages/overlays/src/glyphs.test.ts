import { describe, expect, it } from "vitest";

import { TARGET_MARKERS } from "./glyphs";

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

/**
 * The packing the glyph used before `MarkerShape.path` took a second angle: kept here, as the
 * reference the new glyph must reproduce.
 */
const STEPS = 2 ** 26;
const PACKED_FLOOR = 8;
const lineAngle = (angle: number) => {
  const wrapped = angle % Math.PI;
  return wrapped < 0 ? wrapped + Math.PI : wrapped;
};
const packAxes = (angle: number, angle2?: number) => {
  if (angle2 === undefined) return lineAngle(angle);
  const q = (a: number) => Math.round((lineAngle(a) / Math.PI) * STEPS) % STEPS;
  return PACKED_FLOOR + q(angle) * STEPS + q(angle2);
};
const unpackAxes = (packed: number): number[] => {
  if (packed < PACKED_FLOOR) return [lineAngle(packed)];
  const rest = packed - PACKED_FLOOR;
  const first = Math.floor(rest / STEPS);
  return [(first / STEPS) * Math.PI, ((rest - first * STEPS) / STEPS) * Math.PI];
};
/** The old `directed` path, from its packed angle. */
function packedDirected(x: number, y: number, unit: number, packed: number): string {
  let d = "";
  const round = (v: number) => Math.round(v * 1000) / 1000;
  for (const angle of unpackAxes(packed)) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    d +=
      `M${round(x - 8 * unit * c)} ${round(y - 8 * unit * s)}L${round(x - 2 * unit * c)} ${round(y - 2 * unit * s)}` +
      `M${round(x + 2 * unit * c)} ${round(y + 2 * unit * s)}L${round(x + 8 * unit * c)} ${round(y + 8 * unit * s)}`;
  }
  return d;
}

describe("TARGET_MARKERS.directed", () => {
  const { directed } = TARGET_MARKERS;

  it("draws one axis as two segments with a gap at the centre", () => {
    // Along +x at 2 image px per screen px: from 16 to 4 left of the centre, and 4 to 16 right.
    expect(numbers(directed.path(100, 50, 2, 0))).toEqual([84, 50, 96, 50, 104, 50, 116, 50]);
  });

  it("draws two axes as four segments", () => {
    const d = directed.path(0, 0, 1, 0, Math.PI / 2);
    expect((d.match(/M/g) ?? []).length).toBe(4);
    // The second axis runs along y.
    const n = numbers(d);
    expect(n.slice(8)).toEqual([0, -8, 0, -2, 0, 2, 0, 8].map((v, k) => (k % 2 === 0 ? 0 : v)));
  });

  it("scales with the zoom: the screen size stays 8 px", () => {
    const small = numbers(directed.path(0, 0, 1, 0));
    const big = numbers(directed.path(0, 0, 4, 0));
    expect(big.map((v) => v / 4)).toEqual(small);
    expect(directed.size).toBe(8);
  });

  it("reads directions as lines: modulo π", () => {
    expect(directed.path(0, 0, 1, 0.4 + Math.PI)).toBe(directed.path(0, 0, 1, 0.4));
    expect(directed.path(0, 0, 1, -0.4, 1)).toBe(directed.path(0, 0, 1, Math.PI - 0.4, 1 + Math.PI));
  });

  it("draws what the packed-angle glyph drew, one axis or two, up to float formatting", () => {
    const random = prng(17);
    for (let run = 0; run < 500; run++) {
      const a = (random() - 0.5) * 30;
      const b = random() < 0.5 ? undefined : (random() - 0.5) * 30;
      const unit = 0.25 + random() * 4;
      const now = numbers(directed.path(12.5, -3.25, unit, a, b));
      const before = numbers(packedDirected(12.5, -3.25, unit, packAxes(a, b)));
      expect(now.length, `run ${run}`).toBe(before.length);
      now.forEach((v, k) => expect(v, `run ${run} value ${k}`).toBeCloseTo(before[k]!, 2));
    }
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
