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
 * Per primitive, five numbers: its box (`minX`, `minY`, `maxX`, `maxY`, image pixels) and how far
 * past the box its mark reaches in screen pixels (a dot's radius, a cross's arm, an arrow head).
 */
const boxCache = new WeakMap<readonly MeasurePrimitive[], Float64Array>();

function boxesOf(primitives: readonly MeasurePrimitive[]): Float64Array {
  const cached = boxCache.get(primitives);
  if (cached && cached.length === primitives.length * 5) return cached;
  const boxes = new Float64Array(primitives.length * 5);
  primitives.forEach((primitive, i) => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let pad = 0;
    const add = (x: number, y: number) => {
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
      case "segments":
      case "polyline": {
        const s = primitive.points;
        for (let k = 0; k + 1 < s.length; k += 2) add(s[k]!, s[k + 1]!);
        break;
      }
    }
    boxes.set([minX, minY, maxX, maxY, pad], i * 5);
  });
  boxCache.set(primitives, boxes);
  return boxes;
}

/**
 * The primitive nearest to `point` within `radius`, among those with an `id`.
 *
 * Each primitive's bounding box is computed once per `primitives` array and kept while that
 * array lives, so a hover over thousands of primitives costs a box test for most of them.
 * Pass a new array when the primitives change (as React state does): one edited in place keeps
 * its old boxes.
 *
 * @param primitives - The primitives, bottom to top, as `MeasureOverlay` draws them.
 * @param point - The point, in image coordinates.
 * @param radius - The search radius, in image pixels.
 * @param strokeScale - The image-to-screen scale the overlay is drawn at.
 * @returns The nearest primitive's id and distance, or `null`. A tie goes to the later
 *   primitive, which is drawn on top.
 */
export function nearestMeasurePrimitive(
  primitives: readonly MeasurePrimitive[],
  point: Point,
  radius: number,
  strokeScale: number,
): { id: string; distance: number } | null {
  const boxes = boxesOf(primitives);
  const screen = strokeWidthFor(strokeScale, 1);
  let best: { id: string; distance: number } | null = null;
  for (let i = 0; i < primitives.length; i++) {
    const primitive = primitives[i]!;
    if (primitive.id === undefined) continue;
    const reach = radius + boxes[i * 5 + 4]! * screen;
    // Written so that a box with a NaN in it (a primitive with a non-finite coordinate) never contains the point.
    if (
      !(point.x >= boxes[i * 5]! - reach && point.x <= boxes[i * 5 + 2]! + reach && point.y >= boxes[i * 5 + 1]! - reach && point.y <= boxes[i * 5 + 3]! + reach)
    ) {
      continue;
    }
    const distance = measurePrimitiveDistance(primitive, point, strokeScale);
    if (distance <= radius && (best === null || distance <= best.distance)) best = { id: primitive.id, distance };
  }
  return best;
}
