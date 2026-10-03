/**
 * Property tests for the lattice builders: invariants that hold for any detection, including a
 * sparse one with missed corners. Inputs come from a seeded PRNG, so a failure reproduces.
 */

import { describe, expect, it } from "vitest";

import { cornerGrid, gridEdges, gridKey, idByGrid } from "./lattice";
import type { TargetCorner } from "./model";

const RUNS = 200;

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

/** A lattice window with some corners missing, in shuffled order, with a few unindexed strays. */
function sparseBoard(random: () => number): TargetCorner[] {
  const cols = 1 + Math.floor(random() * 10);
  const rows = 1 + Math.floor(random() * 8);
  const i0 = Math.floor(random() * 600) - 300;
  const j0 = Math.floor(random() * 600) - 300;
  const keep = 0.4 + 0.6 * random();
  const corners: TargetCorner[] = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      if (random() < keep) corners.push({ id: `${i0 + i}:${j0 + j}`, x: random() * 1000, y: random() * 1000, i: i0 + i, j: j0 + j });
    }
  }
  for (let k = 0; k < 3; k++) corners.push({ id: `stray${k}`, x: random(), y: random() });
  return corners.sort(() => random() - 0.5);
}

describe("lattice builders, for any sparse board", () => {
  it("find exactly the pairs of corners one step apart", () => {
    const random = prng(1);
    for (let run = 0; run < RUNS; run++) {
      const corners = sparseBoard(random);
      const present = new Set(corners.filter((c) => c.i !== undefined).map((c) => gridKey(c.i!, c.j!)));
      let expectedRows = 0;
      let expectedCols = 0;
      for (const c of corners) {
        if (c.i === undefined) continue;
        if (present.has(gridKey(c.i, c.j! + 1))) expectedRows++;
        if (present.has(gridKey(c.i + 1, c.j!))) expectedCols++;
      }
      const { rowEdges, colEdges } = gridEdges(cornerGrid(corners));
      expect(rowEdges, `run ${run}`).toHaveLength(expectedRows);
      expect(colEdges, `run ${run}`).toHaveLength(expectedCols);
    }
  });

  it("only ever join corners whose ids carry indices one apart along the edge's axis", () => {
    const random = prng(2);
    for (let run = 0; run < RUNS; run++) {
      const { rowEdges, colEdges } = gridEdges(cornerGrid(sparseBoard(random)));
      const parse = (id: string | number) => String(id).split(":").map(Number) as [number, number];
      for (const e of rowEdges) {
        const [ai, aj] = parse(e.a);
        const [bi, bj] = parse(e.b);
        expect([bi - ai, bj - aj], `run ${run}`).toEqual([0, 1]);
      }
      for (const e of colEdges) {
        const [ai, aj] = parse(e.a);
        const [bi, bj] = parse(e.b);
        expect([bi - ai, bj - aj], `run ${run}`).toEqual([1, 0]);
      }
    }
  });

  it("index every corner that has a position, once, and agree with idByGrid", () => {
    const random = prng(3);
    for (let run = 0; run < RUNS; run++) {
      const corners = sparseBoard(random);
      const grid = cornerGrid(corners);
      const ids = idByGrid(corners);
      expect(grid.nodes.length, `run ${run}`).toBe(corners.filter((c) => c.i !== undefined).length);
      expect(ids.size, `run ${run}`).toBe(grid.nodes.length);
      for (const [key, position] of grid.byIndex) expect(ids.get(key), `run ${run}`).toBe(grid.nodes[position]!.id);
      // Every position appears in exactly one row and one column.
      expect(grid.rows.flat().sort((a, b) => a - b), `run ${run}`).toEqual(grid.nodes.map((_, p) => p));
      expect(grid.cols.flat().sort((a, b) => a - b), `run ${run}`).toEqual(grid.nodes.map((_, p) => p));
    }
  });
});
