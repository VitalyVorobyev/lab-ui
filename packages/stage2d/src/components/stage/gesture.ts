/**
 * The stage's pointer gestures as pure arithmetic: which mouse buttons pan, what a
 * two-finger pinch does to the view, and what counts as a tap.
 *
 * Points are viewport-local CSS pixels, as in `view.ts`.
 */

import type { Point } from "../measureGeometry";
import { zoomAbout, type StageView } from "./view";

/** A mouse button that can pan the stage. */
export type StageMouseButton = "left" | "middle" | "right";

/** How far a touch may travel and still be a tap, in CSS pixels. */
export const TAP_SLOP = 3;
/** The longest a touch may last and still be a tap, in milliseconds. */
export const TAP_MS = 500;

const BUTTON_CODE: Record<StageMouseButton, number> = { left: 0, middle: 1, right: 2 };

/**
 * The `PointerEvent.button` codes a `panButton` prop names.
 *
 * @param panButton - One button or a list; omitted means left and middle, the stage's
 *   long-standing default.
 * @returns The codes: 0 left, 1 middle, 2 right.
 */
export function panButtonCodes(panButton: StageMouseButton | readonly StageMouseButton[] | undefined): ReadonlySet<number> {
  if (panButton === undefined) return new Set([0, 1]);
  const list = typeof panButton === "string" ? [panButton] : panButton;
  return new Set(list.map((button) => BUTTON_CODE[button]));
}

/**
 * The midpoint of two points.
 *
 * @param a - One point.
 * @param b - The other.
 * @returns Their centroid.
 */
export function centroid(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * The view a pinch has reached: scaled by how much the fingers spread, and carried by how
 * far their midpoint moved. The image point under the fingers' first midpoint stays under
 * their current one, so the gesture reads as holding the picture with two fingers.
 *
 * @param start - The view when the second finger went down.
 * @param startDistance - The fingers' distance then.
 * @param startCentre - Their midpoint then.
 * @param distance - Their distance now.
 * @param centre - Their midpoint now.
 * @param range - The `[min, max]` scale to stay within.
 * @returns The view; not yet clamped to the legal pan range.
 */
export function pinchView(
  start: StageView,
  startDistance: number,
  startCentre: Point,
  distance: number,
  centre: Point,
  range: readonly [number, number],
): StageView {
  const ratio = startDistance > 0 ? distance / startDistance : 1;
  const scale = Math.min(range[1], Math.max(range[0], start.scale * ratio));
  const zoomed = zoomAbout(start, scale, startCentre);
  return { scale: zoomed.scale, tx: zoomed.tx + centre.x - startCentre.x, ty: zoomed.ty + centre.y - startCentre.y };
}

/**
 * Whether a touch that has ended was a tap.
 *
 * @param travel - The farthest it strayed from where it began, in CSS pixels.
 * @param elapsed - How long it lasted, in milliseconds.
 * @returns `true` for a short touch that stayed put.
 */
export function isTap(travel: number, elapsed: number): boolean {
  return travel <= TAP_SLOP && elapsed <= TAP_MS;
}
