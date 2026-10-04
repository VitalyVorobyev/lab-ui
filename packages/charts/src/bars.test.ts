import { describe, expect, it } from "vitest";

import { barsPath, binAt, binValues, cleanCounts, tallest } from "./bars";
import { linearScale } from "./scale";

const area = { x0: 0, x1: 100, y0: 50, y1: 0 };

describe("binValues", () => {
  it("bins over the data extent, the maximum falling in the last bin", () => {
    const { counts, domain } = binValues([0, 1, 2, 3, 4], 4);
    expect(domain).toEqual([0, 4]);
    expect(counts).toEqual([1, 1, 1, 2]);
  });

  it("defaults to 32 bins", () => {
    expect(binValues([1, 2, 3], undefined).counts).toHaveLength(32);
  });

  it("ignores non-finite values", () => {
    const { counts } = binValues([0, 1, Number.NaN, Infinity, -Infinity], 2);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(2);
  });

  it("drops values outside an explicit domain instead of piling them into an end bin", () => {
    const { counts, domain } = binValues([-5, 0.5, 1.5, 99], 2, [0, 2]);
    expect(domain).toEqual([0, 2]);
    expect(counts).toEqual([1, 1]);
  });

  it("puts a single distinct value in a middle bin of a widened domain", () => {
    const { counts, domain } = binValues([5, 5, 5], 5);
    expect(domain[0]).toBeLessThan(5);
    expect(domain[1]).toBeGreaterThan(5);
    expect(counts).toEqual([0, 0, 3, 0, 0]);
  });

  it("gives empty input a drawable domain and all-zero counts", () => {
    expect(binValues([], 4)).toEqual({ counts: [0, 0, 0, 0], domain: [0, 1] });
  });

  it("clamps a nonsensical bin count to at least one", () => {
    expect(binValues([1, 2], 0).counts).toHaveLength(1);
    expect(binValues([1, 2], Number.NaN).counts).toHaveLength(1);
  });

  it("accepts a typed array and a reversed domain", () => {
    const { counts, domain } = binValues(new Float32Array([0.25, 0.75]), 2, [1, 0]);
    expect(domain).toEqual([0, 1]);
    expect(counts).toEqual([1, 1]);
  });
});

describe("cleanCounts", () => {
  it("zeroes negative and non-finite counts", () => {
    expect(cleanCounts([3, -1, Number.NaN, Infinity, 2], [0, 5]).counts).toEqual([3, 0, 0, 0, 2]);
  });

  it("widens a degenerate domain", () => {
    const { domain } = cleanCounts([1], [4, 4]);
    expect(domain[0]).toBeLessThan(domain[1]);
  });

  it("copes with a non-finite domain", () => {
    expect(cleanCounts([1], [Number.NaN, 1]).domain).toEqual([0, 1]);
  });
});

describe("binAt", () => {
  it("finds the containing bin, the upper edge belonging to the last", () => {
    expect(binAt(4, [0, 4], 0)).toBe(0);
    expect(binAt(4, [0, 4], 1.99)).toBe(1);
    expect(binAt(4, [0, 4], 2)).toBe(2);
    expect(binAt(4, [0, 4], 4)).toBe(3);
  });

  it("is null outside the domain, for non-finite x, and with no bins", () => {
    expect(binAt(4, [0, 4], -0.1)).toBeNull();
    expect(binAt(4, [0, 4], 4.1)).toBeNull();
    expect(binAt(4, [0, 4], Number.NaN)).toBeNull();
    expect(binAt(4, [0, 4], null)).toBeNull();
    expect(binAt(4, [0, 4], undefined)).toBeNull();
    expect(binAt(0, [0, 4], 1)).toBeNull();
  });
});

describe("barsPath", () => {
  const y = linearScale([0, 4], area.y0, area.y1);

  it("draws one rectangle per non-empty bin and none for empty ones", () => {
    const d = barsPath([0, 2, 0, 4], y, area);
    expect(d.match(/M/g)).toHaveLength(2);
    expect(d).not.toContain("NaN");
  });

  it("splits a bin out as its own path", () => {
    const counts = [1, 2, 3];
    const rest = barsPath(counts, y, area, { skip: 1 });
    const only = barsPath(counts, y, area, { only: 1 });
    expect(rest.match(/M/g)).toHaveLength(2);
    expect(only.match(/M/g)).toHaveLength(1);
  });

  it("is empty for no counts", () => {
    expect(barsPath([], y, area)).toBe("");
    expect(barsPath([0, 0], y, area)).toBe("");
  });
});

describe("tallest", () => {
  it("is at least 1", () => {
    expect(tallest([])).toBe(1);
    expect(tallest([0, 0])).toBe(1);
    expect(tallest([2, 7], [9])).toBe(9);
  });
});
