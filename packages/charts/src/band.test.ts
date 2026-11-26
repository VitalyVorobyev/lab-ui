import { describe, expect, it } from "vitest";

import { bandBoundsAt, bandPath, bandValueAt, bandValues, formatWithBand } from "./band";
import { linearScale } from "./scale";

const x = linearScale([0, 10], 0, 100);
const y = linearScale([0, 10], 100, 0);
const pts = [0, 5, 10].map((v) => ({ x: v, y: v }));

describe("bandBoundsAt", () => {
  it("orders the edges and refuses a missing or non-finite one", () => {
    expect(bandBoundsAt({ lower: [1], upper: [3] }, 0)).toEqual([1, 3]);
    expect(bandBoundsAt({ lower: [3], upper: [1] }, 0)).toEqual([1, 3]);
    expect(bandBoundsAt({ lower: [Number.NaN], upper: [1] }, 0)).toBeNull();
    expect(bandBoundsAt({ lower: [1], upper: [] }, 0)).toBeNull();
    expect(bandBoundsAt({ lower: [1], upper: [2] }, 4)).toBeNull();
  });
});

describe("bandPath", () => {
  it("walks the upper edge left to right and the lower back, closed", () => {
    const d = bandPath(pts, { lower: [0, 4, 9], upper: [1, 6, 10] }, x, y);
    // Upper: y=1,6,10 -> pixels 90,40,0; lower: y=0,4,9 -> 100,60,10.
    expect(d).toBe("M0.00 90.00 L50.00 40.00 L100.00 0.00 L100.00 10.00 L50.00 60.00 L0.00 100.00 Z");
  });

  it("splits at a gap instead of bridging it, and drops a run of one point", () => {
    const four = [0, 1, 2, 3].map((v) => ({ x: v, y: v }));
    const d = bandPath(four, { lower: [0, 1, Number.NaN, 3], upper: [1, 2, 3, 4] }, x, y);
    expect(d.match(/M/g)).toHaveLength(1);
    expect(d.match(/Z/g)).toHaveLength(1);
    const two = bandPath(four, { lower: [0, Number.NaN, 2, Number.NaN], upper: [1, 2, 3, 4] }, x, y);
    expect(two).toBe("");
  });

  it("breaks at a non-finite x and is empty for no points or no band", () => {
    const withNan = [
      { x: 0, y: 0 },
      { x: Number.NaN, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
    ];
    expect(bandPath(withNan, { lower: [0, 0, 1, 2], upper: [1, 1, 2, 3] }, x, y).match(/M/g)).toHaveLength(1);
    expect(bandPath([], { lower: [], upper: [] }, x, y)).toBe("");
    expect(bandPath(pts, { lower: [], upper: [] }, x, y)).toBe("");
  });

  it("never emits NaN, also on a log-like scale input outside the domain", () => {
    expect(bandPath(pts, { lower: [-5, 0, 1], upper: [20, 3, 30] }, x, y)).not.toContain("NaN");
  });
});

describe("bandValues", () => {
  it("lists the finite edges", () => {
    expect(bandValues({ lower: [1, Number.NaN], upper: [2, Number.POSITIVE_INFINITY] })).toEqual([1, 2]);
  });
});

describe("bandValueAt", () => {
  it("interpolates both edges between points and is null outside or across a gap", () => {
    const band = { lower: [0, 4, 9], upper: [1, 6, 10] };
    expect(bandValueAt(pts, band, 2.5)).toEqual([2, 3.5]);
    expect(bandValueAt(pts, band, 11)).toBeNull();
    expect(bandValueAt(pts, { lower: [0, Number.NaN, 9], upper: [1, 6, 10] }, 2.5)).toBeNull();
  });
});

describe("formatWithBand", () => {
  const f = (n: number) => String(Number(n.toPrecision(3)));
  it("writes ± for a symmetric band and the range for an asymmetric one", () => {
    expect(formatWithBand(3, [2.6, 3.4], f)).toBe("3 ± 0.4");
    expect(formatWithBand(3, [2.5, 3.9], f)).toBe("3 [2.5, 3.9]");
    expect(formatWithBand(0, [0, 0], f)).toBe("0 ± 0");
  });
});
