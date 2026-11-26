import { describe, expect, it } from "vitest";

import { changeCounts, describeValue, diffPaths } from "./valueDiff";

const BASE = { solver: { max_iters: 50, loss: "None" }, fix: { k1: false, k2: false }, points: [1, 2, 3], note: null };

describe("diffPaths", () => {
  it("is empty for equal values, and for the same object", () => {
    expect(diffPaths(BASE, BASE)).toEqual([]);
    expect(diffPaths(structuredClone(BASE), BASE)).toEqual([]);
    expect(diffPaths(1, 1)).toEqual([]);
    expect(diffPaths(Number.NaN, Number.NaN)).toEqual([]);
  });

  it("names each differing leaf by its dot path", () => {
    const next = { ...BASE, solver: { ...BASE.solver, max_iters: 80 }, fix: { k1: true, k2: false } };
    expect(diffPaths(next, BASE)).toEqual(["solver.max_iters", "fix.k1"]);
  });

  it("compares equal-length arrays by index and others as a whole", () => {
    expect(diffPaths({ ...BASE, points: [1, 9, 3] }, BASE)).toEqual(["points.1"]);
    expect(diffPaths({ ...BASE, points: [1, 2] }, BASE)).toEqual(["points"]);
    expect(diffPaths({ ...BASE, points: [] }, BASE)).toEqual(["points"]);
  });

  it("treats a key missing on one side as different from a present one, null included", () => {
    const { note: _note, ...without } = BASE;
    expect(diffPaths(without, BASE)).toEqual(["note"]);
    expect(diffPaths({ ...BASE, extra: 1 }, BASE)).toEqual(["extra"]);
    expect(diffPaths({ ...BASE, note: undefined }, BASE)).toEqual(["note"]);
  });

  it("is one path when the values are different kinds", () => {
    expect(diffPaths({ a: [1] }, { a: { 0: 1 } })).toEqual(["a"]);
    expect(diffPaths({ a: 1 }, { a: null })).toEqual(["a"]);
    expect(diffPaths([1], { a: 1 })).toEqual([""]);
    expect(diffPaths(1, undefined)).toEqual([""]);
  });

  it("goes through arrays of objects", () => {
    expect(
      diffPaths(
        {
          cams: [
            { id: "a", f: 1 },
            { id: "b", f: 2 },
          ],
        },
        {
          cams: [
            { id: "a", f: 1 },
            { id: "b", f: 3 },
          ],
        },
      ),
    ).toEqual(["cams.1.f"]);
  });
});

describe("changeCounts", () => {
  it("counts the differing leaves at and under each path, root included", () => {
    const counts = changeCounts(["solver.max_iters", "solver.loss", "fix.k1"]);
    expect(counts.get("solver")).toBe(2);
    expect(counts.get("solver.max_iters")).toBe(1);
    expect(counts.get("fix")).toBe(1);
    expect(counts.get("")).toBe(3);
    expect(counts.get("points")).toBeUndefined();
  });

  it("handles the root as a path, and an empty list", () => {
    expect(changeCounts([""]).get("")).toBe(1);
    expect(changeCounts([]).size).toBe(0);
  });

  it("counts array elements under the array", () => {
    const counts = changeCounts(["a.0.x", "a.2"]);
    expect(counts.get("a")).toBe(2);
    expect(counts.get("a.0")).toBe(1);
  });
});

describe("describeValue", () => {
  it("writes scalars as they read, and unset and none in words", () => {
    expect(describeValue(50)).toBe("50");
    expect(describeValue(false)).toBe("false");
    expect(describeValue("None")).toBe("None");
    expect(describeValue("")).toBe('""');
    expect(describeValue(undefined)).toBe("unset");
    expect(describeValue(null)).toBe("none");
  });

  it("writes structures as JSON and cuts a long one", () => {
    expect(describeValue([1, 2])).toBe("[1,2]");
    const long = describeValue({ key: "x".repeat(100) });
    expect(long).toHaveLength(40);
    expect(long.endsWith("…")).toBe(true);
    expect(describeValue("abcdef", 4)).toBe("abc…");
  });
});
