/**
 * A rectangular marquee over a point set: hold a modifier, drag, and the ids of the points
 * inside the rectangle are reported.
 *
 * Opt-in and inert without its modifier: a press without it is left to the stage (which pans),
 * the wheel still zooms, and the layers below keep their own targets. The rectangle is drawn
 * with `MarqueeRect` while the pointer moves.
 */

import { useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, Ref } from "react";

import type { Point } from "./measureGeometry";
import { MarqueeRect } from "./DraftShape";
import { buildPointIndexFrom, pointsInRect, type PointId, type PointItem } from "./pointIndex";
import { useStage } from "./stage/ImageStage";
import type { StageDrag, StagePress } from "./stage/StageSurface";
import { useStageDrag } from "./stage/StageSurface";
import { imageViewBox, type Rect } from "./stage/view";

/** The key that arms a `PointMarquee`. `"meta"` is ⌘ on macOS and Ctrl elsewhere. */
export type PointMarqueeModifier = "shift" | "alt" | "meta";

/** How a marquee combines with the current selection: replaces it, or adds to it. */
export type PointMarqueeMode = "replace" | "add";

/**
 * What `PointMarquee`'s `ref` exposes, for an app that already has a `StageSurface` (a stage
 * has one full-frame press target) and starts the marquee from its `onPress`.
 */
export interface PointMarqueeHandle {
  /**
   * The marquee as a `StageDrag`, to return from `StageSurface`'s `onPress`.
   *
   * @param press - The press the surface was given.
   * @returns The drag when the press holds the marquee's modifier, `undefined` otherwise: a
   *   declined press is for the surface's other tools or the stage's pan. A touch has no
   *   modifier, so it is never started here.
   */
  sweepDrag(press: StagePress): StageDrag | undefined;
}

/** Props of `PointMarquee`. */
export interface PointMarqueeProps {
  /** The points the marquee selects among, in image coordinates. Pass a stable array: a new one rebuilds the index. */
  items: readonly PointItem[];
  /**
   * Called on release with the ids of the points inside the rectangle (edges included), in
   * item order; an empty list for a rectangle that holds none. Not called for a modifier-press
   * that did not move (a click is not a rectangle), nor after `Escape`.
   *
   * `mode` is `"add"` when ⌘/Ctrl is held as well as the modifier, `"replace"` otherwise. When
   * the modifier is `"meta"` itself, the mode is always `"replace"`.
   */
  onSelect: (ids: PointId[], mode: PointMarqueeMode) => void;
  /** Called with the rectangle (image coordinates) while it is dragged, and with `null` when it ends. */
  onBandChange?: ((band: Rect | null) => void) | undefined;
  /** Called when a marquee is abandoned: `Escape`, or the pointer was cancelled. `onSelect` is not called. */
  onCancel?: (() => void) | undefined;
  /** The key that arms the marquee. Defaults to `"shift"`. */
  modifier?: PointMarqueeModifier | undefined;
  /**
   * Whether the layer has a full-frame press target of its own. Defaults to `true`. The target
   * exists only while the modifier is held, so it never covers the layers below otherwise. Turn
   * it off to start the marquee from your own `StageSurface` through `ref`.
   */
  surface?: boolean | undefined;
  /** Turn the marquee off without unmounting it. Defaults to `true`. */
  enabled?: boolean | undefined;
  /** CSS colour of the rectangle. Defaults to the overlay `selection` role. */
  stroke?: string | undefined;
  /** Start a marquee from a press elsewhere; see `PointMarqueeHandle`. */
  ref?: Ref<PointMarqueeHandle> | undefined;
}

/** Whether a pointer or key event holds the modifier. */
function holds(modifier: PointMarqueeModifier, event: { shiftKey: boolean; altKey: boolean; metaKey: boolean; ctrlKey: boolean }): boolean {
  if (modifier === "shift") return event.shiftKey;
  if (modifier === "alt") return event.altKey;
  return event.metaKey || event.ctrlKey;
}

function boxBetween(a: Point, b: Point): Rect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) };
}

/**
 * A modifier-drag rectangle that selects points, inside an `ImageStage`.
 *
 * - **Opt-in**: a press without the modifier is left alone, so pan, wheel zoom and the layers
 *   below behave as without it. While the modifier is held the layer takes presses over the
 *   whole image and the cursor is a crosshair.
 * - **Reports ids**, by the points' centres, through a spatial index: thousands of points cost
 *   microseconds.
 * - **Escape** abandons a marquee in flight; releasing the pointer without moving does nothing.
 * - **Touch** has no modifier: a finger pans as usual.
 *
 * It draws only the rectangle (`data-marquee`); selection feedback is the point layer's, fed by
 * the ids the app keeps. The layer carries `data-armed` while the modifier is held and
 * `data-sweeping` while a rectangle is being dragged.
 */
export function PointMarquee({
  items,
  onSelect,
  onBandChange,
  onCancel,
  modifier = "shift",
  surface = true,
  enabled = true,
  stroke,
  ref,
}: PointMarqueeProps) {
  const stage = useStage();
  const startDrag = useStageDrag();
  const index = useMemo(() => buildPointIndexFrom(items), [items]);
  const [band, setBand] = useState<Rect | null>(null);
  const [held, setHeld] = useState(false);
  const armed = enabled && surface && held;
  // An Escape ends the marquee at once; the pointer is still down until it is released.
  const abandoned = useRef(false);
  const live = useRef({ onSelect, onBandChange, onCancel });
  useEffect(() => {
    live.current = { onSelect, onBandChange, onCancel };
  });

  const publish = (next: Rect | null) => {
    setBand(next);
    live.current.onBandChange?.(next);
  };

  // The modifier is read from key and pointer events on the window, so the target appears when
  // the key goes down and goes when it is released or the window loses focus.
  useEffect(() => {
    if (!enabled || !surface) return;
    const sync = (event: { shiftKey: boolean; altKey: boolean; metaKey: boolean; ctrlKey: boolean }) => setHeld(holds(modifier, event));
    const off = () => setHeld(false);
    window.addEventListener("keydown", sync);
    window.addEventListener("keyup", sync);
    window.addEventListener("pointermove", sync);
    window.addEventListener("blur", off);
    return () => {
      window.removeEventListener("keydown", sync);
      window.removeEventListener("keyup", sync);
      window.removeEventListener("pointermove", sync);
      window.removeEventListener("blur", off);
    };
  }, [enabled, surface, modifier]);

  // Escape abandons the marquee in flight.
  const sweeping = band !== null;
  useEffect(() => {
    if (!sweeping) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || abandoned.current) return;
      abandoned.current = true;
      publish(null);
      live.current.onCancel?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sweeping]);

  const dragFrom = (from: Point, additive: boolean, claimsTouch: boolean): StageDrag => {
    abandoned.current = false;
    publish({ x: from.x, y: from.y, width: 0, height: 0 });
    return {
      claimsTouch,
      onMove: (p) => {
        if (!abandoned.current) publish(boxBetween(from, p));
      },
      onEnd: (p, _event, moved) => {
        if (abandoned.current) return;
        publish(null);
        if (moved)
          live.current.onSelect(
            pointsInRect(index, boxBetween(from, p)).map((i) => idAt(i)),
            additive ? "add" : "replace",
          );
      },
      onCancel: () => {
        if (abandoned.current) return;
        abandoned.current = true;
        publish(null);
        live.current.onCancel?.();
      },
    };
  };
  const idAt = (i: number): PointId => (index.ids ? index.ids[i]! : i);
  const additiveOf = (event: { metaKey: boolean; ctrlKey: boolean }) => modifier !== "meta" && (event.metaKey || event.ctrlKey);

  useImperativeHandle(ref, () => ({
    sweepDrag: (press) => {
      if (!enabled || press.touch) return undefined;
      const held = modifier === "shift" ? press.shiftKey : modifier === "alt" ? press.altKey : press.metaKey;
      return held ? dragFrom(press.point, modifier !== "meta" && press.metaKey, false) : undefined;
    },
  }));

  const onPointerDown = (event: ReactPointerEvent<SVGRectElement>) => {
    if (!enabled || stage.panMode || event.button !== 0 || event.pointerType === "touch" || !holds(modifier, event)) return;
    startDrag(event, dragFrom(stage.toImage({ x: event.clientX, y: event.clientY }), additiveOf(event), false));
  };

  return (
    <>
      {armed && (
        <svg
          viewBox={imageViewBox(stage.image)}
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          aria-hidden
          data-armed=""
          data-sweeping={sweeping ? "" : undefined}
        >
          <rect
            data-marquee-surface=""
            x={-0.5}
            y={-0.5}
            width={stage.image.width}
            height={stage.image.height}
            fill="transparent"
            className="pointer-events-auto cursor-crosshair"
            onPointerDown={onPointerDown}
          />
        </svg>
      )}
      <MarqueeRect rect={band} stroke={stroke} />
    </>
  );
}
