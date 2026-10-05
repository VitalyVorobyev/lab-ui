/**
 * A contour as a path measured along its length: where a distance along it lands, the
 * nearest place on it to a point, a stretch of it, and the two edits a brush makes (push a
 * part of it, erase a stretch of it).
 *
 * An **arc length** `s` is a distance along the path from its first vertex, in image pixels.
 * An open path runs from the first vertex to the last; a closed one goes on from the last
 * vertex back to the first, so its length includes that closing segment. Every function
 * takes `closed` (default `false`, an open path) and treats the points the same way.
 *
 * Kept pure, so the laws that matter are property-tested: arc length only grows, every vertex
 * sits at its own arc length, a projection is never farther than the nearest vertex, and an
 * erase leaves exactly the length it did not remove.
 */

import type { Point } from "./measureGeometry";

/**
 * The cumulative arc length at each vertex.
 *
 * @param points - The path's vertices.
 * @param closed - Whether the last vertex joins the first. Defaults to `false`.
 * @returns `s[i]`, the length of the path from the first vertex to vertex `i`, so `s[0]` is 0.
 *   A closed path has one more entry: its whole length, back at the first vertex. The last
 *   entry is always the path's length. An empty path gives `[]`.
 */
export function arcLengths(points: readonly Point[], closed = false): number[] {
  if (points.length === 0) return [];
  const out = [0];
  let total = 0;
  const ring = ringOf(points, closed);
  for (let i = 1; i < ring.length; i++) {
    total += distance(ring[i - 1]!, ring[i]!);
    out.push(total);
  }
  return out;
}

/**
 * The point at arc length `s`.
 *
 * @param points - The path's vertices.
 * @param s - The distance along the path, in image pixels. On an open path it is clamped to
 *   `[0, length]`; on a closed path it wraps around.
 * @param closed - Whether the last vertex joins the first. Defaults to `false`.
 * @returns The point. An empty path gives `NaN` coordinates.
 */
export function pointAtArc(points: readonly Point[], s: number, closed = false): Point {
  const ring = ringOf(points, closed);
  const cum = arcLengths(points, closed);
  return pointOn(ring, cum, arcPosition(cum, s, closed));
}

/**
 * The nearest place on the path to a point.
 *
 * @param points - The path's vertices.
 * @param p - The point, in image coordinates.
 * @param closed - Whether the last vertex joins the first. Defaults to `false`.
 * @returns `s`, the arc length of the nearest place (the first one, on a tie); `point`, the
 *   place itself; and `distance`, how far `p` is from it. An empty path gives `s` 0, a `NaN`
 *   point and an infinite distance.
 */
export function projectToArc(points: readonly Point[], p: Point, closed = false): { s: number; point: Point; distance: number } {
  const ring = ringOf(points, closed);
  const cum = arcLengths(points, closed);
  if (ring.length === 0) return { s: 0, point: { x: NaN, y: NaN }, distance: Infinity };
  let best = { s: 0, point: { x: ring[0]!.x, y: ring[0]!.y }, distance: distance(ring[0]!, p) };
  for (let i = 0; i + 1 < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[i + 1]!;
    const t = segmentParameter(a, b, p);
    const on = lerp(a, b, t);
    const d = distance(on, p);
    if (d < best.distance) best = { s: cum[i]! + t * (cum[i + 1]! - cum[i]!), point: on, distance: d };
  }
  return best;
}

/**
 * The stretch of the path between two arc lengths, as a polyline: the place at `s0`, every
 * vertex strictly between, and the place at `s1`.
 *
 * @param points - The path's vertices.
 * @param s0 - Where the stretch starts.
 * @param s1 - Where it ends.
 * @param closed - Whether the last vertex joins the first. Defaults to `false`. On an open
 *   path both ends are clamped to it and the stretch always runs forward (`s0` and `s1` are
 *   swapped when `s0 > s1`). On a closed path an end outside `[0, length]` wraps, and with
 *   `s0 > s1` the stretch runs forward past the first vertex and on to `s1`.
 * @returns The stretch, at least its two ends (the same point twice for an empty stretch).
 *   An empty path gives `[]`.
 */
export function subPath(points: readonly Point[], s0: number, s1: number, closed = false): Point[] {
  if (points.length === 0) return [];
  const ring = ringOf(points, closed);
  const cum = arcLengths(points, closed);
  const total = cum[cum.length - 1]!;
  let a = arcPosition(cum, s0, closed);
  let b = arcPosition(cum, s1, closed);
  if (!closed && a > b) [a, b] = [b, a];
  if (a <= b) return stretch(ring, cum, a, b);
  return [...stretch(ring, cum, a, total), ...stretch(ring, cum, 0, b).slice(1)];
}

/**
 * The unit normal at arc length `s`: the tangent of the segment there, turned a quarter turn
 * by `(tx, ty) → (-ty, tx)`. With image `y` pointing down that turn is **clockwise on
 * screen**: on a path running left to right the normal points down, and on a closed contour
 * whose vertices run clockwise on screen it points inward.
 *
 * @param points - The path's vertices.
 * @param s - The distance along the path, clamped or wrapped as in `pointAtArc`. At a vertex
 *   the segment that starts there is used (at the end of an open path, the last one).
 * @param closed - Whether the last vertex joins the first. Defaults to `false`.
 * @returns A unit vector, or `{ x: 0, y: 0 }` for a path with no length.
 */
export function normalAtArc(points: readonly Point[], s: number, closed = false): Point {
  const ring = ringOf(points, closed);
  const cum = arcLengths(points, closed);
  if (ring.length < 2) return { x: 0, y: 0 };
  const start = segmentAt(cum, arcPosition(cum, s, closed));
  // The segment there, or the nearest one with a length: forward first, then back.
  const order = [...range(start, ring.length - 1), ...range(0, start).reverse()];
  for (const i of order) {
    const a = ring[i]!;
    const b = ring[i + 1]!;
    const length = distance(a, b);
    if (length > 0) return { x: -(b.y - a.y) / length, y: (b.x - a.x) / length };
  }
  return { x: 0, y: 0 };
}

/**
 * Push part of a path with a soft round brush: every vertex within `radius` of `centre`
 * moves by `delta` scaled by a falloff of `0.5 · (1 + cos(π · d / radius))`, `d` being its
 * distance from `centre` — the whole `delta` at the centre, nothing at the rim, smooth in
 * between. Each segment that passes within `radius` of `centre` is first divided so its
 * vertices are at most `radius / 4` apart, so the brush bends the path rather than dragging
 * a long segment's two ends.
 *
 * @param points - The path's vertices.
 * @param centre - The brush's centre, in image coordinates.
 * @param delta - How far its centre pushes, in image pixels.
 * @param radius - The brush's radius, in image pixels. Zero or less leaves the path as it is.
 * @param closed - Whether the last vertex joins the first. Defaults to `false`; a closed
 *   path's closing segment is divided like the others, its new vertices appended at the end.
 * @returns A new list of vertices.
 */
export function deformContour(points: readonly Point[], centre: Point, delta: Point, radius: number, closed = false): Point[] {
  if (!(radius > 0)) return points.map((p) => ({ x: p.x, y: p.y }));
  const step = radius / 4;
  const dense: Point[] = [];
  const n = points.length;
  const segments = closed ? n : n - 1;
  for (let i = 0; i < n; i++) {
    const a = points[i]!;
    dense.push(a);
    if (i >= segments) continue;
    const b = points[(i + 1) % n]!;
    if (distance(lerp(a, b, segmentParameter(a, b, centre)), centre) >= radius) continue;
    const pieces = Math.ceil(distance(a, b) / step);
    for (let k = 1; k < pieces; k++) dense.push(lerp(a, b, k / pieces));
  }
  return dense.map((p) => {
    const d = distance(p, centre);
    if (d >= radius) return { x: p.x, y: p.y };
    const weight = 0.5 * (1 + Math.cos((Math.PI * d) / radius));
    return { x: p.x + delta.x * weight, y: p.y + delta.y * weight };
  });
}

/**
 * The pieces of a path left after erasing the stretch between two arc lengths.
 *
 * @param points - The path's vertices.
 * @param s0 - Where the erased stretch starts.
 * @param s1 - Where it ends.
 * @param closed - Whether the last vertex joins the first. Defaults to `false`. On an open
 *   path the ends are clamped and ordered as in `subPath`, and up to two pieces remain: before
 *   the stretch and after it. On a closed path the stretch runs forward from `s0` to `s1`
 *   (past the first vertex when `s0 > s1`), and what remains is **one open piece**, from `s1`
 *   on around to `s0`; erasing an empty stretch (`s0` equal to `s1`) cuts the contour open there.
 * @returns The pieces, each an open polyline of at least two points. A piece with no length
 *   (the erased stretch reached an open path's end) is left out.
 */
export function eraseArc(points: readonly Point[], s0: number, s1: number, closed = false): Point[][] {
  if (points.length === 0) return [];
  const ring = ringOf(points, closed);
  const cum = arcLengths(points, closed);
  const total = cum[cum.length - 1]!;
  let a = arcPosition(cum, s0, closed);
  let b = arcPosition(cum, s1, closed);
  if (closed) {
    if (a === b) return [[...stretch(ring, cum, a, total), ...stretch(ring, cum, 0, a).slice(1)]];
    return [subPath(points, b, a, true)];
  }
  if (a > b) [a, b] = [b, a];
  const pieces: Point[][] = [];
  if (a > 0) pieces.push(stretch(ring, cum, 0, a));
  if (b < total) pieces.push(stretch(ring, cum, b, total));
  return pieces;
}

/** The vertices walked in order: a closed path ends back at its first vertex. */
function ringOf(points: readonly Point[], closed: boolean): readonly Point[] {
  return closed && points.length > 0 ? [...points, points[0]!] : points;
}

/** `s` as a position on the path: clamped to an open one, wrapped around a closed one. */
function arcPosition(cum: readonly number[], s: number, closed: boolean): number {
  const total = cum[cum.length - 1] ?? 0;
  if (!(total > 0)) return 0;
  if (closed) return s >= 0 && s <= total ? s : ((s % total) + total) % total;
  return Math.min(total, Math.max(0, s));
}

/** The segment `s` lies on: the last `i` with `cum[i] <= s`, held to the last segment. */
function segmentAt(cum: readonly number[], s: number): number {
  let low = 0;
  let high = Math.max(0, cum.length - 2);
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (cum[mid]! <= s) low = mid;
    else high = mid - 1;
  }
  return low;
}

/** The point at position `s` (already clamped or wrapped) of a walked path. */
function pointOn(ring: readonly Point[], cum: readonly number[], s: number): Point {
  if (ring.length === 0) return { x: NaN, y: NaN };
  if (ring.length === 1) return { x: ring[0]!.x, y: ring[0]!.y };
  const i = segmentAt(cum, s);
  const length = cum[i + 1]! - cum[i]!;
  return lerp(ring[i]!, ring[i + 1]!, length > 0 ? Math.min(1, Math.max(0, (s - cum[i]!) / length)) : 0);
}

/** The place at `a`, every vertex strictly between, and the place at `b`; `a <= b`. */
function stretch(ring: readonly Point[], cum: readonly number[], a: number, b: number): Point[] {
  const out = [pointOn(ring, cum, a)];
  for (let i = 0; i < ring.length; i++) if (cum[i]! > a && cum[i]! < b) out.push({ x: ring[i]!.x, y: ring[i]!.y });
  out.push(pointOn(ring, cum, b));
  return out;
}

/** Where on segment `ab` (as `t` in `[0, 1]`) the point nearest `p` is. */
function segmentParameter(a: Point, b: Point, p: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length2 = dx * dx + dy * dy;
  if (length2 === 0) return 0;
  return Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length2));
}

function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function range(from: number, to: number): number[] {
  const out: number[] = [];
  for (let i = from; i < to; i++) out.push(i);
  return out;
}
