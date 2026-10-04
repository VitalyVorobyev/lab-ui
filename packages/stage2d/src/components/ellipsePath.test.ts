import { describe, expect, it } from "vitest";

import { ellipsePath } from "./ellipseIndex";

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
