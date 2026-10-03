/**
 * The arithmetic of editing an axis-aligned region: eight handles and an interior.
 *
 * Kept pure, so the cases that bite are tested without a pointer:
 *   - a drag that turns the box inside out through itself;
 *   - a handle pulled past the image edge;
 *   - a box collapsed to nothing.
 *
 * Everything is in the stage's image coordinates; `bounds` is the area a region must stay in.
 */

import type { Rect } from "./stage/view";
import type { Point } from "./measureGeometry";

/** A region's handle, by compass direction. */
export type RoiHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

/** The eight handles, clockwise from the top-left corner. */
export const ROI_HANDLES: readonly RoiHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

/** The CSS resize cursor for each handle, so the affordance is legible before the press. */
export const ROI_HANDLE_CURSOR: Readonly<Record<RoiHandle, string>> = {
  nw: "nwse-resize",
  n: "ns-resize",
  ne: "nesw-resize",
  e: "ew-resize",
  se: "nwse-resize",
  s: "ns-resize",
  sw: "nesw-resize",
  w: "ew-resize",
};

/**
 * Where a handle sits.
 *
 * @param rect - The region.
 * @param handle - The handle.
 * @returns The handle's centre.
 */
export function roiHandlePoint(rect: Rect, handle: RoiHandle): Point {
  const { x, y, width: w, height: h } = rect;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const px = handle.includes("w") ? x : handle.includes("e") ? x + w : cx;
  const py = handle.includes("n") ? y : handle.includes("s") ? y + h : cy;
  return { x: px, y: py };
}

/**
 * The box spanned by two corners, with positive width and height whichever way it was
 * dragged.
 *
 * @param a - One corner.
 * @param b - The opposite corner.
 * @returns The normalised box.
 */
export function rectFromCorners(a: Point, b: Point): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
}

/**
 * A box held inside `bounds`, and no smaller than `minSize` on either side, unless `bounds`
 * itself is smaller.
 *
 * @param rect - The box.
 * @param bounds - The area it must stay in.
 * @param minSize - The smallest side.
 * @returns The clamped box.
 */
export function clampRect(rect: Rect, bounds: Rect, minSize: number): Rect {
  const width = Math.min(Math.max(rect.width, minSize), bounds.width);
  const height = Math.min(Math.max(rect.height, minSize), bounds.height);
  return {
    x: clamp(rect.x, bounds.x, bounds.x + bounds.width - width),
    y: clamp(rect.y, bounds.y, bounds.y + bounds.height - height),
    width,
    height,
  };
}

/**
 * Drag a handle to `to`.
 *
 * The dragged edge follows the pointer and the opposite edge stays put, which is what makes
 * a handle feel attached to the corner it is drawn on. Dragging an edge through its opposite
 * flips the box instead of clamping it to zero: a clamp leaves the pointer moving and the box
 * not, which reads as the drag having died.
 *
 * @param rect - The box before the drag.
 * @param handle - The handle being dragged.
 * @param to - The pointer, in image coordinates.
 * @param bounds - The area the box must stay in.
 * @param minSize - The smallest side.
 * @returns The resized box.
 */
export function resizeRect(rect: Rect, handle: RoiHandle, to: Point, bounds: Rect, minSize: number): Rect {
  let left = rect.x;
  let top = rect.y;
  let right = rect.x + rect.width;
  let bottom = rect.y + rect.height;
  const px = clamp(to.x, bounds.x, bounds.x + bounds.width);
  const py = clamp(to.y, bounds.y, bounds.y + bounds.height);
  if (handle.includes("w")) left = px;
  if (handle.includes("e")) right = px;
  if (handle.includes("n")) top = py;
  if (handle.includes("s")) bottom = py;
  return clampRect(rectFromCorners({ x: left, y: top }, { x: right, y: bottom }), bounds, minSize);
}

/**
 * Move the whole box, held inside `bounds` without changing its size.
 *
 * @param rect - The box.
 * @param dx - Horizontal shift.
 * @param dy - Vertical shift.
 * @param bounds - The area it must stay in.
 * @returns The moved box.
 */
export function moveRect(rect: Rect, dx: number, dy: number, bounds: Rect): Rect {
  return {
    x: clamp(rect.x + dx, bounds.x, Math.max(bounds.x, bounds.x + bounds.width - rect.width)),
    y: clamp(rect.y + dy, bounds.y, Math.max(bounds.y, bounds.y + bounds.height - rect.height)),
    width: rect.width,
    height: rect.height,
  };
}

/**
 * Whether two boxes are the same, to within `epsilon`. Useful for telling whether a region
 * still matches the one a result was computed for.
 *
 * @param a - A box, or `null`.
 * @param b - A box, or `null`.
 * @param epsilon - The tolerance. Defaults to 1e-6.
 * @returns `true` for two equal boxes, or two `null`s.
 */
export function sameRect(a: Rect | null, b: Rect | null, epsilon = 1e-6): boolean {
  if (a === null || b === null) return a === b;
  return (
    Math.abs(a.x - b.x) < epsilon &&
    Math.abs(a.y - b.y) < epsilon &&
    Math.abs(a.width - b.width) < epsilon &&
    Math.abs(a.height - b.height) < epsilon
  );
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}
