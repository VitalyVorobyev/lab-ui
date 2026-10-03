/**
 * PuzzleBoard edge bits: from a decoder's observed edges to the dots the overlay draws.
 *
 * A PuzzleBoard encodes its position in the bumps along the edges between corners. The decoder
 * reports each observed edge in the image's own local frame (`row`, `col`), and the alignment
 * that maps that frame into the board's master frame, which is periodic with period 501. The
 * corners are labelled with master indices, so an edge's two corners are found by mapping its
 * local end points through the alignment, modulo the period. This is the arithmetic of
 * vitavision's `PuzzleboardOverlay.buildEdgeMarkers`, as a pure function over structural types,
 * so no detector package is imported.
 *
 * Pure: no React, no DOM.
 */

import { gridKey } from "./lattice";
import type { TargetCorner, TargetEdgeBit } from "./model";

/** The period of the PuzzleBoard master pattern. */
export const PUZZLEBOARD_PERIOD = 501;

/** One observed edge of a PuzzleBoard decode. */
export interface PuzzleboardEdge {
  /** Row of the edge's first corner, in the image's local frame. */
  row: number;
  /** Column of the edge's first corner, in the image's local frame. */
  col: number;
  /** `"horizontal"` joins local `(col, row)` to `(col + 1, row)`; `"vertical"` to `(col, row + 1)`. */
  orientation: "horizontal" | "vertical";
  /** The decoded bit. */
  bit: 0 | 1;
  /** Decode confidence, [0, 1]. */
  confidence: number;
}

/** The map from the local frame to master indices: `master = M · local + translation`, modulo the period. */
export interface PuzzleboardAlignment {
  /** The 2×2 integer matrix `[[a, b], [c, d]]`, acting on local `(i, j)`. */
  transform: { a: number; b: number; c: number; d: number };
  /** The translation, added after the matrix. */
  translation: readonly [number, number];
}

/** `value` modulo `period`, in `[0, period)` for any sign. */
function wrap(value: number, period: number): number {
  return ((value % period) + period) % period;
}

/**
 * The edge bits of a PuzzleBoard decode, placed on the image.
 *
 * An edge is dropped when either of its corners was not detected. Each dot sits at the midpoint
 * of its edge with a radius of a quarter of the edge's length (the bump is about half an edge
 * wide); its opacity is the app's to take from `confidence`.
 *
 * @param edges - The observed edges.
 * @param corners - The labelled corners, whose `i` and `j` are **master** indices.
 * @param alignment - The local-to-master map.
 * @param period - The master pattern's period. Defaults to 501.
 * @returns One `TargetEdgeBit` per edge whose corners were both found, in input order. Empty when there is no alignment.
 */
export function edgeBitsFromPuzzleboard(
  edges: readonly PuzzleboardEdge[],
  corners: readonly TargetCorner[],
  alignment: PuzzleboardAlignment | null | undefined,
  period: number = PUZZLEBOARD_PERIOD,
): TargetEdgeBit[] {
  if (!alignment || edges.length === 0 || corners.length === 0) return [];

  const byMaster = new Map<string, TargetCorner>();
  for (const corner of corners) {
    if (Number.isInteger(corner.i) && Number.isInteger(corner.j)) byMaster.set(gridKey(corner.i!, corner.j!), corner);
  }
  const { a, b, c, d } = alignment.transform;
  const [tx, ty] = alignment.translation;
  const toMaster = (i: number, j: number): string => gridKey(wrap(a * i + b * j + tx, period), wrap(c * i + d * j + ty, period));

  const out: TargetEdgeBit[] = [];
  edges.forEach((edge, index) => {
    // Local coordinates are (i = col, j = row).
    const from = byMaster.get(toMaster(edge.col, edge.row));
    const to = byMaster.get(edge.orientation === "horizontal" ? toMaster(edge.col + 1, edge.row) : toMaster(edge.col, edge.row + 1));
    if (!from || !to) return;
    out.push({
      id: `${edge.orientation}-${edge.row}-${edge.col}-${index}`,
      x: 0.5 * (from.x + to.x),
      y: 0.5 * (from.y + to.y),
      radius: 0.25 * Math.hypot(to.x - from.x, to.y - from.y),
      bit: edge.bit,
      confidence: Math.min(1, Math.max(0, edge.confidence)),
    });
  });
  return out;
}
