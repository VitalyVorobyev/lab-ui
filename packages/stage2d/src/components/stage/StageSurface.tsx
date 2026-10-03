/**
 * The stage's tool model: one place that decides what a press on the image means.
 *
 * Several layers usually want a full-frame target: one to draw a region, one to sweep a
 * selection, one to place a point. Only the topmost element under the pointer receives a press,
 * so two full-frame targets are one that always wins and one that never fires. Apps that grew
 * such layers one by one found this out the hard way.
 *
 * The rule here is one surface per stage, under the layers' own small targets (a handle, a
 * stroke). It asks the app what a press means, in priority order, and a press the app declines
 * bubbles to the stage, which pans.
 *
 * Drags listen on `window`, not on the pressed element. `setPointerCapture` routes every later
 * event to that one element, so a drag begun on a handle sent its moves to the handle, never
 * to the surface that held the move logic. Listening at the window also lets a drag survive
 * the pointer leaving the canvas, which is what dragging a corner outward does.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import type { Point } from "../measureGeometry";
import { useStage } from "./ImageStage";
import { imageViewBox } from "./view";

/** What a drag does as the pointer moves and when it is released, in image coordinates. */
export interface StageDrag {
  /** Each move of the pointer while the button is held. */
  onMove?: ((point: Point, event: PointerEvent) => void) | undefined;
  /**
   * Release. `moved` is whether the pointer travelled more than a few screen pixels, which
   * tells a click from a drag.
   */
  onEnd?: ((point: Point, event: PointerEvent, moved: boolean) => void) | undefined;
  /** The drag was interrupted (`pointercancel`) or the component unmounted mid-drag. */
  onCancel?: (() => void) | undefined;
}

/** How far a press may travel and still be a click, in screen pixels. */
const CLICK_SLOP = 3;

/**
 * Start a drag from a press on any element inside an `ImageStage`.
 *
 * The press is claimed: propagation stops, so the stage does not pan. Later moves and the
 * release are read from `window` and converted to image coordinates. Call it from a
 * `pointerdown` handler.
 *
 * @returns `start(event, drag)`.
 */
export function useStageDrag(): (event: ReactPointerEvent<Element>, drag: StageDrag) => void {
  // `toImage` is stable for the stage's lifetime and reads the live view, so a drag converts
  // with the view in effect at each move.
  const { toImage } = useStage();
  const cleanupRef = useRef<(() => void) | null>(null);

  // A drag still in flight when the component unmounts is cancelled, not leaked.
  useEffect(() => () => cleanupRef.current?.(), []);

  return useCallback((event: ReactPointerEvent<Element>, drag: StageDrag) => {
    event.stopPropagation();
    event.preventDefault();
    cleanupRef.current?.();
    const from = { x: event.clientX, y: event.clientY };
    let moved = false;
    const at = (e: PointerEvent) => toImage({ x: e.clientX, y: e.clientY });

    const move = (e: PointerEvent) => {
      if (!moved && Math.hypot(e.clientX - from.x, e.clientY - from.y) > CLICK_SLOP) moved = true;
      drag.onMove?.(at(e), e);
    };
    const up = (e: PointerEvent) => {
      stop();
      drag.onEnd?.(at(e), e, moved);
    };
    const cancel = () => {
      stop();
      drag.onCancel?.();
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      cleanupRef.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    cleanupRef.current = cancel;
  }, [toImage]);
}

/** A press on the surface, as the app's `onPress` sees it. */
export interface StagePress {
  /** Where, in image coordinates. */
  point: Point;
  /** Shift was held. */
  shiftKey: boolean;
  /** Alt / Option was held. */
  altKey: boolean;
  /** ⌘ (macOS) or Ctrl was held: the usual "add to / toggle in the selection" modifier. */
  metaKey: boolean;
}

/** Props of `StageSurface`. */
export interface StageSurfaceProps {
  /**
   * What a press means. Return a `StageDrag` to claim it (a click is a drag that never
   * moved), or nothing to decline it: a declined press reaches the stage, which pans.
   */
  onPress: (press: StagePress) => StageDrag | null | undefined | void;
  /** The cursor over the image while no drag is in flight, e.g. `crosshair` for a draw tool. */
  cursor?: string | undefined;
  /** Where the pointer is over the image while no drag is in flight, for hover feedback. */
  onHover?: ((point: Point) => void) | undefined;
}

/**
 * The stage's one full-frame press target. Put it inside an `ImageStage`, below the layers
 * that have their own small targets (handles, strokes). Each press is offered to `onPress`
 * unless the hand tool or a held space bar make it a pan; a declined press pans.
 *
 * The surface draws nothing. It carries `data-dragging` while a drag it started is in
 * flight.
 */
export function StageSurface({ onPress, cursor, onHover }: StageSurfaceProps) {
  const stage = useStage();
  const start = useStageDrag();
  const [dragging, setDragging] = useState(false);

  const onPointerDown = (event: ReactPointerEvent<SVGRectElement>) => {
    if (event.button !== 0 || stage.panMode) return;
    const drag = onPress({
      point: stage.toImage({ x: event.clientX, y: event.clientY }),
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      metaKey: event.metaKey || event.ctrlKey,
    });
    if (!drag) return; // Declined: the stage pans.
    setDragging(true);
    start(event, {
      onMove: drag.onMove,
      onEnd: (point, e, moved) => {
        setDragging(false);
        drag.onEnd?.(point, e, moved);
      },
      onCancel: () => {
        setDragging(false);
        drag.onCancel?.();
      },
    });
  };

  return (
    <svg
      viewBox={imageViewBox(stage.image)}
      className="pointer-events-none absolute inset-0 h-full w-full"
      data-dragging={dragging ? "" : undefined}
      aria-hidden
    >
      <rect
        data-stage-surface=""
        x={-0.5}
        y={-0.5}
        width={stage.image.width}
        height={stage.image.height}
        fill="transparent"
        className="pointer-events-auto"
        style={{ cursor: stage.panMode ? undefined : cursor }}
        onPointerDown={onPointerDown}
        onPointerMove={(event) => {
          if (!dragging) onHover?.(stage.toImage({ x: event.clientX, y: event.clientY }));
        }}
      />
    </svg>
  );
}
