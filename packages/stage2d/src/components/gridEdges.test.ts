import { describe, expect, it } from "vitest";

import { latticeEdges, type LatticeNode } from "./gridEdges";

/** mulberry32: small, fast, seedable — a failing property run reproduces exactly. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const full = (w: number, h: number): LatticeNode[] => Array.from({ length: w * h }, (_, n) => ({ i: n % w, j: Math.floor(n / w) }));

describe("latticeEdges", () => {
  it("joins the neighbours of a full 3×2 lattice along both axes", () => {
    const edges = latticeEdges(full(3, 2));
    // Nodes: 0 (0,0), 1 (1,0), 2 (2,0), 3 (0,1), 4 (1,1), 5 (2,1).
    expect(edges).toEqual([
      { a: 0, b: 1, axis: "i" },
      { a: 0, b: 3, axis: "j" },
      { a: 1, b: 2, axis: "i" },
      { a: 1, b: 4, axis: "j" },
      { a: 2, b: 5, axis: "j" },
      { a: 3, b: 4, axis: "i" },
      { a: 4, b: 5, axis: "i" },
    ]);
  });

  it("leaves a gap where a node is missing, and does not join across it", () => {
    const nodes = full(3, 1);
    nodes.splice(1, 1); // (1, 0) was not detected
    expect(latticeEdges(nodes)).toEqual([]);
  });

  it("does not depend on the order of the nodes", () => {
    const nodes = full(4, 3);
    const shuffled = [...nodes].reverse();
    const names = (list: LatticeNode[]) =>
      latticeEdges(list)
        .map((e) => `${list[e.a]!.i},${list[e.a]!.j}-${list[e.b]!.i},${list[e.b]!.j}`)
        .sort();
    expect(names(shuffled)).toEqual(names(nodes));
  });

  it("works with negative indices", () => {
    expect(latticeEdges([{ i: -1, j: -1 }, { i: 0, j: -1 }, { i: -1, j: 0 }])).toEqual([
      { a: 0, b: 1, axis: "i" },
      { a: 0, b: 2, axis: "j" },
    ]);
  });

  it("gives no edges to a node with a non-integer or out-of-range index, and keeps the first of two nodes at one index", () => {
    expect(latticeEdges([{ i: 0.5, j: 0 }, { i: 1.5, j: 0 }, { i: Number.NaN, j: 0 }, { i: 2 ** 30, j: 0 }])).toEqual([]);
    const twin = latticeEdges([{ i: 0, j: 0 }, { i: 0, j: 0 }, { i: 1, j: 0 }]);
    expect(twin).toEqual([{ a: 0, b: 2, axis: "i" }]);
    expect(latticeEdges([])).toEqual([]);
  });

  it("agrees with a pairwise scan on random lattices with gaps", { timeout: 30_000 }, () => {
    const rand = prng(42);
    for (let round = 0; round < 40; round++) {
      const nodes = full(2 + Math.floor(rand() * 12), 2 + Math.floor(rand() * 12)).filter(() => rand() < 0.8);
      const expected = new Set<string>();
      nodes.forEach((n, a) =>
        nodes.forEach((m, b) => {
          if (m.j === n.j && m.i === n.i + 1) expected.add(`${a}-${b}-i`);
          if (m.i === n.i && m.j === n.j + 1) expected.add(`${a}-${b}-j`);
        }),
      );
      const edges = latticeEdges(nodes).map((e) => `${e.a}-${e.b}-${e.axis}`);
      expect(new Set(edges)).toEqual(expected);
      expect(edges.length).toBe(expected.size);
    }
  });

  it("has (w-1)h + w(h-1) edges on a full lattice", () => {
    for (const [w, h] of [[1, 1], [1, 5], [7, 1], [6, 4], [20, 20]] as const) {
      expect(latticeEdges(full(w, h)).length).toBe((w - 1) * h + w * (h - 1));
    }
  });
});
