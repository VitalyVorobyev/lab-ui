/**
 * A spatial index over many ellipses: which one is under the pointer, and which ones a
 * rubber band touched.
 *
 * The grid is `areaIndex.ts`'s (CSR layout over bounding boxes, built once per change of the
 * items); a query runs the exact tests on the few ellipses whose box is near the pointer. The
 * exact tests are in the ellipse's own frame: containment is one quadratic form, and the
 * distance to the outline is the true Euclidean distance (a few Newton steps on the
 * parametrisation), not a scaled approximation, so a thin ellipse is picked as precisely as a
 * round one. It imports neither React nor the DOM.
 *
 * An ellipse with a non-finite value or a semi-axis not above zero is skipped: it has no
 * outline to draw or to pick.
 */

import { areaCandidates, buildAreaIndex, type AreaIndex } from "./areaIndex";
import type { Point } from "./measureGeometry";
import type { Rect } from "./stage/view";

/** An ellipse's identity. */
export type EllipseId = string | number;

/** One ellipse. */
export interface Ellipse {
  /** Its identity, unique in the set. */
  id: EllipseId;
  /** Centre x, image pixels. */
  x: number;
  /** Centre y, image pixels. */
  y: number;
  /** Semi-axis along the rotated x axis, image pixels. */
  rx: number;
  /** Semi-axis along the rotated y axis, image pixels. */
  ry: number;
  /** Rotation of the `rx` axis, radians clockwise on screen (y points down). Defaults to 0. */
  angle?: number | undefined;
}

/**
 * An index built by `buildEllipseIndex`. Treat it as opaque and query it with `nearestEllipse`
 * and `ellipsesInRect`; its layout may change.
 */
export interface EllipseIndex {
  /** The ellipses, in the order given. */
  readonly items: readonly Ellipse[];
  /** The grid over their bounding boxes (an `AreaIndex` of boxes, one per ellipse). */
  readonly grid: AreaIndex;
  /** Per ellipse, its area `π·rx·ry`, used to prefer the smaller of nested ellipses; `NaN` for a degenerate one. */
  readonly size: Float64Array;
}

/** The ellipse `nearestEllipse` picked. */
export interface EllipseHit {
  /** Its id. */
  id: EllipseId;
  /** Its position in the array the index was built from. */
  index: number;
  /** Whether the query is inside the ellipse. */
  inside: boolean;
  /** The distance from the query to the ellipse's outline, in image pixels (also when inside). */
  distance: number;
}

function usable(e: Ellipse): boolean {
  return e.rx > 0 && e.ry > 0 && Number.isFinite(e.x + e.y + e.rx + e.ry + (e.angle ?? 0));
}

/**
 * The axis-aligned bounding box of an ellipse.
 *
 * @param e - The ellipse.
 * @returns `[minX, minY, maxX, maxY]`, or `null` for a degenerate ellipse.
 */
export function ellipseBounds(e: Ellipse): [number, number, number, number] | null {
  if (!usable(e)) return null;
  const c = Math.cos(e.angle ?? 0);
  const s = Math.sin(e.angle ?? 0);
  const hx = Math.hypot(e.rx * c, e.ry * s);
  const hy = Math.hypot(e.rx * s, e.ry * c);
  return [e.x - hx, e.y - hy, e.x + hx, e.y + hy];
}

/** The query in the ellipse's frame: translated to its centre and rotated by `-angle`. */
function toFrame(e: Ellipse, x: number, y: number): Point {
  const c = Math.cos(e.angle ?? 0);
  const s = Math.sin(e.angle ?? 0);
  const dx = x - e.x;
  const dy = y - e.y;
  return { x: c * dx + s * dy, y: -s * dx + c * dy };
}

/**
 * Whether `(x, y)` is inside the ellipse (its outline counts as inside).
 *
 * @param e - The ellipse.
 * @param x - The query's x.
 * @param y - The query's y.
 * @returns `false` for a degenerate ellipse.
 */
export function pointInEllipse(e: Ellipse, x: number, y: number): boolean {
  if (!usable(e)) return false;
  const p = toFrame(e, x, y);
  return (p.x / e.rx) ** 2 + (p.y / e.ry) ** 2 <= 1;
}

/** Newton steps on the ellipse's parametrisation; enough to converge from the start below. */
const NEWTON_STEPS = 12;

/**
 * The Euclidean distance from `(x, y)` to the outline of an ellipse.
 *
 * The query is folded into the first quadrant of the ellipse's frame and the nearest outline
 * point found by Newton's method on the parameter `θ` of `(a·cos θ, b·sin θ)`, started from the
 * better of a coarse scan so a thin ellipse and a query near its centre both converge.
 *
 * @param e - The ellipse.
 * @param x - The query's x.
 * @param y - The query's y.
 * @returns The distance; `Infinity` for a degenerate ellipse.
 */
export function distanceToEllipse(e: Ellipse, x: number, y: number): number {
  if (!usable(e)) return Infinity;
  const p = toFrame(e, x, y);
  const px = Math.abs(p.x);
  const py = Math.abs(p.y);
  const a = e.rx;
  const b = e.ry;
  const squared = (t: number) => (a * Math.cos(t) - px) ** 2 + (b * Math.sin(t) - py) ** 2;
  // The squared distance can have two local minima in the quadrant (a query near the centre of
  // a thin ellipse), so start from the best of a coarse scan, then polish.
  let t = 0;
  let best = Infinity;
  const SCAN = 16;
  for (let k = 0; k <= SCAN; k++) {
    const candidate = (k / SCAN) * (Math.PI / 2);
    const value = squared(candidate);
    if (value < best) {
      best = value;
      t = candidate;
    }
  }
  for (let i = 0; i < NEWTON_STEPS; i++) {
    const c = Math.cos(t);
    const s = Math.sin(t);
    // f(θ) = d/dθ of half the squared distance; f' by differentiating again.
    const f = (b * b - a * a) * s * c + a * px * s - b * py * c;
    const df = (b * b - a * a) * (c * c - s * s) + a * px * c + b * py * s;
    if (!(Math.abs(df) > 1e-12)) break;
    const next = Math.min(Math.PI / 2, Math.max(0, t - f / df));
    if (squared(next) > squared(t)) break; // a step that does not descend is noise
    t = next;
  }
  return Math.sqrt(squared(t));
}

/**
 * An ellipse as an SVG path: two arcs, exactly, so it stays round at any zoom.
 *
 * @param cx - Centre x, image pixels.
 * @param cy - Centre y, image pixels.
 * @param rx - Semi-axis along the rotated x axis, image pixels.
 * @param ry - Semi-axis along the rotated y axis, image pixels.
 * @param angle - Rotation of the `rx` axis, radians clockwise on screen.
 * @returns Path data, or `""` for a degenerate ellipse (a non-finite value, or a radius not above zero).
 */
export function ellipsePath(cx: number, cy: number, rx: number, ry: number, angle = 0): string {
  if (!(rx > 0) || !(ry > 0) || !Number.isFinite(cx + cy + rx + ry + angle)) return "";
  const dx = rx * Math.cos(angle);
  const dy = rx * Math.sin(angle);
  const degrees = round((angle * 180) / Math.PI);
  const arc = `A${round(rx)} ${round(ry)} ${degrees} 1 0`;
  return `M${round(cx + dx)} ${round(cy + dy)}${arc} ${round(cx - dx)} ${round(cy - dy)}${arc} ${round(cx + dx)} ${round(cy + dy)}`;
}

/** Round to 1/1000 of an image pixel. */
function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * Index a set of ellipses.
 *
 * @param items - The ellipses.
 * @param cell - The grid cell side in image pixels; see `buildAreaIndex` for the default.
 * @returns The index.
 */
export function buildEllipseIndex(items: readonly Ellipse[], cell?: number): EllipseIndex {
  const size = new Float64Array(items.length).fill(Number.NaN);
  const boxes = items.map((item, i) => {
    const box = ellipseBounds(item);
    if (box === null) return { id: i, points: [] as number[] };
    size[i] = Math.PI * item.rx * item.ry;
    const [x0, y0, x1, y1] = box;
    return { id: i, points: [x0, y0, x1, y0, x1, y1, x0, y1] };
  });
  return { items, grid: buildAreaIndex(boxes, cell), size };
}

/**
 * The ellipse under a point: one whose outline passes within `radius`, or else one that
 * contains it.
 *
 * An outline is the more precise gesture, so it wins: among ellipses whose outline is within
 * `radius` the nearest is picked, and only without one the containing ellipse. Ties (equal
 * distance, or several containing ellipses) go to the smaller ellipse, so a ring drawn inside
 * another is picked rather than the outer one, then to the earlier one.
 *
 * @param index - The index.
 * @param p - The query, in image coordinates.
 * @param radius - How far from an outline the query still picks it, in image pixels.
 * @returns The ellipse, or `null`.
 */
export function nearestEllipse(index: EllipseIndex, p: Point, radius: number): EllipseHit | null {
  if (!(radius >= 0)) return null;
  const { items, size } = index;
  let edge: EllipseHit | null = null;
  let inner: EllipseHit | null = null;
  for (const a of areaCandidates(index.grid, p.x - radius, p.y - radius, p.x + radius, p.y + radius)) {
    const e = items[a]!;
    const distance = distanceToEllipse(e, p.x, p.y);
    const hit: EllipseHit = { id: e.id, index: a, inside: pointInEllipse(e, p.x, p.y), distance };
    if (distance <= radius) {
      if (edge === null || distance < edge.distance || (distance === edge.distance && size[a]! < size[edge.index]!)) edge = hit;
    } else if (hit.inside && (inner === null || size[a]! < size[inner.index]!)) {
      inner = hit;
    }
  }
  return edge ?? inner;
}

/**
 * The ellipses any part of which is inside `rect`: the rectangle meets the outline, or lies
 * inside the ellipse, or contains it.
 *
 * @param index - The index.
 * @param rect - The band, in image coordinates. A negative extent is read as the box between
 *   its corners.
 * @returns Their ids, in the order the ellipses were given.
 */
export function ellipsesInRect(index: EllipseIndex, rect: Rect): EllipseId[] {
  const x0 = Math.min(rect.x, rect.x + rect.width);
  const y0 = Math.min(rect.y, rect.y + rect.height);
  const x1 = Math.max(rect.x, rect.x + rect.width);
  const y1 = Math.max(rect.y, rect.y + rect.height);
  const out: EllipseId[] = [];
  for (const a of areaCandidates(index.grid, x0, y0, x1, y1)) {
    const e = index.items[a]!;
    if (rectMeetsEllipse(e, x0, y0, x1, y1)) out.push(e.id);
  }
  return out;
}

/** Whether the filled ellipse and the rectangle share a point (both convex). */
function rectMeetsEllipse(e: Ellipse, x0: number, y0: number, x1: number, y1: number): boolean {
  // The rectangle contains the ellipse (its centre is inside), the ellipse contains a corner,
  // or an edge crosses the ellipse with both end points outside it: the three ways two convex
  // shapes meet.
  if (e.x >= x0 && e.x <= x1 && e.y >= y0 && e.y <= y1) return true;
  const corners: Point[] = [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
  if (corners.some((c) => pointInEllipse(e, c.x, c.y))) return true;
  // Minimise the ellipse's quadratic form along each edge, in the ellipse's frame.
  for (let k = 0; k < 4; k++) {
    const a = toFrame(e, corners[k]!.x, corners[k]!.y);
    const b = toFrame(e, corners[(k + 1) % 4]!.x, corners[(k + 1) % 4]!.y);
    const ux = (b.x - a.x) / e.rx;
    const uy = (b.y - a.y) / e.ry;
    const vx = a.x / e.rx;
    const vy = a.y / e.ry;
    const len2 = ux * ux + uy * uy;
    const t = len2 > 0 ? Math.min(1, Math.max(0, -(ux * vx + uy * vy) / len2)) : 0;
    if ((vx + t * ux) ** 2 + (vy + t * uy) ** 2 <= 1) return true;
  }
  return false;
}
