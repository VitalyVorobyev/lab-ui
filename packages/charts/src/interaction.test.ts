import { describe, expect, it } from "vitest";

import { seriesValueAt } from "./interaction";
import { linearScale, logScale } from "./scale";

describe("seriesValueAt", () => {
  const points = [
    { x: 0, y: 0 },
    { x: 10, y: 100 },
    { x: 20, y: 50 },
  ];

  it("interpolates between neighbours and is exact on points", () => {
    expect(seriesValueAt(points, 5)).toBe(50);
    expect(seriesValueAt(points, 10)).toBe(100);
    expect(seriesValueAt(points, 15)).toBe(75);
  });

  it("returns null outside the series, across a gap, and for an empty series", () => {
    expect(seriesValueAt(points, -1)).toBeNull();
    expect(seriesValueAt(points, 21)).toBeNull();
    expect(seriesValueAt([], 0)).toBeNull();
    expect(seriesValueAt([{ x: 0, y: 1 }, { x: 2, y: Number.NaN }], 1)).toBeNull();
    expect(seriesValueAt([{ x: 3, y: 7 }], 3)).toBe(7);
    expect(seriesValueAt([{ x: 3, y: 7 }], 4)).toBeNull();
    expect(seriesValueAt([{ x: 1, y: 2 }, { x: 1, y: 4 }], 1)).toBe(2);
  });
});

describe("Scale.invert", () => {
  it("undoes project on linear and log scales", () => {
    const linear = linearScale([0, 50], 56, 468);
    const log = logScale([1e-3, 10], 300, 20);
    for (const value of [0, 12.5, 37, 50]) expect(linear.invert(linear.project(value))).toBeCloseTo(value, 9);
    for (const value of [1e-3, 0.02, 1, 10]) expect(log.invert(log.project(value))).toBeCloseTo(value, 9);
  });
});
