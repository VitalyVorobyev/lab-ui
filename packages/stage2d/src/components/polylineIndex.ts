/**
 * A spatial index over many polylines: which one is under the pointer, and which ones a
 * rubber band caught.
 *
 * Asking the DOM is too slow at scale. Measured, `elementFromPoint` over
 * 20k elements takes about 2.1 ms at p95, over a 2 ms budget. A uniform grid of segments answers in
 * microseconds whichever engine draws the lines.
 *
 * Points are flat `[x0, y0, x1, y1, …]` arrays in image coordinates, the form a backend
 * returns and the cheapest to keep.
 */

import type { Point } from "./measureGeometry";
import type { Rect } from "./stage/view";

/** A polyline's identity. */
export type PolylineId = string | number;

/** One polyline: an id, flat image-coordinate points, and whether its last point joins its first. */
export interface Polyline {
  /** Its identity, unique in the set. */
  id: PolylineId;
  /** `[x0, y0, x1, y1, …]` in image coordinates. */
  points: ArrayLike<number>;
  /** Join the last point to the first. */
  closed?: boolean | undefined;
}

/**
 * An index built by `buildPolylineIndex`. Treat it as opaque and query it with
 * `nearestPolyline` and `polylinesInRect`; its layout may change.
 */
export interface PolylineIndex {
  /** The polylines, in the order given. */
  readonly items: readonly Polyline[];
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
  /** CSR layout: cell `c`'s entries are `starts[c] .. starts[c + 1]`. */
  readonly starts: Uint32Array;
  /** Per entry, two numbers: the polyline's index and the segment's start point index. */
  readonly segs: Uint32Array;
}

/** The nearest polyline to a point. */
export interface PolylineHit {
  /** Its id. */
  id: PolylineId;
  /** The closest point on it. */
  point: Point;
  /** The distance to that point. */
  distance: number;
}

/**
 * The number of segments of a polyline.
 *
 * @param points - Flat points.
 * @param closed - Whether the last point joins the first.
 * @returns The segment count.
 */
function segmentCount(points: ArrayLike<number>, closed: boolean): number {
  const n = Math.floor(points.length / 2);
  if (n < 2) return n === 1 ? 1 : 0; // a single point is a zero-length segment, still pickable
  return closed ? n : n - 1;
}

/** The start and end of segment `s` (a single point is its own segment). */
function segment(points: ArrayLike<number>, s: number): [number, number, number, number] {
  const n = Math.floor(points.length / 2);
  // A single point is a zero-length segment; otherwise the next point, wrapping when closed.
  const b = n === 1 ? 0 : (s + 1) % n;
  return [points[2 * s]!, points[2 * s + 1]!, points[2 * b]!, points[2 * b + 1]!];
}

/**
 * Index a set of polylines.
 *
 * @param items - The polylines.
 * @param cell - The grid cell side in image pixels. Defaults to 32: a few segments per cell
 *   at contour densities, and a pointer's search radius spans one or two cells.
 * @returns The index.
 */
export function buildPolylineIndex(items: readonly Polyline[], cell = 32): PolylineIndex {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const item of items) {
    const p = item.points;
    for (let i = 0; i + 1 < p.length; i += 2) {
      const x = p[i]!;
      const y = p[i + 1]!;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (!(maxX >= minX)) {
    return { items, cell, x0: 0, y0: 0, cols: 1, rows: 1, starts: new Uint32Array(2), segs: new Uint32Array(0) };
  }
  const cols = Math.max(1, Math.ceil((maxX - minX) / cell) + 1);
  const rows = Math.max(1, Math.ceil((maxY - minY) / cell) + 1);
  const cellX = (x: number) => Math.min(cols - 1, Math.max(0, Math.floor((x - minX) / cell)));
  const cellY = (y: number) => Math.min(rows - 1, Math.max(0, Math.floor((y - minY) / cell)));

  // Two passes (count, then fill) into a CSR layout: no per-cell arrays.
  const counts = new Uint32Array(cols * rows + 1);
  const visit = (fn: (c: number, item: number, s: number) => void) => {
    items.forEach((item, index) => {
      const closed = item.closed === true;
      const count = segmentCount(item.points, closed);
      for (let s = 0; s < count; s++) {
        const [ax, ay, bx, by] = segment(item.points, s);
        const cx0 = cellX(Math.min(ax, bx));
        const cx1 = cellX(Math.max(ax, bx));
        const cy0 = cellY(Math.min(ay, by));
        const cy1 = cellY(Math.max(ay, by));
        for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) fn(cy * cols + cx, index, s);
      }
    });
  };
  visit((c) => counts[c + 1]!++);
  for (let c = 0; c < cols * rows; c++) counts[c + 1]! += counts[c]!;
  const starts = counts;
  const fill = starts.slice(0, cols * rows);
  const segs = new Uint32Array(starts[cols * rows]! * 2);
  visit((c, item, s) => {
    const k = fill[c]!++;
    segs[2 * k] = item;
    segs[2 * k + 1] = s;
  });
  return { items, cell, x0: minX, y0: minY, cols, rows, starts, segs };
}

/**
 * The polyline nearest to `p` within `radius`, or `null`.
 *
 * @param index - The index.
 * @param p - The point, in image coordinates.
 * @param radius - The search radius, in image pixels.
 * @returns The nearest polyline, the closest point on it and the distance; ties go to the
 *   earlier polyline, so the result does not depend on cell order.
 */
export function nearestPolyline(index: PolylineIndex, p: Point, radius: number): PolylineHit | null {
  const { items, cell, x0, y0, cols, rows, starts, segs } = index;
  const cx0 = Math.max(0, Math.floor((p.x - radius - x0) / cell));
  const cx1 = Math.min(cols - 1, Math.floor((p.x + radius - x0) / cell));
  const cy0 = Math.max(0, Math.floor((p.y - radius - y0) / cell));
  const cy1 = Math.min(rows - 1, Math.floor((p.y + radius - y0) / cell));
  let best: PolylineHit | null = null;
  let bestItem = Infinity;
  let bestD = radius * radius;
  for (let cy = cy0; cy <= cy1; cy++) {
    for (let cx = cx0; cx <= cx1; cx++) {
      const c = cy * cols + cx;
      for (let k = starts[c]!; k < starts[c + 1]!; k++) {
        const itemIndex = segs[2 * k]!;
        const item = items[itemIndex]!;
        const [ax, ay, bx, by] = segment(item.points, segs[2 * k + 1]!);
        const q = closestOnSegment(p, ax, ay, bx, by);
        const d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2;
        if (d < bestD || (d === bestD && itemIndex < bestItem)) {
          bestD = d;
          bestItem = itemIndex;
          best = { id: item.id, point: q, distance: Math.sqrt(d) };
        }
      }
    }
  }
  return best;
}

/**
 * The polylines with any part inside `rect`, in the order they were given.
 *
 * Any part, not any vertex: a long straight contour crossing a rubber band has no vertex
 * inside it and is still what the band was aimed at.
 *
 * @param index - The index.
 * @param rect - The band, in image coordinates.
 * @returns Their ids.
 */
export function polylinesInRect(index: PolylineIndex, rect: Rect): PolylineId[] {
  const { items, cell, x0, y0, cols, rows, starts, segs } = index;
  const hit = new Uint8Array(items.length);
  const cx0 = Math.max(0, Math.floor((rect.x - x0) / cell));
  const cx1 = Math.min(cols - 1, Math.floor((rect.x + rect.width - x0) / cell));
  const cy0 = Math.max(0, Math.floor((rect.y - y0) / cell));
  const cy1 = Math.min(rows - 1, Math.floor((rect.y + rect.height - y0) / cell));
  for (let cy = cy0; cy <= cy1; cy++) {
    for (let cx = cx0; cx <= cx1; cx++) {
      const c = cy * cols + cx;
      for (let k = starts[c]!; k < starts[c + 1]!; k++) {
        const itemIndex = segs[2 * k]!;
        if (hit[itemIndex]) continue;
        const item = items[itemIndex]!;
        const [ax, ay, bx, by] = segment(item.points, segs[2 * k + 1]!);
        if (segmentTouchesRect(ax, ay, bx, by, rect)) hit[itemIndex] = 1;
      }
    }
  }
  const ids: PolylineId[] = [];
  items.forEach((item, i) => {
    if (hit[i]) ids.push(item.id);
  });
  return ids;
}

/**
 * A polyline as an SVG path (`M … L … Z`).
 *
 * @param points - Flat points.
 * @param closed - Whether to close it.
 * @returns The path data; `""` with no points.
 */
export function polylinePath(points: ArrayLike<number>, closed = false): string {
  if (points.length < 2) return "";
  let d = `M${points[0]} ${points[1]}`;
  // A single point draws as a zero-length segment, which round caps show as a dot.
  if (points.length < 4) return `${d}L${points[0]} ${points[1]}`;
  for (let i = 2; i + 1 < points.length; i += 2) d += `L${points[i]} ${points[i + 1]}`;
  return closed ? `${d}Z` : d;
}

/**
 * The bounding box of flat points.
 *
 * @param points - Flat points.
 * @returns The box, or `null` without points.
 */
export function polylineBounds(points: ArrayLike<number>): Rect | null {
  if (points.length < 2) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i + 1 < points.length; i += 2) {
    const x = points[i]!;
    const y = points[i + 1]!;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** The point of segment ab nearest to `p`. Shared with `areaIndex.ts`. */
export function closestOnSegment(p: Point, ax: number, ay: number, bx: number, by: number): Point {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.y - ay) * dy) / len2)) : 0;
  return { x: ax + t * dx, y: ay + t * dy };
}

/** Whether segment ab has any point inside the closed rectangle (Liang–Barsky clip). Shared with `areaIndex.ts`. */
export function segmentTouchesRect(ax: number, ay: number, bx: number, by: number, r: Rect): boolean {
  const xmin = r.x;
  const xmax = r.x + r.width;
  const ymin = r.y;
  const ymax = r.y + r.height;
  let t0 = 0;
  let t1 = 1;
  const dx = bx - ax;
  const dy = by - ay;
  const clip = (p: number, q: number): boolean => {
    if (p === 0) return q >= 0;
    const t = q / p;
    if (p < 0) {
      if (t > t1) return false;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return false;
      if (t < t1) t1 = t;
    }
    return true;
  };
  return clip(-dx, ax - xmin) && clip(dx, xmax - ax) && clip(-dy, ay - ymin) && clip(dy, ymax - ay);
}
