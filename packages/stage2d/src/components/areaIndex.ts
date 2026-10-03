/**
 * A spatial index over many closed polygons: which one is under the pointer, and which ones a
 * rubber band touched.
 *
 * The same uniform grid as `polylineIndex.ts` and `pointIndex.ts` (CSR layout, built once per
 * change of the items), but over each polygon's bounding box: a query looks at the polygons
 * whose box is near the pointer and runs the exact tests (even-odd containment, distance to
 * the outline) on those few only. It imports neither React nor the DOM.
 *
 * Polygons are flat `[x0, y0, x1, y1, …]` rings in image coordinates, implicitly closed. A
 * ring with fewer than three vertices has no interior: it is still pickable along its outline
 * (a two-vertex ring is a segment, a one-vertex ring a point), but never "inside".
 */

import type { Point } from "./measureGeometry";
import { closestOnSegment, segmentTouchesRect } from "./polylineIndex";
import type { Rect } from "./stage/view";

/** An area's identity. */
export type AreaId = string | number;

/** One closed polygon. */
export interface Area {
  /** Its identity, unique in the set. */
  id: AreaId;
  /** `[x0, y0, x1, y1, …]` in image coordinates; the last vertex joins the first. */
  points: ArrayLike<number>;
}

/**
 * An index built by `buildAreaIndex`. Treat it as opaque and query it with `nearestArea` and
 * `areasInRect`; its layout may change.
 */
export interface AreaIndex {
  /** The areas, in the order given. */
  readonly items: readonly Area[];
  /** Per area, `[minX, minY, maxX, maxY]`; `NaN`s for an area with no finite vertex. */
  readonly bounds: Float64Array;
  /** Per area, its unsigned area (shoelace), used to prefer the smaller of nested areas. */
  readonly size: Float64Array;
  /** Grid cell side, in image pixels. */
  readonly cell: number;
  /** The grid's origin x. */
  readonly x0: number;
  /** The grid's origin y. */
  readonly y0: number;
  /** Grid columns. */
  readonly cols: number;
  /** Grid rows. */
  readonly rows: number;
  /** CSR layout: cell `c`'s entries are `entries[starts[c] .. starts[c + 1]]`. */
  readonly starts: Uint32Array;
  /** Area indices by cell. */
  readonly entries: Uint32Array;
}

/** The area `nearestArea` picked. */
export interface AreaHit {
  /** Its id. */
  id: AreaId;
  /** Its position in the array the index was built from. */
  index: number;
  /** Whether the query is inside the polygon (even-odd rule). */
  inside: boolean;
  /** The distance from the query to the polygon's outline, in image pixels. */
  distance: number;
}

/** The most grid cells an index allocates, and the most area-to-cell entries. */
const MAX_CELLS = 4_000_000;
const MAX_ENTRIES = 8_000_000;

function vertexCount(points: ArrayLike<number>): number {
  return Math.floor(points.length / 2);
}

/**
 * Whether `(x, y)` is inside the polygon, by the even-odd rule.
 *
 * @param points - Flat ring, implicitly closed.
 * @param x - The query's x.
 * @param y - The query's y.
 * @returns `false` for a ring with fewer than three vertices. A point exactly on the outline
 *   may be either; `nearestArea` treats the outline separately.
 */
export function pointInPolygon(points: ArrayLike<number>, x: number, y: number): boolean {
  const n = vertexCount(points);
  if (n < 3) return false;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = points[2 * i]!;
    const yi = points[2 * i + 1]!;
    const xj = points[2 * j]!;
    const yj = points[2 * j + 1]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * The distance from `(x, y)` to the outline of a polygon (its closing edge included).
 *
 * @param points - Flat ring, implicitly closed.
 * @param x - The query's x.
 * @param y - The query's y.
 * @returns The distance; `Infinity` for an empty ring.
 */
export function distanceToOutline(points: ArrayLike<number>, x: number, y: number): number {
  const n = vertexCount(points);
  if (n === 0) return Infinity;
  const p = { x, y };
  let best = Infinity;
  const edges = n === 1 ? 1 : n === 2 ? 1 : n;
  for (let i = 0; i < edges; i++) {
    const j = n === 1 ? 0 : (i + 1) % n;
    const q = closestOnSegment(p, points[2 * i]!, points[2 * i + 1]!, points[2 * j]!, points[2 * j + 1]!);
    const d = Math.hypot(q.x - x, q.y - y);
    if (d < best) best = d;
  }
  return best;
}

/**
 * The unsigned area of a polygon (shoelace).
 *
 * @param points - Flat ring, implicitly closed.
 * @returns The area; `0` for fewer than three vertices.
 */
export function polygonArea(points: ArrayLike<number>): number {
  const n = vertexCount(points);
  if (n < 3) return 0;
  let sum = 0;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    sum += points[2 * j]! * points[2 * i + 1]! - points[2 * i]! * points[2 * j + 1]!;
  }
  return Math.abs(sum) / 2;
}

/**
 * A polygon as an SVG path (`M … L … Z`) from its first vertex, wound the same way whatever the
 * input's winding.
 * A batched path of overlapping polygons filled with the nonzero rule would otherwise cut a
 * hole where a clockwise ring overlaps an anticlockwise one.
 *
 * @param points - Flat ring.
 * @returns Path data; `""` with no vertices.
 */
export function areaPath(points: ArrayLike<number>): string {
  const n = vertexCount(points);
  if (n === 0) return "";
  let signed = 0;
  for (let i = 0, j = n - 1; i < n; j = i++) signed += points[2 * j]! * points[2 * i + 1]! - points[2 * i]! * points[2 * j + 1]!;
  const reversed = signed < 0;
  const at = (k: number) => (reversed ? (n - k) % n : k); // still starts at vertex 0
  let d = `M${points[2 * at(0)]} ${points[2 * at(0) + 1]}`;
  if (n === 1) return `${d}h0`;
  for (let k = 1; k < n; k++) d += `L${points[2 * at(k)]} ${points[2 * at(k) + 1]}`;
  return `${d}Z`;
}

/**
 * The centre a label is drawn at: the mean of the vertices.
 *
 * @param points - Flat ring.
 * @returns The mean, or `null` for an empty ring.
 */
export function areaCentre(points: ArrayLike<number>): Point | null {
  const n = vertexCount(points);
  if (n === 0) return null;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i++) {
    sx += points[2 * i]!;
    sy += points[2 * i + 1]!;
  }
  return { x: sx / n, y: sy / n };
}

/**
 * Index a set of polygons.
 *
 * @param items - The polygons.
 * @param cell - The grid cell side in image pixels. Defaults to the median of the polygons'
 *   larger bounding-box sides, within `[8, 256]`, doubled if the grid would be huge.
 * @returns The index.
 */
export function buildAreaIndex(items: readonly Area[], cell?: number): AreaIndex {
  const count = items.length;
  const bounds = new Float64Array(count * 4).fill(Number.NaN);
  const size = new Float64Array(count);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const sides: number[] = [];
  items.forEach((item, a) => {
    const p = item.points;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let i = 0; i + 1 < p.length; i += 2) {
      const x = p[i]!;
      const y = p[i + 1]!;
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    if (!(x1 >= x0)) return;
    bounds[4 * a] = x0;
    bounds[4 * a + 1] = y0;
    bounds[4 * a + 2] = x1;
    bounds[4 * a + 3] = y1;
    size[a] = polygonArea(p);
    minX = Math.min(minX, x0);
    minY = Math.min(minY, y0);
    maxX = Math.max(maxX, x1);
    maxY = Math.max(maxY, y1);
    sides.push(Math.max(x1 - x0, y1 - y0));
  });
  if (sides.length === 0) {
    return { items, bounds, size, cell: 1, x0: 0, y0: 0, cols: 1, rows: 1, starts: new Uint32Array(2), entries: new Uint32Array(0) };
  }
  sides.sort((a, b) => a - b);
  let side = cell ?? Math.min(256, Math.max(8, sides[sides.length >> 1]!));
  const width = maxX - minX;
  const height = maxY - minY;
  const cellsAt = (s: number) => (Math.floor(width / s) + 1) * (Math.floor(height / s) + 1);
  const entriesAt = (s: number) => {
    let total = 0;
    for (let a = 0; a < count; a++) {
      if (Number.isNaN(bounds[4 * a]!)) continue;
      total += (Math.floor((bounds[4 * a + 2]! - bounds[4 * a]!) / s) + 1) * (Math.floor((bounds[4 * a + 3]! - bounds[4 * a + 1]!) / s) + 1);
    }
    return total;
  };
  // A pathological extent (one far outlier, a tiny `cell`) must not allocate a huge grid.
  while (cellsAt(side) > MAX_CELLS || entriesAt(side) > MAX_ENTRIES) side *= 2;
  const cols = Math.floor(width / side) + 1;
  const rows = Math.floor(height / side) + 1;
  const cellX = (x: number) => Math.min(cols - 1, Math.max(0, Math.floor((x - minX) / side)));
  const cellY = (y: number) => Math.min(rows - 1, Math.max(0, Math.floor((y - minY) / side)));

  // Two passes (count, then fill) into a CSR layout: no per-cell arrays.
  const starts = new Uint32Array(cols * rows + 1);
  const visit = (fn: (c: number, a: number) => void) => {
    for (let a = 0; a < count; a++) {
      if (Number.isNaN(bounds[4 * a]!)) continue;
      const cx0 = cellX(bounds[4 * a]!);
      const cx1 = cellX(bounds[4 * a + 2]!);
      const cy0 = cellY(bounds[4 * a + 1]!);
      const cy1 = cellY(bounds[4 * a + 3]!);
      for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) fn(cy * cols + cx, a);
    }
  };
  visit((c) => starts[c + 1]!++);
  for (let c = 0; c < cols * rows; c++) starts[c + 1]! += starts[c]!;
  const fill = starts.slice(0, cols * rows);
  const entries = new Uint32Array(starts[cols * rows]!);
  visit((c, a) => {
    entries[fill[c]!++] = a;
  });
  return { items, bounds, size, cell: side, x0: minX, y0: minY, cols, rows, starts, entries };
}

/** Visit each distinct area whose bounding box meets `[left, right] × [top, bottom]`, ascending by index. */
function candidates(index: AreaIndex, left: number, top: number, right: number, bottom: number): number[] {
  const { cell, x0, y0, cols, rows, starts, entries, bounds } = index;
  if (entries.length === 0) return [];
  const cx0 = Math.max(0, Math.floor((left - x0) / cell));
  const cx1 = Math.min(cols - 1, Math.floor((right - x0) / cell));
  const cy0 = Math.max(0, Math.floor((top - y0) / cell));
  const cy1 = Math.min(rows - 1, Math.floor((bottom - y0) / cell));
  const seen = new Set<number>();
  for (let cy = cy0; cy <= cy1; cy++) {
    for (let cx = cx0; cx <= cx1; cx++) {
      const c = cy * cols + cx;
      for (let k = starts[c]!; k < starts[c + 1]!; k++) {
        const a = entries[k]!;
        if (seen.has(a)) continue;
        if (bounds[4 * a]! <= right && bounds[4 * a + 2]! >= left && bounds[4 * a + 1]! <= bottom && bounds[4 * a + 3]! >= top) seen.add(a);
      }
    }
  }
  return [...seen].sort((a, b) => a - b);
}

/**
 * The area under a point: one whose outline passes within `radius`, or else one that contains it.
 *
 * An outline is the more precise gesture, so it wins: among areas whose outline is within
 * `radius` the nearest is picked, and only without one the containing area. Ties (equal
 * distance, or several containing areas) go to the smaller area, so a quad drawn inside a
 * region is picked rather than the region, then to the earlier one. The result does not depend
 * on cell order.
 *
 * @param index - The index.
 * @param p - The query, in image coordinates.
 * @param radius - How far from an outline the query still picks it, in image pixels.
 * @returns The area, or `null`.
 */
export function nearestArea(index: AreaIndex, p: Point, radius: number): AreaHit | null {
  if (!(radius >= 0)) return null;
  const { items, size } = index;
  let edge: AreaHit | null = null;
  let inner: AreaHit | null = null;
  for (const a of candidates(index, p.x - radius, p.y - radius, p.x + radius, p.y + radius)) {
    const points = items[a]!.points;
    const distance = distanceToOutline(points, p.x, p.y);
    const inside = pointInPolygon(points, p.x, p.y);
    const hit: AreaHit = { id: items[a]!.id, index: a, inside, distance };
    if (distance <= radius) {
      if (edge === null || distance < edge.distance || (distance === edge.distance && size[a]! < size[edge.index]!)) edge = hit;
    } else if (inside && (inner === null || size[a]! < size[inner.index]!)) {
      inner = hit;
    }
  }
  return edge ?? inner;
}

/**
 * The areas any part of which is inside `rect`: a vertex, an edge crossing it, or the whole
 * rectangle lying inside the polygon.
 *
 * @param index - The index.
 * @param rect - The band, in image coordinates. A negative extent is read as the box between
 *   its corners.
 * @returns Their ids, in the order the areas were given.
 */
export function areasInRect(index: AreaIndex, rect: Rect): AreaId[] {
  const box = {
    x: Math.min(rect.x, rect.x + rect.width),
    y: Math.min(rect.y, rect.y + rect.height),
    width: Math.abs(rect.width),
    height: Math.abs(rect.height),
  };
  const out: AreaId[] = [];
  for (const a of candidates(index, box.x, box.y, box.x + box.width, box.y + box.height)) {
    if (polygonTouchesRect(index.items[a]!.points, box)) out.push(index.items[a]!.id);
  }
  return out;
}

function polygonTouchesRect(points: ArrayLike<number>, rect: Rect): boolean {
  const n = vertexCount(points);
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;
  for (let i = 0; i < n; i++) {
    const x = points[2 * i]!;
    const y = points[2 * i + 1]!;
    if (x >= rect.x && x <= right && y >= rect.y && y <= bottom) return true;
  }
  const edges = n < 2 ? 0 : n === 2 ? 1 : n;
  for (let i = 0; i < edges; i++) {
    const j = (i + 1) % n;
    if (segmentTouchesRect(points[2 * i]!, points[2 * i + 1]!, points[2 * j]!, points[2 * j + 1]!, rect)) return true;
  }
  return pointInPolygon(points, rect.x, rect.y);
}
