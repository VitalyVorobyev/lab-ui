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

import { cn } from "@vitavision/ui";
import type { Point } from "../measureGeometry";
import { useStage } from "./ImageStage";
import { hitRadiusPx } from "./gesture";
import { watchTouch } from "./touchWatch";
import { clampToImage, imageViewBox, toImage } from "./view";

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
  /**
   * Claim a touch that starts this gesture, as a mouse press is claimed: the stage neither
   * pans nor pinches from it. Without it a touch is only watched (see `StageSurface`), so
   * return `true` for a gesture a finger must own, such as moving a selected shape. Ignored for
   * a mouse or pen.
   */
  claimsTouch?: boolean | undefined;
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
  /** Where, in client coordinates, for anchoring a tooltip or a menu. */
  client: Point;
  /** The press is a touch: act on its release (see `StageSurface`), and expect a fingertip's tolerance. */
  touch: boolean;
  /** The hit-test tolerance for this pointer, in screen pixels: 12 for a touch, 6 otherwise. Pass it to `useStageHitTest`. */
  radius: number;
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
   *
   * **For a touch, act in `onEnd` when `moved` is `false` (a tap), not here.** The press may
   * become a pan or the first finger of a pinch, so nothing should happen until the finger
   * lifts. Return `claimsTouch: true` for a gesture the finger must own.
   */
  onPress: (press: StagePress) => StageDrag | null | undefined | void;
  /** The cursor over the image while no drag is in flight, e.g. `crosshair` for a draw tool. */
  cursor?: string | undefined;
  /** Where the mouse is over the image while no drag is in flight, for hover feedback. Not called for a touch. */
  onHover?: ((point: Point) => void) | undefined;
  /**
   * A double click or double tap on the surface. When given, the surface handles it and the
   * stage's double-click-to-fit does not run; leave it out to keep the fit.
   */
  onDoubleClick?: ((point: Point) => void) | undefined;
  /**
   * How far the surface reaches. `"image"` (the default) is the image rectangle: a press in
   * the margin around the image goes to the stage, which pans. `"viewport"` covers everything
   * visible, margin included, so a drawing tool can place a point on the image's border by
   * pressing just outside it; every point the surface then reports (the press, a drag's moves
   * and release, hover, double-click) is clamped to the image's extent, `[-0.5, w - 0.5]` by
   * `[-0.5, h - 0.5]`. `StagePress.client` stays the raw pointer position.
   */
  extent?: "image" | "viewport" | undefined;
}

/**
 * The stage's one full-frame press target. Put it inside an `ImageStage`, below the layers
 * that have their own small targets (handles, strokes). Each press is offered to `onPress`
 * unless the hand tool or a held space bar make it a pan; a declined press pans.
 *
 * **Mouse and pen.** Only the left button comes here. The press is claimed and followed on
 * `window`, so the stage does not pan from it.
 *
 * **Touch.** A touch is only *watched* unless its `StageDrag` sets `claimsTouch`: the surface
 * neither stops the press nor captures the pointer, so the stage still pans (one-finger mode)
 * and a second finger still pinches. The drag then sees:
 * - `onMove`, only once the finger has left the tap slop;
 * - `onEnd(point, event, moved)` on release, with `moved` `false` for a tap;
 * - `onCancel` on `pointercancel`, or when a second finger lands (a pinch).
 *
 * A touch gesture that sets `claimsTouch: true` is claimed like a mouse press.
 *
 * With `extent="viewport"` the surface also takes presses in the margin around the image, and
 * clamps every reported point to the image.
 *
 * The surface draws nothing. It carries `data-dragging` while a gesture it started is in flight.
 */
export function StageSurface({ onPress, cursor, onHover, onDoubleClick, extent = "image" }: StageSurfaceProps) {
  const stage = useStage();
  const start = useStageDrag();
  const [dragging, setDragging] = useState(false);
  const watchRef = useRef<(() => void) | null>(null);

  // A touch still being watched when the surface goes away is cancelled, not left listening.
  useEffect(() => () => watchRef.current?.(), []);

  const viewport = extent === "viewport";
  // The image point under a client position; held to the image only for a viewport-wide surface.
  const pointAt = (client: Point): Point => {
    const p = stage.toImage(client);
    return viewport ? clampToImage(p, stage.image) : p;
  };
  // The visible area in image coordinates, from the view and the measured box, so it follows
  // pan, zoom and resize; the image rectangle until the viewport has been measured.
  const target = (() => {
    const { image, view, box } = stage;
    if (!viewport || !(box.width > 0)) return { x: -0.5, y: -0.5, width: image.width, height: image.height };
    const a = toImage(view, { x: 0, y: 0 });
    const b = toImage(view, { x: box.width, y: box.height });
    return { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y };
  })();

  const onPointerDown = (event: ReactPointerEvent<SVGRectElement>) => {
    const touch = event.pointerType === "touch";
    if (stage.panMode || (!touch && event.button !== 0)) return;
    // A second finger turns the first one's gesture into a pinch; the watch cancels itself on it.
    if (touch && watchRef.current) return;
    const client = { x: event.clientX, y: event.clientY };
    const drag = onPress({
      point: pointAt(client),
      client,
      touch,
      radius: hitRadiusPx(event.pointerType),
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      metaKey: event.metaKey || event.ctrlKey,
    });
    if (!drag) return; // Declined: the stage pans.
    const finish = () => setDragging(false);
    setDragging(true);
    if (touch && !drag.claimsTouch) {
      // Watched, not claimed: the press goes on to the stage.
      const release = () => {
        watchRef.current = null;
        finish();
      };
      watchRef.current = watchTouch(event, {
        onMove: (e) => drag.onMove?.(pointAt({ x: e.clientX, y: e.clientY }), e),
        onEnd: (e, moved) => {
          release();
          drag.onEnd?.(pointAt({ x: e.clientX, y: e.clientY }), e, moved);
        },
        onCancel: () => {
          release();
          drag.onCancel?.();
        },
      });
      return;
    }
    start(event, {
      onMove: drag.onMove && ((point, e) => drag.onMove?.(viewport ? clampToImage(point, stage.image) : point, e)),
      onEnd: (point, e, moved) => {
        finish();
        drag.onEnd?.(viewport ? clampToImage(point, stage.image) : point, e, moved);
      },
      onCancel: () => {
        finish();
        drag.onCancel?.();
      },
    });
  };

  return (
    <svg
      viewBox={imageViewBox(stage.image)}
      className={cn("pointer-events-none absolute inset-0 h-full w-full", viewport && "overflow-visible")}
      data-dragging={dragging ? "" : undefined}
      aria-hidden
    >
      <rect
        data-stage-surface=""
        x={target.x}
        y={target.y}
        width={target.width}
        height={target.height}
        fill="transparent"
        className="pointer-events-auto"
        style={{ cursor: stage.panMode ? undefined : cursor }}
        onPointerDown={onPointerDown}
        onPointerMove={(event) => {
          if (!dragging && event.pointerType !== "touch") onHover?.(pointAt({ x: event.clientX, y: event.clientY }));
        }}
        onDoubleClick={(event) => {
          if (!onDoubleClick) return;
          event.stopPropagation();
          onDoubleClick(pointAt({ x: event.clientX, y: event.clientY }));
        }}
      />
    </svg>
  );
}
