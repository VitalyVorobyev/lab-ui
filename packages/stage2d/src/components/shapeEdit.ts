/**
 * The arithmetic of editing a rotated rectangle or ellipse: eight handles, a rotation handle
 * and an interior.
 *
 * A shape is its centre, its size and a rotation, so a resize can be done in the shape's own
 * frame (where its sides are axis-aligned) and the opposite edge stays put whatever the
 * rotation. Kept pure, so the cases that bite are tested without a pointer:
 *   - a handle dragged across the shape, or to a point far away;
 *   - a shape collapsed below the minimum size;
 *   - a rotation about the centre and not about a corner.
 *
 * Everything is in the stage's image coordinates. **Rotation is in radians, positive
 * clockwise on screen** (image `y` points down), zero when the shape's width runs along `x`.
 * A degrees-clockwise value, such as Konva's `rotation`, is `degrees * Math.PI / 180`.
 */

import type { Point } from "./measureGeometry";
import type { RoiHandle } from "./roiEdit";

/** A rotated rectangle, or the ellipse inscribed in one. */
export interface RotatedShape {
  /** Centre x, in image coordinates. */
  cx: number;
  /** Centre y, in image coordinates. */
  cy: number;
  /** Extent along the shape's own x axis: a rectangle's width, an ellipse's full axis `2·rx`. */
  width: number;
  /** Extent along the shape's own y axis: a rectangle's height, an ellipse's full axis `2·ry`. */
  height: number;
  /** Radians, clockwise on screen: the turn from the image's x axis to the shape's own. */
  rotation: number;
}

/**
 * A point of image space in the shape's own frame: origin at its centre, axes along its sides.
 *
 * @param shape - The shape.
 * @param p - A point in image coordinates.
 * @returns The point relative to the shape.
 */
export function toShapeFrame(shape: RotatedShape, p: Point): Point {
  const c = Math.cos(shape.rotation);
  const s = Math.sin(shape.rotation);
  const dx = p.x - shape.cx;
  const dy = p.y - shape.cy;
  return { x: c * dx + s * dy, y: -s * dx + c * dy };
}

/**
 * A point of the shape's own frame in image space; the inverse of `toShapeFrame`.
 *
 * @param shape - The shape.
 * @param p - A point relative to the shape.
 * @returns The point in image coordinates.
 */
export function fromShapeFrame(shape: RotatedShape, p: Point): Point {
  const c = Math.cos(shape.rotation);
  const s = Math.sin(shape.rotation);
  return { x: shape.cx + c * p.x - s * p.y, y: shape.cy + s * p.x + c * p.y };
}

/** The sign of a handle along the shape's own x and y axes: `e` and `s` are `+1`. */
function handleDirection(handle: RoiHandle): Point {
  return { x: handle.includes("e") ? 1 : handle.includes("w") ? -1 : 0, y: handle.includes("s") ? 1 : handle.includes("n") ? -1 : 0 };
}

/**
 * Where a handle sits: a corner or the middle of a side, turned with the shape.
 *
 * @param shape - The shape.
 * @param handle - The handle, by compass direction in the shape's own frame.
 * @returns The handle's centre, in image coordinates.
 */
export function shapeHandlePoint(shape: RotatedShape, handle: RoiHandle): Point {
  const d = handleDirection(handle);
  return fromShapeFrame(shape, { x: (d.x * shape.width) / 2, y: (d.y * shape.height) / 2 });
}

/**
 * Where the rotation handle sits: beyond the middle of the top side, along the shape's own
 * up direction.
 *
 * @param shape - The shape.
 * @param distance - How far past the top side, in image pixels. For a screen-constant handle,
 *   pass `useScreenPx()(css)`.
 * @returns The handle's centre, in image coordinates.
 */
export function rotationHandlePoint(shape: RotatedShape, distance: number): Point {
  return fromShapeFrame(shape, { x: 0, y: -shape.height / 2 - distance });
}

/**
 * Drag a handle to `to`.
 *
 * The dragged side or corner follows the pointer in the shape's own frame and the opposite
 * side or corner stays where it is in the image, which is what makes a handle feel attached.
 * The shape does not flip when dragged through the opposite side: it stops at `minSize`.
 *
 * @param shape - The shape before the drag.
 * @param handle - The handle being dragged.
 * @param to - The pointer, in image coordinates.
 * @param minSize - The smallest extent on either axis, in image pixels.
 * @returns The resized shape: the same rotation, and the opposite side or corner unmoved.
 */
export function resizeShape(shape: RotatedShape, handle: RoiHandle, to: Point, minSize: number): RotatedShape {
  const d = handleDirection(handle);
  const u = toShapeFrame(shape, to);
  let width = shape.width;
  let height = shape.height;
  let x = 0;
  let y = 0;
  if (d.x !== 0) {
    // The fixed side is at `-d.x · width / 2`; the new extent runs from it to the pointer.
    width = Math.max(minSize, d.x * u.x + shape.width / 2);
    x = -d.x * (shape.width / 2) + (d.x * width) / 2;
  }
  if (d.y !== 0) {
    height = Math.max(minSize, d.y * u.y + shape.height / 2);
    y = -d.y * (shape.height / 2) + (d.y * height) / 2;
  }
  const centre = fromShapeFrame(shape, { x, y });
  return { cx: centre.x, cy: centre.y, width, height, rotation: shape.rotation };
}

/**
 * Turn the shape about its centre so that its rotation handle points at `to`.
 *
 * @param shape - The shape before the drag.
 * @param to - The pointer, in image coordinates.
 * @param snap - Round the rotation to a multiple of this many radians (Shift while dragging
 *   rounds to 15°). Defaults to no rounding.
 * @returns The rotated shape: the same centre and size, `rotation` in `(-π, π]`.
 */
export function rotateShape(shape: RotatedShape, to: Point, snap = 0): RotatedShape {
  // The handle sits along the shape's own up direction, which is at angle `rotation - π/2`.
  let rotation = Math.atan2(to.y - shape.cy, to.x - shape.cx) + Math.PI / 2;
  if (snap > 0) rotation = Math.round(rotation / snap) * snap;
  return { ...shape, rotation: normalizeAngle(rotation) };
}

/**
 * Move the shape.
 *
 * @param shape - The shape.
 * @param dx - Horizontal shift, in image pixels.
 * @param dy - Vertical shift, in image pixels.
 * @returns The moved shape.
 */
export function moveShape(shape: RotatedShape, dx: number, dy: number): RotatedShape {
  return { ...shape, cx: shape.cx + dx, cy: shape.cy + dy };
}

/**
 * An angle as the equivalent one in `(-π, π]`.
 *
 * @param angle - Radians.
 * @returns The angle in `(-π, π]`.
 */
export function normalizeAngle(angle: number): number {
  const turn = 2 * Math.PI;
  let a = angle % turn;
  if (a > Math.PI) a -= turn;
  else if (a <= -Math.PI) a += turn;
  return a;
}

/**
 * The resize cursor for a handle of a rotated shape: the nearest of the four CSS resize
 * cursors to the handle's direction on screen.
 *
 * @param handle - The handle.
 * @param rotation - The shape's rotation, in radians.
 * @returns A CSS `cursor` value.
 */
export function shapeHandleCursor(handle: RoiHandle, rotation: number): string {
  const d = handleDirection(handle);
  const angle = Math.atan2(d.y, d.x) + rotation;
  const half = ((angle % Math.PI) + Math.PI) % Math.PI;
  return ["ew-resize", "nwse-resize", "ns-resize", "nesw-resize"][Math.round(half / (Math.PI / 4)) % 4]!;
}

/**
 * The shape for a rectangle given as an origin corner, a size and a rotation about that
 * corner: Konva's `Rect` (`x`, `y`, `width`, `height`, `rotation` in degrees), for one.
 *
 * @param corner - The corner the rotation is about, in image coordinates.
 * @param width - Extent along the rotated x axis.
 * @param height - Extent along the rotated y axis.
 * @param rotation - Radians, clockwise on screen.
 * @returns The same rectangle as a `RotatedShape`.
 */
export function shapeFromCorner(corner: Point, width: number, height: number, rotation: number): RotatedShape {
  const c = Math.cos(rotation);
  const s = Math.sin(rotation);
  return {
    cx: corner.x + (c * width - s * height) / 2,
    cy: corner.y + (s * width + c * height) / 2,
    width,
    height,
    rotation,
  };
}

/**
 * The top-left corner of a shape in its own frame, the origin Konva rotates a `Rect` about;
 * the inverse of `shapeFromCorner`.
 *
 * @param shape - The shape.
 * @returns The corner, in image coordinates.
 */
export function shapeCorner(shape: RotatedShape): Point {
  return fromShapeFrame(shape, { x: -shape.width / 2, y: -shape.height / 2 });
}

/**
 * Whether two shapes are the same, to within `epsilon` on every field (rotations compared modulo a turn).
 *
 * @param a - A shape, or `null`.
 * @param b - A shape, or `null`.
 * @param epsilon - The tolerance. Defaults to 1e-6.
 * @returns `true` for two equal shapes, or two `null`s.
 */
export function sameShape(a: RotatedShape | null, b: RotatedShape | null, epsilon = 1e-6): boolean {
  if (a === null || b === null) return a === b;
  return (
    Math.abs(a.cx - b.cx) < epsilon &&
    Math.abs(a.cy - b.cy) < epsilon &&
    Math.abs(a.width - b.width) < epsilon &&
    Math.abs(a.height - b.height) < epsilon &&
    Math.abs(normalizeAngle(a.rotation - b.rotation)) < epsilon
  );
}
