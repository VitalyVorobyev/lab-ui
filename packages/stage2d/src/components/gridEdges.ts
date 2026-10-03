/**
 * The edges of a detected lattice: which nodes are neighbours.
 *
 * A calibration detector returns its corners with integer lattice indices `(i, j)` and gaps
 * where a corner was not found. The edges are not data: node `(i, j)` is joined to
 * `(i + 1, j)` and to `(i, j + 1)` when both exist. This module computes them in O(n) with a
 * hash of the indices. It imports neither React nor the DOM.
 */

/** What `latticeEdges` reads from each node. */
export interface LatticeNode {
  /** The lattice index along the first axis. A non-integer index is not part of the lattice. */
  i: number;
  /** The lattice index along the second axis. A non-integer index is not part of the lattice. */
  j: number;
}

/** The lattice axis an edge runs along: `"i"` joins `(i, j)` to `(i + 1, j)`, `"j"` joins `(i, j)` to `(i, j + 1)`. */
export type LatticeAxis = "i" | "j";

/** An edge between two neighbouring nodes. */
export interface LatticeEdge {
  /** Position in the node array of the end with the lower index along `axis`. */
  a: number;
  /** Position in the node array of the end with the higher index along `axis`. */
  b: number;
  /** The axis it runs along. */
  axis: LatticeAxis;
}

/** Indices past this magnitude are not hashed (the key must stay an exact integer). */
const LIMIT = 2 ** 25;

function key(i: number, j: number): number {
  return (i + LIMIT) * (2 * LIMIT) + (j + LIMIT);
}

/**
 * The edges of a lattice: every pair of nodes whose indices differ by one along exactly one
 * axis.
 *
 * @param nodes - The nodes, in any order, with gaps allowed. A node whose index is not an
 *   integer of magnitude below 2²⁵ takes no edges, and when two nodes share an index the
 *   first one is the lattice's node there.
 * @returns The edges, ordered by the position of `a`, then `"i"` before `"j"`.
 */
export function latticeEdges(nodes: ArrayLike<LatticeNode>): LatticeEdge[] {
  const at = new Map<number, number>();
  const valid = (n: LatticeNode) => Number.isInteger(n.i) && Number.isInteger(n.j) && Math.abs(n.i) < LIMIT && Math.abs(n.j) < LIMIT;
  for (let p = 0; p < nodes.length; p++) {
    const node = nodes[p]!;
    if (!valid(node)) continue;
    const k = key(node.i, node.j);
    if (!at.has(k)) at.set(k, p);
  }
  const edges: LatticeEdge[] = [];
  for (let p = 0; p < nodes.length; p++) {
    const node = nodes[p]!;
    if (!valid(node) || at.get(key(node.i, node.j)) !== p) continue;
    if (node.i + 1 < LIMIT) {
      const q = at.get(key(node.i + 1, node.j));
      if (q !== undefined) edges.push({ a: p, b: q, axis: "i" });
    }
    if (node.j + 1 < LIMIT) {
      const q = at.get(key(node.i, node.j + 1));
      if (q !== undefined) edges.push({ a: p, b: q, axis: "j" });
    }
  }
  return edges;
}
