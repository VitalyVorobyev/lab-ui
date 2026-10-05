/**
 * Which measurement primitive is under the pointer: the distance from a point to each kind as
 * `MeasureOverlay` draws it, and the nearest primitive that has an `id`.
 *
 * Pure, so every kind's geometry is tested without a DOM. Distances are in image pixels.
 * Marks that `MeasureOverlay` sizes in screen pixels (a dot, a cross, a caliper's arrow head)
 * are measured at the same size, through `strokeScale`.
 */

import type { MeasurePrimitive } from "./MeasureOverlay";
import {
  arrowHeadPoints,
  caliperArrow,
  caliperCorners,
  dimensionGeometry,
  MEASURE_ARROW_HEAD_PX,
  MEASURE_CROSS_PX,
  MEASURE_DIMENSION_OFFSET,
  MEASURE_POINT_RADIUS_PX,
  strokeWidthFor,
  sweepAngle,
  type Point,
} from "./measureGeometry";
import { closestOnSegment } from "./polylineIndex";
import { toShapeFrame } from "./shapeEdit";

/** The distance from `p` to segment ab. */
function segmentDistance(p: Point, ax: number, ay: number, bx: number, by: number): number {
  const q = closestOnSegment(p, ax, ay, bx, by);
  return Math.hypot(q.x - p.x, q.y - p.y);
}

/**
 * How far a point is from a primitive as drawn, in image pixels.
 *
 * - A dot, a filled circle and a caliper box are areas: the distance is 0 anywhere inside.
 * - Every other kind is a line: the distance to its nearest stroke (a cross's arms, a
 *   circle's or an arc's rim, a dimension's three lines, a caliper's direction arrow).
 * - Labels are not part of a primitive's shape.
 *
 * @param primitive - The primitive.
 * @param point - The point, in image coordinates.
 * @param strokeScale - The image-to-screen scale the overlay is drawn at, which sizes a dot,
 *   a cross and an arrow head.
 * @returns The distance; `Infinity` for a primitive that draws nothing (a zero sweep, an empty
 *   polyline, a kind this version does not know).
 */
export function measurePrimitiveDistance(primitive: MeasurePrimitive, point: Point, strokeScale: number): number {
  const p = point;
  switch (primitive.kind) {
    case "point": {
      if (primitive.cross) {
        const size = strokeWidthFor(strokeScale, MEASURE_CROSS_PX);
        const { x, y } = primitive;
        return Math.min(segmentDistance(p, x - size, y, x + size, y), segmentDistance(p, x, y - size, x, y + size));
      }
      const radius = strokeWidthFor(strokeScale, primitive.radius ?? MEASURE_POINT_RADIUS_PX);
      return Math.max(0, Math.hypot(p.x - primitive.x, p.y - primitive.y) - radius);
    }

    case "segment":
      return segmentDistance(p, primitive.x1, primitive.y1, primitive.x2, primitive.y2);

    case "segments": {
      const s = primitive.points;
      let best = Infinity;
      for (let i = 0; i + 3 < s.length; i += 4) {
        const d = segmentDistance(p, s[i]!, s[i + 1]!, s[i + 2]!, s[i + 3]!);
        if (d < best) best = d;
      }
      return best;
    }

    case "circle": {
      const d = Math.hypot(p.x - primitive.cx, p.y - primitive.cy);
      return primitive.filled ? Math.max(0, d - primitive.r) : Math.abs(d - primitive.r);
    }

    case "arc":
      return arcDistance(primitive.cx, primitive.cy, primitive.r, primitive.startAngle, primitive.endAngle, p);

    case "caliper": {
      const { cx, cy, width, height, angle } = primitive;
      const u = toShapeFrame({ cx, cy, width, height, rotation: angle }, p);
      let best = Math.hypot(Math.max(Math.abs(u.x) - width / 2, 0), Math.max(Math.abs(u.y) - height / 2, 0));
      if (best > 0 && primitive.showDirection !== false) {
        const arrow = caliperArrow(cx, cy, width, angle);
        const [left, tip, right] = arrowHeadPoints(arrow.to, angle, strokeWidthFor(strokeScale, MEASURE_ARROW_HEAD_PX));
        best = Math.min(
          best,
          segmentDistance(p, arrow.from.x, arrow.from.y, arrow.to.x, arrow.to.y),
          segmentDistance(p, left.x, left.y, tip.x, tip.y),
          segmentDistance(p, right.x, right.y, tip.x, tip.y),
        );
      }
      return best;
    }

    case "dimension": {
      const g = dimensionGeometry(primitive.x1, primitive.y1, primitive.x2, primitive.y2, primitive.offset ?? MEASURE_DIMENSION_OFFSET);
      let best = Infinity;
      for (const [a, b] of [g.extensionLine1, g.extensionLine2, g.dimensionLine]) best = Math.min(best, segmentDistance(p, a.x, a.y, b.x, b.y));
      return best;
    }

    case "polyline": {
      const s = primitive.points;
      const n = Math.floor(s.length / 2);
      if (n === 0) return Infinity;
      if (n === 1) return Math.hypot(p.x - s[0]!, p.y - s[1]!);
      let best = Infinity;
      const count = primitive.closed === true ? n : n - 1;
      for (let i = 0; i < count; i++) {
        const j = (i + 1) % n;
        const d = segmentDistance(p, s[2 * i]!, s[2 * i + 1]!, s[2 * j]!, s[2 * j + 1]!);
        if (d < best) best = d;
      }
      return best;
    }

    default:
      return Infinity;
  }
}

/** The distance from `p` to an arc drawn by `arcPath`: its rim within the sweep, else its nearer end. */
function arcDistance(cx: number, cy: number, r: number, startAngle: number, endAngle: number, p: Point): number {
  if (!(r > 0)) return Infinity;
  const sweep = sweepAngle(startAngle, endAngle);
  if (sweep < 1e-9) return Infinity;
  const d = Math.hypot(p.x - cx, p.y - cy);
  const turn = 2 * Math.PI;
  const along = (((Math.atan2(p.y - cy, p.x - cx) - startAngle) % turn) + turn) % turn;
  if (along <= sweep) return Math.abs(d - r);
  const end = (a: number) => Math.hypot(p.x - cx - r * Math.cos(a), p.y - cy - r * Math.sin(a));
  return Math.min(end(startAngle), end(startAngle + sweep));
}

/**
 * The primitives with an `id`, gridded by bounding box: a hover over thousands of them visits
 * a handful of cells, not every primitive.
 */
interface MeasureIndex {
  /** Per primitive, five numbers: its box (`minX`, `minY`, `maxX`, `maxY`, image pixels) and how far past it its mark reaches, in screen pixels. */
  readonly boxes: Float64Array;
  /** The largest such reach. */
  readonly maxPad: number;
  readonly cell: number;
  readonly x0: number;
  readonly y0: number;
  readonly cols: number;
  readonly rows: number;
  /** CSR layout: cell `c`'s primitives are `entries[starts[c] .. starts[c + 1]]`. */
  readonly starts: Uint32Array;
  readonly entries: Uint32Array;
  /** Primitives whose box spans too many cells to grid: checked on every query. */
  readonly large: Uint32Array;
  /** The query each primitive was last visited by, so one in several cells is measured once. */
  readonly seen: Uint32Array;
  query: number;
}

/** A box spanning more cells than this is checked on every query rather than gridded. */
const LARGE_CELLS = 64;

const indexCache = new WeakMap<readonly MeasurePrimitive[], MeasureIndex>();

function indexOf(primitives: readonly MeasurePrimitive[]): MeasureIndex {
  const cached = indexCache.get(primitives);
  if (cached && cached.seen.length === primitives.length) return cached;
  const n = primitives.length;
  const boxes = new Float64Array(n * 5);
  let maxPad = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const gridded: number[] = [];
  for (let i = 0; i < n; i++) {
    const primitive = primitives[i]!;
    const box = boxOf(primitive);
    boxes.set(box, i * 5);
    // Only a primitive with an id can be picked, and only a finite box can contain a point.
    if (primitive.id === undefined || !box.every(Number.isFinite)) continue;
    gridded.push(i);
    if (box[4] > maxPad) maxPad = box[4];
    if (box[0] < minX) minX = box[0];
    if (box[1] < minY) minY = box[1];
    if (box[2] > maxX) maxX = box[2];
    if (box[3] > maxY) maxY = box[3];
  }
  // About one primitive per cell over the occupied extent.
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const cell = gridded.length > 0 ? Math.max(1, Math.sqrt((width * height) / gridded.length)) : 1;
  const cols = gridded.length > 0 ? Math.min(4096, Math.floor(width / cell) + 1) : 1;
  const rows = gridded.length > 0 ? Math.min(4096, Math.floor(height / cell) + 1) : 1;
  const x0 = gridded.length > 0 ? minX : 0;
  const y0 = gridded.length > 0 ? minY : 0;
  const cellX = (x: number) => Math.min(cols - 1, Math.max(0, Math.floor((x - x0) / cell)));
  const cellY = (y: number) => Math.min(rows - 1, Math.max(0, Math.floor((y - y0) / cell)));

  const large: number[] = [];
  const counts = new Uint32Array(cols * rows + 1);
  const spans: [number, number, number, number][] = [];
  for (const i of gridded) {
    const span: [number, number, number, number] = [cellX(boxes[i * 5]!), cellY(boxes[i * 5 + 1]!), cellX(boxes[i * 5 + 2]!), cellY(boxes[i * 5 + 3]!)];
    spans.push(span);
    if ((span[2] - span[0] + 1) * (span[3] - span[1] + 1) > LARGE_CELLS) {
      large.push(i);
      continue;
    }
    for (let cy = span[1]; cy <= span[3]; cy++) for (let cx = span[0]; cx <= span[2]; cx++) counts[cy * cols + cx + 1]!++;
  }
  for (let c = 0; c < cols * rows; c++) counts[c + 1]! += counts[c]!;
  const starts = counts;
  const fill = starts.slice(0, cols * rows);
  const entries = new Uint32Array(starts[cols * rows]!);
  gridded.forEach((i, k) => {
    const span = spans[k]!;
    if ((span[2] - span[0] + 1) * (span[3] - span[1] + 1) > LARGE_CELLS) return;
    for (let cy = span[1]; cy <= span[3]; cy++) for (let cx = span[0]; cx <= span[2]; cx++) entries[fill[cy * cols + cx]!++] = i;
  });

  const index: MeasureIndex = {
    boxes,
    maxPad,
    cell,
    x0,
    y0,
    cols,
    rows,
    starts,
    entries,
    large: Uint32Array.from(large),
    seen: new Uint32Array(n),
    query: 0,
  };
  indexCache.set(primitives, index);
  return index;
}

/** A primitive's box in image pixels, and how far past it its mark reaches in screen pixels. */
function boxOf(primitive: MeasurePrimitive): [number, number, number, number, number] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let pad = 0;
  const add = (x: number, y: number) => {
    // A NaN poisons the box, so that a primitive with one is never picked.
    if (Number.isNaN(x) || Number.isNaN(y)) {
      minX = Number.NaN;
      return;
    }
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };
  switch (primitive.kind) {
    case "point":
      add(primitive.x, primitive.y);
      pad = primitive.cross ? MEASURE_CROSS_PX : (primitive.radius ?? MEASURE_POINT_RADIUS_PX);
      break;
    case "segment":
      add(primitive.x1, primitive.y1);
      add(primitive.x2, primitive.y2);
      break;
    case "circle":
    case "arc":
      add(primitive.cx - primitive.r, primitive.cy - primitive.r);
      add(primitive.cx + primitive.r, primitive.cy + primitive.r);
      break;
    case "caliper": {
      for (const corner of caliperCorners(primitive.cx, primitive.cy, primitive.width, primitive.height, primitive.angle)) add(corner.x, corner.y);
      const tip = caliperArrow(primitive.cx, primitive.cy, primitive.width, primitive.angle).to;
      add(tip.x, tip.y);
      // The head's back corners reach 1.6 × its size behind the tip and 1 × to the side.
      pad = MEASURE_ARROW_HEAD_PX * 2;
      break;
    }
    case "dimension": {
      const g = dimensionGeometry(primitive.x1, primitive.y1, primitive.x2, primitive.y2, primitive.offset ?? MEASURE_DIMENSION_OFFSET);
      for (const [a, b] of [g.extensionLine1, g.extensionLine2]) {
        add(a.x, a.y);
        add(b.x, b.y);
      }
      break;
    }
    case "segments": {
      // Only whole, finite segments are drawn; a skipped one does not poison the rest.
      const s = primitive.points;
      for (let k = 0; k + 3 < s.length; k += 4) {
        if (!(Number.isFinite(s[k]) && Number.isFinite(s[k + 1]) && Number.isFinite(s[k + 2]) && Number.isFinite(s[k + 3]))) continue;
        add(s[k]!, s[k + 1]!);
        add(s[k + 2]!, s[k + 3]!);
      }
      break;
    }
    case "polyline": {
      const s = primitive.points;
      for (let k = 0; k + 1 < s.length; k += 2) add(s[k]!, s[k + 1]!);
      break;
    }
  }
  return [minX, minY, maxX, maxY, pad];
}

/**
 * The primitive nearest to `point` within `radius`, among those with an `id`.
 *
 * The primitives are gridded by bounding box once per `primitives` array, and the grid is
 * kept while that array lives, so a hover over thousands of primitives measures only those
 * near the pointer. Pass a new array when the primitives change (as React state does): one
 * edited in place keeps its old grid.
 *
 * @param primitives - The primitives, bottom to top, as `MeasureOverlay` draws them.
 * @param point - The point, in image coordinates.
 * @param radius - The search radius, in image pixels.
 * @param strokeScale - The image-to-screen scale the overlay is drawn at.
 * @returns The nearest primitive's id and distance, or `null`. A tie goes to the later
 *   primitive, which is drawn on top. A primitive with a NaN coordinate is never picked,
 *   except a `segments` one, whose bad segments are skipped as they are when drawn.
 */
export function nearestMeasurePrimitive(
  primitives: readonly MeasurePrimitive[],
  point: Point,
  radius: number,
  strokeScale: number,
): { id: string; distance: number } | null {
  const index = indexOf(primitives);
  const { boxes, cell, x0, y0, cols, rows, starts, entries, large, seen } = index;
  const screen = strokeWidthFor(strokeScale, 1);
  index.query = (index.query + 1) >>> 0 || 1;
  const query = index.query;
  let best: { id: string; distance: number } | null = null;
  let bestIndex = -1;

  const consider = (i: number) => {
    if (seen[i] === query) return;
    seen[i] = query;
    const reach = radius + boxes[i * 5 + 4]! * screen;
    if (
      !(point.x >= boxes[i * 5]! - reach && point.x <= boxes[i * 5 + 2]! + reach && point.y >= boxes[i * 5 + 1]! - reach && point.y <= boxes[i * 5 + 3]! + reach)
    ) {
      return;
    }
    const primitive = primitives[i]!;
    const distance = measurePrimitiveDistance(primitive, point, strokeScale);
    if (distance > radius) return;
    if (best === null || distance < best.distance || (distance === best.distance && i > bestIndex)) {
      best = { id: primitive.id!, distance };
      bestIndex = i;
    }
  };

  const reach = radius + index.maxPad * screen;
  const cx0 = Math.max(0, Math.floor((point.x - reach - x0) / cell));
  const cx1 = Math.min(cols - 1, Math.floor((point.x + reach - x0) / cell));
  const cy0 = Math.max(0, Math.floor((point.y - reach - y0) / cell));
  const cy1 = Math.min(rows - 1, Math.floor((point.y + reach - y0) / cell));
  for (let cy = cy0; cy <= cy1; cy++) {
    for (let cx = cx0; cx <= cx1; cx++) {
      const c = cy * cols + cx;
      for (let k = starts[c]!; k < starts[c + 1]!; k++) consider(entries[k]!);
    }
  }
  for (let k = 0; k < large.length; k++) consider(large[k]!);
  return best;
}
