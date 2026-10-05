/**
 * The arithmetic of editing a datum: a frame on the image, given as an origin and the angle of
 * its i axis. Kept pure, so the cases that bite (a snapped angle, a grid, a press between the
 * origin and the arm) are tested without a pointer.
 *
 * Everything is in the stage's image coordinates. **Angles are radians, positive clockwise on
 * screen** (image `y` points down) from the image's `+x`, as `RotatedShape.rotation` is. The j
 * axis is a quarter turn clockwise from the i axis, along `angle + π/2`.
 */

import type { Point } from "./measureGeometry";
import { closestOnSegment } from "./polylineIndex";
import { normalizeAngle, snapAngle } from "./shapeEdit";
import type { Rect } from "./stage/view";

/** A frame on the image: where it starts, and which way its i axis points. */
export interface Datum {
  /** The origin, in image coordinates. */
  origin: Point;
  /** The i axis's direction: radians, clockwise on screen from the image's `+x`. */
  angle: number;
}

/** The origin ring's radius, in screen pixels. */
export const DATUM_RING_PX = 7;
/** The i axis's length when nothing else is given, in screen pixels; the j axis is half of it. */
export const DATUM_ARM_PX = 40;
/** The rotation handle's radius at the end of the i axis, in screen pixels. */
export const DATUM_HANDLE_PX = 5;

/**
 * The ends of a datum's axes.
 *
 * @param d - The datum.
 * @param armLength - The i axis's length, in image pixels; the j axis is half of it. For a
 *   screen-constant glyph pass `useScreenPx()(40)`.
 * @returns The end of the i axis and of the j axis, in image coordinates.
 */
export function datumAxes(d: Datum, armLength: number): { i: Point; j: Point } {
  const c = Math.cos(d.angle);
  const s = Math.sin(d.angle);
  const half = armLength / 2;
  // The j axis is the i axis turned a quarter clockwise: (cos(a + π/2), sin(a + π/2)) = (−sin a, cos a).
  return {
    i: { x: d.origin.x + armLength * c, y: d.origin.y + armLength * s },
    j: { x: d.origin.x - half * s, y: d.origin.y + half * c },
  };
}

/** How `moveDatum` places the origin. */
export interface MoveDatumOptions {
  /** Round the origin to a grid of this many image pixels; 0 or omitted for none. */
  grid?: number | undefined;
  /** Keep the origin inside this rectangle (edges included), on the last grid line inside it when there is a grid. */
  bounds?: Rect | undefined;
}

/**
 * Move a datum's origin to `to`, keeping its angle.
 *
 * @param d - The datum.
 * @param to - The new origin, in image coordinates.
 * @param options - A grid to round to, then bounds to stay inside.
 * @returns The moved datum.
 */
export function moveDatum(d: Datum, to: Point, options: MoveDatumOptions = {}): Datum {
  const grid = options.grid ?? 0;
  const b = options.bounds;
  return {
    origin: { x: place(to.x, grid, b?.x, b ? b.x + b.width : undefined), y: place(to.y, grid, b?.y, b ? b.y + b.height : undefined) },
    angle: d.angle,
  };
}

/**
 * One coordinate rounded to the grid and kept in `[low, high]`: past an edge it goes to the last
 * grid line inside. With no grid line inside, it is only kept in.
 */
function place(value: number, grid: number, low = -Infinity, high = Infinity): number {
  if (grid > 0) {
    const first = Math.ceil(low / grid) * grid;
    const last = Math.floor(high / grid) * grid;
    if (first <= last) return Math.min(last, Math.max(first, Math.round(value / grid) * grid));
  }
  return Math.min(high, Math.max(low, value));
}

/**
 * Turn a datum about its origin so that its i axis points at `to`.
 *
 * @param d - The datum.
 * @param to - The pointer, in image coordinates. At the origin itself the angle is kept.
 * @param snap - Round the angle to a multiple of this many radians; 0 for none.
 * @returns The turned datum, its angle in `(-π, π]`.
 */
export function rotateDatum(d: Datum, to: Point, snap = 0): Datum {
  const dx = to.x - d.origin.x;
  const dy = to.y - d.origin.y;
  const raw = dx === 0 && dy === 0 ? d.angle : Math.atan2(dy, dx);
  return { origin: d.origin, angle: normalizeAngle(snapAngle(raw, snap)) };
}

/** What `datumPress` reads besides the press. */
export interface DatumPressOptions {
  /** The i axis's length, in screen pixels. Defaults to 40. */
  armLength?: number | undefined;
  /** Whether the arm can be grabbed to turn the datum. Defaults to `true`. */
  rotatable?: boolean | undefined;
}

/**
 * What a press on a datum grabs, decided once for the whole glyph.
 *
 * The origin is its ring (7 screen px); the arm is the i axis from the ring out to its handle.
 * Each is within reach when the press is within `radius` screen pixels of it, and the nearer
 * one wins; a tie goes to the origin.
 *
 * @param d - The datum.
 * @param point - The press, in image coordinates.
 * @param scale - The view scale: screen pixels per image pixel.
 * @param radius - The pointer's tolerance in screen pixels: 12 for a touch, 6 for a mouse.
 * @param options - The arm's length, and whether it can be grabbed.
 * @returns `"origin"` (move), `"arm"` (turn), or `null`: the press belongs to whatever is below.
 */
export function datumPress(
  d: Datum,
  point: Point,
  scale: number,
  radius: number,
  options: DatumPressOptions = {},
): "origin" | "arm" | null {
  const armPx = options.armLength ?? DATUM_ARM_PX;
  // Measured in screen pixels, about the origin.
  const px = (point.x - d.origin.x) * scale;
  const py = (point.y - d.origin.y) * scale;
  const origin = Math.max(0, Math.hypot(px, py) - DATUM_RING_PX);
  let arm = Infinity;
  if (options.rotatable !== false) {
    const c = Math.cos(d.angle);
    const s = Math.sin(d.angle);
    const start = Math.min(DATUM_RING_PX, armPx);
    const q = closestOnSegment({ x: px, y: py }, start * c, start * s, armPx * c, armPx * s);
    const handle = Math.max(0, Math.hypot(px - armPx * c, py - armPx * s) - DATUM_HANDLE_PX);
    arm = Math.min(Math.hypot(q.x - px, q.y - py), handle);
  }
  if (origin <= radius && origin <= arm) return "origin";
  if (arm <= radius) return "arm";
  return null;
}
