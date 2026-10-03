/**
 * Moving a manual shape: a press on a selected item becomes image-space displacements, with the
 * click-slop handling every selection UI needs (a press that barely moves is a click, not a
 * drag).
 *
 * The layers resolve what is under the pointer (`onItemPress`); this turns the press that
 * follows into a move. The app keeps the item's geometry, shows the displaced copy while the
 * drag is in flight, and commits it at the end:
 *
 *     <AreaSet items={items} selectedIds={selected}
 *       onItemPress={(id, event) => {
 *         if (!selected.has(id)) return select(id);
 *         startMove(event, {
 *           onMove: setOffset,                                   // preview: draw the item shifted
 *           onEnd: (delta, moved) => moved ? commit(id, delta) : select(id),
 *           onCancel: () => setOffset(null),
 *         });
 *       }} />
 */

import { useCallback } from "react";

import type { Point } from "./measureGeometry";
import type { StagePointerEvent } from "./stage/hitContext";
import { useStage } from "./stage/ImageStage";
import { useStageDrag } from "./stage/StageSurface";

/** What a shape drag does as the pointer moves and when it ends. Displacements are total, from the press. */
export interface ShapeDragHandlers {
  /**
   * Each move of the pointer once it has left the click slop: how far it is from where the
   * press landed, in image pixels. Draw the shape shifted by it.
   */
  onMove?: ((delta: Point, event: PointerEvent) => void) | undefined;
  /**
   * The release. `moved` is whether the pointer ever left the click slop; when it did not,
   * `delta` is `{ x: 0, y: 0 }` and the press was a click. Commit the shape shifted by `delta`.
   */
  onEnd?: ((delta: Point, moved: boolean, event: PointerEvent) => void) | undefined;
  /** The drag was interrupted (`pointercancel`) or the component unmounted mid-drag: drop the preview. */
  onCancel?: (() => void) | undefined;
}

/** Options of the function `useShapeDrag` returns. */
export interface ShapeDragOptions {
  /** How far the pointer may travel before the press is a drag, in screen pixels. Defaults to 3. */
  slop?: number | undefined;
}

/** The default click slop, in screen pixels (the stage's own). */
const DEFAULT_SLOP = 3;

/**
 * Start moving a shape from a press, inside an `ImageStage`.
 *
 * Returns `start(event, handlers, options?)`. Call it from `onItemPress` of a layer with the
 * press event: the press is claimed, so the stage does not pan, and the pointer is followed on
 * `window` until it is released, whether or not it leaves the canvas. A touch tap reaches
 * `onItemPress` on release, so there is nothing to follow: it ends at once as a click
 * (`moved` false). Move a shape on touch with `ShapeEditor`'s handles or the app's own mode.
 *
 * @returns `start`.
 */
export function useShapeDrag(): (event: StagePointerEvent, handlers: ShapeDragHandlers, options?: ShapeDragOptions) => void {
  const { toImage } = useStage();
  const startDrag = useStageDrag();
  return useCallback(
    (event, handlers, options) => {
      if (event.type !== "pointerdown") {
        handlers.onEnd?.({ x: 0, y: 0 }, false, event.nativeEvent);
        return;
      }
      const slop = options?.slop ?? DEFAULT_SLOP;
      const from = { x: event.clientX, y: event.clientY };
      // Where the press landed, in image pixels: displacements are measured from it.
      const press = toImage(from);
      const displacement = (point: Point): Point => ({ x: point.x - press.x, y: point.y - press.y });
      let moved = false;
      startDrag(event, {
        onMove: (point, e) => {
          if (!moved && Math.hypot(e.clientX - from.x, e.clientY - from.y) <= slop) return;
          moved = true;
          handlers.onMove?.(displacement(point), e);
        },
        onEnd: (point, e) => handlers.onEnd?.(moved ? displacement(point) : { x: 0, y: 0 }, moved, e),
        onCancel: handlers.onCancel,
      });
    },
    [toImage, startDrag],
  );
}

/**
 * Move flat points by a displacement.
 *
 * @param points - `[x0, y0, x1, y1, …]`.
 * @param delta - The displacement, in the points' units.
 * @returns A new array, `points` shifted.
 */
export function translatePoints(points: ArrayLike<number>, delta: Point): number[] {
  const out = new Array<number>(points.length);
  for (let i = 0; i < points.length; i++) out[i] = points[i]! + (i % 2 === 0 ? delta.x : delta.y);
  return out;
}
