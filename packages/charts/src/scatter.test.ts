import { describe, expect, it } from "vitest";

import { SCATTER_COLOUR_STEPS, colourDomain, colourStep, nearestProjected } from "./scatter";

describe("nearestProjected", () => {
  const xy = [10, 10, 20, 10, 20.5, 10, Number.NaN, 5, 40, 40];
  it("picks the nearest point within the radius", () => {
    expect(nearestProjected(xy, 19, 10, 5)).toBe(1);
    expect(nearestProjected(xy, 21, 10, 5)).toBe(2);
    expect(nearestProjected(xy, 41, 41, 3)).toBe(4);
  });
  it("ignores a non-finite point, a point out of reach and an empty set", () => {
    expect(nearestProjected(xy, 0, 5, 6)).toBe(-1);
    expect(nearestProjected(xy, 100, 100, 5)).toBe(-1);
    expect(nearestProjected([], 0, 0, 5)).toBe(-1);
  });
  it("gives a tie to the lower index", () => {
    expect(nearestProjected([5, 0, 15, 0], 10, 0, 6)).toBe(0);
  });
  it("includes a point exactly at the radius", () => {
    expect(nearestProjected([3, 4], 0, 0, 5)).toBe(0);
  });
});

describe("colourStep", () => {
  it("quantises a value over the domain, clamped", () => {
    expect(colourStep(0, [0, 1])).toBe(0);
    expect(colourStep(1, [0, 1])).toBe(SCATTER_COLOUR_STEPS - 1);
    expect(colourStep(0.5, [0, 1])).toBe(SCATTER_COLOUR_STEPS / 2);
    expect(colourStep(-9, [0, 1])).toBe(0);
    expect(colourStep(9, [0, 1])).toBe(SCATTER_COLOUR_STEPS - 1);
  });
  it("marks a non-finite value -1 and degrades on an empty domain", () => {
    expect(colourStep(Number.NaN, [0, 1])).toBe(-1);
    expect(colourStep(Infinity, [0, 1])).toBe(-1);
    expect(colourStep(3, [2, 2])).toBe(0);
  });
});

describe("colourDomain", () => {
  it("takes the extent of the finite values, a given domain, and centres on zero on request", () => {
    expect(colourDomain([3, Number.NaN, -1, 2], false)).toEqual([-1, 3]);
    expect(colourDomain([3, -1], true)).toEqual([-3, 3]);
    expect(colourDomain([3, -1], false, [0, 10])).toEqual([0, 10]);
    expect(colourDomain([3, -1], true, [-2, 1])).toEqual([-2, 2]);
  });
  it("falls back to a drawable domain without values", () => {
    expect(colourDomain([], false)).toEqual([0, 1]);
    expect(colourDomain([Number.NaN], true)).toEqual([-1, 1]);
  });
});
