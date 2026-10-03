/**
 * A spatial index over many points: which one is under the pointer, which ones a rubber band
 * caught, and which ones are far enough apart to carry a label.
 *
 * The same uniform grid as `polylineIndex.ts`, in CSR layout (cell `c`'s entries are
 * `starts[c] .. starts[c + 1]`, no per-cell arrays), generalised from the L0-3 benchmark's
 * `grid.ts`. It answers in microseconds whichever engine draws the markers
 * (`docs/measurements/stage2d-bench-analysis.md`), and it imports neither React nor the DOM.
 *
 * Points are flat `[x0, y0, x1, y1, …]` arrays in image coordinates, the form a detector
 * returns and the cheapest to keep. A point with a non-finite coordinate is not indexed.
 */

import type { Rect } from "./stage/view";

/** A point's identity. */
export type PointId = string | number;

/** The shape `buildPointIndexFrom` reads from each item. */
export interface PointItem {
  /** Its identity, unique in the set. */
  id: PointId;
  /** Horizontal position, in image coordinates. */
  x: number;
  /** Vertical position, in image coordinates. */
  y: number;
  /** How far from the point a query still picks it, in image pixels. Defaults to `0`. */
  pickRadius?: number | undefined;
}

/** Options of `buildPointIndex`. */
export interface PointIndexOptions {
  /** Ids by point index. Defaults to the index itself. */
  ids?: ArrayLike<PointId> | undefined;
  /**
   * Per-point pick radius, in image pixels. A query at distance `d` from point `i` picks it
   * when `d ≤ radius + radii[i]`, so a ring marker whose circle is data (it scales with the
   * image) can be picked anywhere on it. Defaults to `0` for every point.
   */
  radii?: ArrayLike<number> | undefined;
  /**
   * The grid cell side, in image pixels. Defaults to a side that puts about two points in
   * each cell, bounded to `[4, 256]`.
   */
  cell?: number | undefined;
}

/**
 * An index built by `buildPointIndex`. Treat it as opaque and query it with `nearestPoint`,
 * `pointsInRect` and `thinPoints`; its layout may change.
 */
export interface PointIndex {
  /** The number of points given, indexed or not. */
  readonly count: number;
  /** The points, flat `[x0, y0, …]`. Not copied: do not change it after building. */
  readonly xy: ArrayLike<number>;
  /** Ids by point index, or `null` when a point's id is its index. */
  readonly ids: ArrayLike<PointId> | null;
  /** Per-point pick radii, or `null` when every point has none. */
  readonly radii: ArrayLike<number> | null;
  /** The largest pick radius, widening every query window. */
  readonly maxRadius: number;
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
  /** CSR layout: cell `c`'s entries are `items[starts[c] .. starts[c + 1]]`. */
  readonly starts: Uint32Array;
  /** Point indices by cell, ascending within a cell. */
  readonly items: Uint32Array;
}

/** The nearest point to a query. */
export interface PointHit {
  /** Its index in the array the index was built from. */
  index: number;
  /** Its id. */
  id: PointId;
  /** The distance from the query to the point's centre, in image pixels. */
  dist: number;
}

/** The most grid cells an index allocates, whatever the cell side asks for. */
const MAX_CELLS = 4_000_000;

/**
 * Index a set of points.
 *
 * @param xy - Flat `[x0, y0, x1, y1, …]` in image coordinates; a `Float32Array` or
 *   `Float64Array` avoids a copy at the call site.
 * @param options - Ids, per-point pick radii and the cell side.
 * @returns The index.
 */
export function buildPointIndex(xy: ArrayLike<number>, options: PointIndexOptions = {}): PointIndex {
  const count = Math.floor(xy.length / 2);
  const ids = options.ids ?? null;
  const radii = options.radii ?? null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxRadius = 0;
  let live = 0;
  for (let i = 0; i < count; i++) {
    const x = xy[2 * i]!;
    const y = xy[2 * i + 1]!;
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    live++;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (radii) {
      const r = radii[i]!;
      if (r > maxRadius) maxRadius = r;
    }
  }
  if (live === 0) {
    return {
      count, xy, ids: ids, radii, maxRadius, cell: 1, x0: 0, y0: 0, cols: 1, rows: 1,
      starts: new Uint32Array(2), items: new Uint32Array(0),
    };
  }

  const width = maxX - minX;
  const height = maxY - minY;
  let cell = options.cell ?? Math.min(256, Math.max(4, Math.sqrt((Math.max(width, 1) * Math.max(height, 1) * 2) / live)));
  // A pathological extent (one far outlier, a tiny `cell`) must not allocate a huge grid.
  while ((Math.floor(width / cell) + 1) * (Math.floor(height / cell) + 1) > MAX_CELLS) cell *= 2;
  const cols = Math.floor(width / cell) + 1;
  const rows = Math.floor(height / cell) + 1;
  const cellOf = new Int32Array(count).fill(-1);
  const starts = new Uint32Array(cols * rows + 1);
  for (let i = 0; i < count; i++) {
    const x = xy[2 * i]!;
    const y = xy[2 * i + 1]!;
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const c = Math.min(rows - 1, Math.floor((y - minY) / cell)) * cols + Math.min(cols - 1, Math.floor((x - minX) / cell));
    cellOf[i] = c;
    starts[c + 1]!++;
  }
  for (let c = 0; c < cols * rows; c++) starts[c + 1]! += starts[c]!;
  const fill = starts.slice(0, cols * rows);
  const items = new Uint32Array(live);
  for (let i = 0; i < count; i++) {
    const c = cellOf[i]!;
    if (c >= 0) items[fill[c]!++] = i;
  }
  return { count, xy, ids: ids, radii, maxRadius, cell, x0: minX, y0: minY, cols, rows, starts, items };
}

/**
 * Index items that carry their own position.
 *
 * @param items - The points, in order.
 * @param cell - The grid cell side; see `PointIndexOptions`.
 * @returns The index; its point indices are positions in `items`.
 */
export function buildPointIndexFrom(items: readonly PointItem[], cell?: number): PointIndex {
  const xy = new Float64Array(items.length * 2);
  const ids: PointId[] = new Array<PointId>(items.length);
  let radii: Float64Array | undefined;
  items.forEach((item, i) => {
    xy[2 * i] = item.x;
    xy[2 * i + 1] = item.y;
    ids[i] = item.id;
    if (item.pickRadius !== undefined && item.pickRadius > 0) {
      radii ??= new Float64Array(items.length);
      radii[i] = item.pickRadius;
    }
  });
  return buildPointIndex(xy, { ids, radii, cell });
}

/**
 * The point nearest to `(x, y)` whose pick disc reaches it, or `null`.
 *
 * @param index - The index.
 * @param x - The query's x, in image coordinates.
 * @param y - The query's y, in image coordinates.
 * @param radius - How far from a point's centre the query still picks it, in image pixels.
 *   For a screen-constant tolerance, pass `useScreenPx()(css)`. A point's own `radii` entry
 *   adds to it.
 * @returns The point nearest by centre distance; ties go to the lower index, so the result
 *   does not depend on cell order.
 */
export function nearestPoint(index: PointIndex, x: number, y: number, radius: number): PointHit | null {
  if (!(radius >= 0) || index.items.length === 0) return null;
  const { cell, x0, y0, cols, rows, starts, items, xy, radii, maxRadius } = index;
  const reach = radius + maxRadius;
  const cx0 = Math.max(0, Math.floor((x - reach - x0) / cell));
  const cx1 = Math.min(cols - 1, Math.floor((x + reach - x0) / cell));
  const cy0 = Math.max(0, Math.floor((y - reach - y0) / cell));
  const cy1 = Math.min(rows - 1, Math.floor((y + reach - y0) / cell));
  let best = -1;
  let bestD = Infinity;
  for (let cy = cy0; cy <= cy1; cy++) {
    for (let cx = cx0; cx <= cx1; cx++) {
      const c = cy * cols + cx;
      for (let k = starts[c]!; k < starts[c + 1]!; k++) {
        const i = items[k]!;
        const dx = xy[2 * i]! - x;
        const dy = xy[2 * i + 1]! - y;
        const d = dx * dx + dy * dy;
        const reachI = radii ? radius + radii[i]! : radius;
        if (d <= reachI * reachI && (d < bestD || (d === bestD && i < best))) {
          bestD = d;
          best = i;
        }
      }
    }
  }
  return best < 0 ? null : { index: best, id: index.ids ? index.ids[best]! : best, dist: Math.sqrt(bestD) };
}

/**
 * The points whose centre is inside `rect`, edges included.
 *
 * @param index - The index.
 * @param rect - The band, in image coordinates. A negative extent is read as the box
 *   between its corners.
 * @returns Their indices, ascending.
 */
export function pointsInRect(index: PointIndex, rect: Rect): number[] {
  if (index.items.length === 0) return [];
  const { cell, x0, y0, cols, rows, starts, items, xy } = index;
  const left = Math.min(rect.x, rect.x + rect.width);
  const right = Math.max(rect.x, rect.x + rect.width);
  const top = Math.min(rect.y, rect.y + rect.height);
  const bottom = Math.max(rect.y, rect.y + rect.height);
  const cx0 = Math.max(0, Math.floor((left - x0) / cell));
  const cx1 = Math.min(cols - 1, Math.floor((right - x0) / cell));
  const cy0 = Math.max(0, Math.floor((top - y0) / cell));
  const cy1 = Math.min(rows - 1, Math.floor((bottom - y0) / cell));
  const found: number[] = [];
  for (let cy = cy0; cy <= cy1; cy++) {
    for (let cx = cx0; cx <= cx1; cx++) {
      const c = cy * cols + cx;
      for (let k = starts[c]!; k < starts[c + 1]!; k++) {
        const i = items[k]!;
        const px = xy[2 * i]!;
        const py = xy[2 * i + 1]!;
        if (px >= left && px <= right && py >= top && py <= bottom) found.push(i);
      }
    }
  }
  return found.sort((a, b) => a - b);
}

/**
 * A greedy thinning: walk the points in `order` and keep each one that is at least `minDist`
 * from every point kept so far. This is how a label layer decides which labels the zoom has
 * room for.
 *
 * The result is *maximal*: every point left out is within `minDist` of one kept before it,
 * and every pair kept is at least `minDist` apart.
 *
 * @param xy - Flat points, in the units `minDist` is in (image pixels for a screen-px spacing
 *   converted with `useScreenPx`).
 * @param minDist - The least distance between two kept points.
 * @param order - Point indices in priority order. Defaults to every point, in order.
 *   Indices of non-finite points are skipped.
 * @returns The kept indices, in the order they were kept.
 */
export function thinPoints(xy: ArrayLike<number>, minDist: number, order?: Iterable<number>): number[] {
  const kept: number[] = [];
  if (!(minDist > 0)) {
    for (const i of order ?? range(Math.floor(xy.length / 2))) if (isLive(xy, i)) kept.push(i);
    return kept;
  }
  // Cells of side `minDist`: any kept point closer than `minDist` is in the 3×3 block around
  // the candidate's cell. The cell only bounds the search; the check compares true distances.
  // A key can alias for coordinates beyond ±2²¹ cells, which only adds candidates to a scan.
  const cells = new Map<number, number[]>();
  const key = (cx: number, cy: number) => cy * 4_194_304 + cx;
  const limit = minDist * minDist;
  for (const i of order ?? range(Math.floor(xy.length / 2))) {
    if (!isLive(xy, i)) continue;
    const x = xy[2 * i]!;
    const y = xy[2 * i + 1]!;
    const cx = Math.floor(x / minDist);
    const cy = Math.floor(y / minDist);
    let clear = true;
    scan: for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const bucket = cells.get(key(cx + dx, cy + dy));
        if (!bucket) continue;
        for (const j of bucket) {
          const ex = xy[2 * j]! - x;
          const ey = xy[2 * j + 1]! - y;
          if (ex * ex + ey * ey < limit) {
            clear = false;
            break scan;
          }
        }
      }
    }
    if (!clear) continue;
    kept.push(i);
    const k = key(cx, cy);
    const bucket = cells.get(k);
    if (bucket) bucket.push(i);
    else cells.set(k, [i]);
  }
  return kept;
}

function isLive(xy: ArrayLike<number>, i: number): boolean {
  return Number.isFinite(xy[2 * i]) && Number.isFinite(xy[2 * i + 1]);
}

function* range(n: number): Generator<number> {
  for (let i = 0; i < n; i++) yield i;
}
