import { describe, expect, it } from "vitest";

import { cornerGrid, gridEdges, gridKey, idByGrid, markerPolygons } from "./lattice";
import type { TargetCorner, TargetMarker } from "./model";

const corner = (id: string, i: number | undefined, j: number | undefined, x = 0, y = 0): TargetCorner => ({ id, x, y, i, j });

/** A 3×2 lattice (i = 0..2, j = 0..1) laid out at 10 px, ids `i-j`. */
const FULL = Array.from({ length: 6 }, (_, n) => {
  const i = n % 3;
  const j = Math.floor(n / 3);
  return corner(`${i}-${j}`, i, j, 10 * i, 10 * j);
});

describe("cornerGrid", () => {
  it("indexes corners by lattice position and reports the extent", () => {
    const grid = cornerGrid(FULL);
    expect(grid.nodes).toHaveLength(6);
    expect(grid.nodes[grid.byIndex.get(gridKey(2, 1))!]!.id).toBe("2-1");
    expect(grid.bounds).toEqual({ minI: 0, maxI: 2, minJ: 0, maxJ: 1 });
  });

  it("groups rows by i sorted by j, and columns by j sorted by i, whatever the input order", () => {
    const grid = cornerGrid([...FULL].reverse());
    expect(grid.rows.map((row) => row.map((p) => grid.nodes[p]!.id))).toEqual([["0-0", "0-1"], ["1-0", "1-1"], ["2-0", "2-1"]]);
    expect(grid.cols.map((col) => col.map((p) => grid.nodes[p]!.id))).toEqual([["0-0", "1-0", "2-0"], ["0-1", "1-1", "2-1"]]);
  });

  it("leaves out corners with no integer index, and keeps the first of a repeated position", () => {
    const grid = cornerGrid([corner("a", 0, 0), corner("loose", undefined, undefined), corner("half", 1, undefined), corner("frac", 0.5, 0), corner("dup", 0, 0)]);
    expect(grid.nodes.map((n) => n.id)).toEqual(["a"]);
  });

  it("is empty for no corners", () => {
    const grid = cornerGrid([]);
    expect(grid.nodes).toEqual([]);
    expect(grid.bounds).toBeNull();
    expect(grid.rows).toEqual([]);
  });

  it("handles negative indices", () => {
    expect(cornerGrid([corner("a", -2, 3), corner("b", 1, -4)]).bounds).toEqual({ minI: -2, maxI: 1, minJ: -4, maxJ: 3 });
  });
});

describe("gridEdges", () => {
  it("joins neighbours: row edges along j, column edges along i", () => {
    const { rowEdges, colEdges } = gridEdges(cornerGrid(FULL));
    // 3 rows of i, each with one j-step; 2 columns of j, each with two i-steps.
    expect(rowEdges).toHaveLength(3);
    expect(colEdges).toHaveLength(4);
    expect(rowEdges).toContainEqual({ a: "1-0", b: "1-1", x1: 10, y1: 0, x2: 10, y2: 10 });
    expect(colEdges).toContainEqual({ a: "0-1", b: "1-1", x1: 0, y1: 10, x2: 10, y2: 10 });
  });

  it("leaves a gap where a corner was not found, never a long edge", () => {
    const { rowEdges, colEdges } = gridEdges(cornerGrid(FULL.filter((c) => c.id !== "1-0")));
    expect(rowEdges.map((e) => `${e.a}>${e.b}`).sort()).toEqual(["0-0>0-1", "2-0>2-1"]);
    // (1, 0) is gone: no column edge may bridge (0, 0) and (2, 0).
    expect(colEdges.map((e) => `${e.a}>${e.b}`).sort()).toEqual(["0-1>1-1", "1-1>2-1"]);
  });

  it("does not join corners whose indices skip", () => {
    expect(gridEdges(cornerGrid([corner("a", 0, 0), corner("b", 0, 2)])).rowEdges).toEqual([]);
  });
});

describe("idByGrid", () => {
  it("maps each lattice position to its corner's id", () => {
    const map = idByGrid(FULL);
    expect(map.get(gridKey(2, 0))).toBe("2-0");
    expect(map.size).toBe(6);
  });

  it("skips corners without an index, and keeps the first of a repeated position", () => {
    const map = idByGrid([corner("a", 0, 0), corner("b", undefined, 1), corner("dup", 0, 0)]);
    expect([...map.entries()]).toEqual([["0:0", "a"]]);
  });
});

describe("markerPolygons", () => {
  const quad: TargetMarker = { id: 7, corners: [0, 0, 10, 0, 10, 10, 0, 10] };

  it("returns the polygon and its centre", () => {
    expect(markerPolygons([quad])).toEqual([{ id: 7, points: [0, 0, 10, 0, 10, 10, 0, 10], centre: { x: 5, y: 5 } }]);
  });

  it("carries a label through", () => {
    expect(markerPolygons([{ ...quad, label: "A7" }])[0]!.label).toBe("A7");
  });

  it("copies the vertices, so the polygon does not alias the input", () => {
    const polygon = markerPolygons([quad])[0]!;
    polygon.points[0] = 99;
    expect(quad.corners[0]).toBe(0);
  });

  it("drops a marker with fewer than three vertices, an odd count, or a non-finite coordinate", () => {
    const bad: TargetMarker[] = [
      { id: 1, corners: [0, 0, 1, 1] },
      { id: 2, corners: [0, 0, 1, 1, 2, 2, 3] },
      { id: 3, corners: [0, 0, 1, 0, Number.NaN, 1, 0, 1] },
      { id: 4, corners: [] },
    ];
    expect(markerPolygons([...bad, quad]).map((p) => p.id)).toEqual([7]);
  });
});
