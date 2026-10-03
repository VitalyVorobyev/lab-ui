/**
 * The lattice of a detected board: which corner sits at which `(i, j)`, which corners are
 * neighbours, and the polygons of the markers.
 *
 * Ported from vitavision's `overlayData.ts` (`buildCornerGrid`, `buildGridEdges`,
 * `buildFeatureIdByGrid`, `buildMarkerPolygons`), where ChArUco, chessboard, marker board and
 * PuzzleBoard each carried a copy (PuzzleBoard's `buildPuzzleGrid` was a fourth). One
 * implementation now serves all four, on the normalised `TargetDetection` input.
 *
 * Pure: no React, no DOM.
 */

import { latticeEdges } from "@vitavision/stage2d";

import type { TargetCorner, TargetId, TargetMarker } from "./model";

/** A corner that has a place on the board. */
export type GridCorner = TargetCorner & { i: number; j: number };

/** The extent of a lattice, inclusive. */
export interface GridBounds {
  /** Smallest `i`. */
  minI: number;
  /** Largest `i`. */
  maxI: number;
  /** Smallest `j`. */
  minJ: number;
  /** Largest `j`. */
  maxJ: number;
}

/** The corners of a board, indexed by lattice position. */
export interface CornerGrid {
  /** The corners with an integer `(i, j)`, in input order. A repeated `(i, j)` keeps its first corner. */
  nodes: readonly GridCorner[];
  /** Position in `nodes` by `gridKey(i, j)`. */
  byIndex: ReadonlyMap<string, number>;
  /** Positions in `nodes` grouped by `i` (ascending), each group sorted by `j`. */
  rows: readonly (readonly number[])[];
  /** Positions in `nodes` grouped by `j` (ascending), each group sorted by `i`. */
  cols: readonly (readonly number[])[];
  /** The extent, or `null` for an empty grid. */
  bounds: GridBounds | null;
}

/** A segment between two neighbouring corners. */
export interface GridSegment {
  /** Id of the end with the lower index along the edge's axis. */
  a: TargetId;
  /** Id of the end with the higher index. */
  b: TargetId;
  /** Start x. */
  x1: number;
  /** Start y. */
  y1: number;
  /** End x. */
  x2: number;
  /** End y. */
  y2: number;
}

/** A marker as a closed polygon. */
export interface MarkerPolygon {
  /** The marker's id. */
  id: TargetId;
  /** Flat `[x0, y0, x1, y1, …]`; the last vertex joins the first. */
  points: number[];
  /** The mean of the vertices. */
  centre: { x: number; y: number };
  /** The marker's own label, if it has one. */
  label?: string | undefined;
}

/**
 * The key of a lattice position, as `idByGrid` and `CornerGrid.byIndex` use.
 *
 * @param i - Index along the first axis.
 * @param j - Index along the second axis.
 * @returns `"i:j"`.
 */
export function gridKey(i: number, j: number): string {
  return `${i}:${j}`;
}

/** Whether a corner carries an integer lattice index. */
function isGridCorner(corner: TargetCorner): corner is GridCorner {
  return Number.isInteger(corner.i) && Number.isInteger(corner.j);
}

/**
 * Index a board's corners by lattice position.
 *
 * Corners without an integer `(i, j)` are not part of the grid. When two corners claim one
 * position the first wins, as it does in `latticeEdges`.
 *
 * @param corners - The detected corners, in any order, with gaps allowed.
 * @returns The grid.
 */
export function cornerGrid(corners: readonly TargetCorner[]): CornerGrid {
  const nodes: GridCorner[] = [];
  const byIndex = new Map<string, number>();
  const rowMap = new Map<number, number[]>();
  const colMap = new Map<number, number[]>();
  let bounds: GridBounds | null = null;

  for (const corner of corners) {
    if (!isGridCorner(corner)) continue;
    const key = gridKey(corner.i, corner.j);
    if (byIndex.has(key)) continue;
    const position = nodes.length;
    nodes.push(corner);
    byIndex.set(key, position);
    const row = rowMap.get(corner.i);
    if (row) row.push(position);
    else rowMap.set(corner.i, [position]);
    const col = colMap.get(corner.j);
    if (col) col.push(position);
    else colMap.set(corner.j, [position]);
    bounds = bounds
      ? {
          minI: Math.min(bounds.minI, corner.i),
          maxI: Math.max(bounds.maxI, corner.i),
          minJ: Math.min(bounds.minJ, corner.j),
          maxJ: Math.max(bounds.maxJ, corner.j),
        }
      : { minI: corner.i, maxI: corner.i, minJ: corner.j, maxJ: corner.j };
  }

  const ordered = (groups: Map<number, number[]>, by: "i" | "j") =>
    [...groups.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, group]) => group.sort((p, q) => nodes[p]![by] - nodes[q]![by]));
  return { nodes, byIndex, rows: ordered(rowMap, "j"), cols: ordered(colMap, "i"), bounds };
}

/**
 * The edges between neighbouring corners of a grid: `(i, j)` to `(i, j + 1)` are the row edges,
 * `(i, j)` to `(i + 1, j)` the column edges. A missed corner leaves a gap, never a long edge.
 * It is `latticeEdges` from `@vitavision/stage2d` with positions attached.
 *
 * @param grid - From `cornerGrid`.
 * @returns The two edge lists.
 */
export function gridEdges(grid: CornerGrid): { rowEdges: GridSegment[]; colEdges: GridSegment[] } {
  const rowEdges: GridSegment[] = [];
  const colEdges: GridSegment[] = [];
  for (const edge of latticeEdges(grid.nodes)) {
    const a = grid.nodes[edge.a]!;
    const b = grid.nodes[edge.b]!;
    (edge.axis === "j" ? rowEdges : colEdges).push({ a: a.id, b: b.id, x1: a.x, y1: a.y, x2: b.x, y2: b.y });
  }
  return { rowEdges, colEdges };
}

/**
 * The id of the corner at each lattice position, to map a board cell back to an app's feature.
 *
 * @param corners - The detected corners.
 * @returns Ids by `gridKey(i, j)`. A corner without an integer index is left out; the first of two sharing a position wins.
 */
export function idByGrid(corners: readonly TargetCorner[]): Map<string, TargetId> {
  const map = new Map<string, TargetId>();
  for (const corner of corners) {
    if (!isGridCorner(corner)) continue;
    const key = gridKey(corner.i, corner.j);
    if (!map.has(key)) map.set(key, corner.id);
  }
  return map;
}

/**
 * The markers as polygons, with their centres.
 *
 * @param markers - The detected markers.
 * @returns A polygon per marker that has at least three finite vertices; the others are dropped.
 */
export function markerPolygons(markers: readonly TargetMarker[]): MarkerPolygon[] {
  const out: MarkerPolygon[] = [];
  for (const marker of markers) {
    const n = marker.corners.length;
    if (n < 6 || n % 2 !== 0 || !marker.corners.every(Number.isFinite)) continue;
    let sx = 0;
    let sy = 0;
    for (let k = 0; k < n; k += 2) {
      sx += marker.corners[k]!;
      sy += marker.corners[k + 1]!;
    }
    const polygon: MarkerPolygon = {
      id: marker.id,
      points: [...marker.corners],
      centre: { x: sx / (n / 2), y: sy / (n / 2) },
    };
    if (marker.label !== undefined) polygon.label = marker.label;
    out.push(polygon);
  }
  return out;
}
