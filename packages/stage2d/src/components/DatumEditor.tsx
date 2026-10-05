/**
 * A datum on the image: an origin and the direction of its i axis, moved and turned like an
 * object. The frame a model, a target or a measurement is expressed in.
 *
 * The arithmetic is `datumEdit.ts`; this is the glyph, the gestures and the keyboard.
 */

import { useState, type KeyboardEvent, type PointerEvent } from "react";

import { cn } from "@vitavision/ui";
import { DATUM_ARM_PX, DATUM_HANDLE_PX, DATUM_RING_PX, datumAxes, datumPress, moveDatum, rotateDatum, type Datum } from "./datumEdit";
import { arrowHeadPoints, rotatePoint, type Point } from "./measureGeometry";
import { overlayRole } from "./overlayRole";
import { normalizeAngle } from "./shapeEdit";
import { POINTER_RADIUS_PX, TOUCH_RADIUS_PX, hitRadiusPx } from "./stage/gesture";
import { useStage } from "./stage/ImageStage";
import { useStageDrag } from "./stage/StageSurface";
import { useCoarsePointer } from "./stage/useCoarsePointer";
import { useScreenPx } from "./stage/useScreenPx";
import { PIXEL_CENTRE, imageViewBox, type Rect } from "./stage/view";

/** Props of `DatumEditor`. */
export interface DatumEditorProps {
  /** The datum, when the app controls it. `angle` is in radians, clockwise on screen from `+x`. */
  value?: Datum | undefined;
  /** The starting datum when the editor controls it. Defaults to the image's centre, pointing along `+x`. */
  defaultValue?: Datum | undefined;
  /** Called with the datum as it changes: on every move of a drag, and on each key press. */
  onValueChange?: ((value: Datum) => void) | undefined;
  /** Called once a gesture ends (a drag released, a key pressed): the moment to save or re-run. */
  onCommit?: ((value: Datum) => void) | undefined;
  /** Accept moves and turns, by pointer and keyboard. Defaults to `true`. */
  editable?: boolean | undefined;
  /** Show the rotation handle and accept `[` / `]`. Defaults to `true`; off for a datum that must keep its angle. */
  rotatable?: boolean | undefined;
  /** The step a turn rounds to, in radians: while Shift is held, or always with `snapAlways`. Defaults to π/12 (15°); 0 never rounds. */
  angleSnap?: number | undefined;
  /** Round every turn to `angleSnap`, not only while Shift is held. Defaults to `false`. */
  snapAlways?: boolean | undefined;
  /** Round the origin to a grid of this many image pixels as it moves. Defaults to 0: no grid. */
  originSnap?: number | undefined;
  /** The rectangle the origin stays inside, in image coordinates. Defaults to the image. */
  bounds?: Rect | undefined;
  /** The i axis's length in screen pixels; the j axis is half of it. Defaults to 40. */
  armLength?: number | undefined;
  /** The datum's accessible name. Defaults to "Datum". */
  label?: string | undefined;
  /** CSS colour of the glyph. Defaults to the overlay `model` role. */
  stroke?: string | undefined;
  /** Merged onto the `<svg>` with `cn`. */
  className?: string | undefined;
}

const HALO = overlayRole("halo");
/** How far a press may travel and still be a click, in screen pixels: the stage's own slop. */
const CLICK_SLOP = 3;
/** `[` / `]` turn by 1°, 15° with Shift. */
const KEY_TURN = Math.PI / 180;
const KEY_TURN_SHIFT = Math.PI / 12;

/**
 * An editable datum inside an `ImageStage`: a ring at the origin with its i axis (an arm ending
 * in a rotation handle) and its j axis (half as long, a quarter turn clockwise from i).
 *
 * - **Pointer.** Drag the ring to move the origin; drag the arm or its handle to turn the datum
 *   about the origin. A press grabs whichever is nearer, and nothing happens until the pointer
 *   has moved 3 px, so a click does not nudge it. Hold Shift to round the angle to `angleSnap`
 *   (15°), or set `snapAlways`. `originSnap` rounds the origin to a grid; `bounds` keeps it in.
 * - **Keyboard.** The origin is a focusable button: arrow keys move it one image pixel (ten with
 *   Shift; one grid step with `originSnap`), and `[` / `]` turn it by 1° (15° with Shift).
 * - **Rendering.** Every part is a constant size on screen at every zoom, over a halo.
 * - **Panning.** A press away from the glyph, or with the hand tool or space held, still pans.
 *
 * The SVG carries `data-editable`, and `data-dragging` (`origin` or `arm`) during a drag.
 */
export function DatumEditor({
  value,
  defaultValue,
  onValueChange,
  onCommit,
  editable = true,
  rotatable = true,
  angleSnap = Math.PI / 12,
  snapAlways = false,
  originSnap = 0,
  bounds,
  armLength = DATUM_ARM_PX,
  label = "Datum",
  stroke = overlayRole("model"),
  className,
}: DatumEditorProps) {
  const stage = useStage();
  const px = useScreenPx();
  const coarse = useCoarsePointer();
  const startDrag = useStageDrag();
  const [own, setOwn] = useState<Datum>(
    () => defaultValue ?? { origin: { x: (stage.image.width - 1) / 2, y: (stage.image.height - 1) / 2 }, angle: 0 },
  );
  const [dragging, setDragging] = useState<"origin" | "arm" | null>(null);
  const datum = value ?? own;
  const area = bounds ?? { x: -PIXEL_CENTRE, y: -PIXEL_CENTRE, width: stage.image.width, height: stage.image.height };

  const set = (next: Datum) => {
    setOwn(next);
    onValueChange?.(next);
  };

  const press = (event: PointerEvent<SVGElement>) => {
    if (!editable || stage.panMode) return;
    if (event.pointerType !== "touch" && event.button !== 0) return;
    const at = stage.toImage({ x: event.clientX, y: event.clientY });
    const grab = datumPress(datum, at, stage.view.scale, hitRadiusPx(event.pointerType), { armLength, rotatable });
    if (grab === null) return;
    const start = datum;
    const from = { x: event.clientX, y: event.clientY };
    // Turning follows the pointer's direction from the origin, less where on the arm it grabbed,
    // so the datum does not jump to the pointer when the arm is grabbed a little off its line.
    const offset = Math.atan2(at.y - start.origin.y, at.x - start.origin.x) - start.angle;
    let moved = false;
    let last: Datum | null = null;
    setDragging(grab);
    startDrag(event, {
      claimsTouch: true,
      onMove: (p, e) => {
        if (!moved && Math.hypot(e.clientX - from.x, e.clientY - from.y) <= CLICK_SLOP) return;
        moved = true;
        if (grab === "origin") {
          last = moveDatum(start, { x: start.origin.x + p.x - at.x, y: start.origin.y + p.y - at.y }, { grid: originSnap, bounds: area });
        } else {
          const turned = rotatePoint(p.x - start.origin.x, p.y - start.origin.y, -offset);
          const to = { x: start.origin.x + turned.x, y: start.origin.y + turned.y };
          last = rotateDatum(start, to, snapAlways || e.shiftKey ? angleSnap : 0);
        }
        set(last);
      },
      onEnd: () => {
        setDragging(null);
        if (moved && last) onCommit?.(last);
      },
      onCancel: () => {
        setDragging(null);
        if (last) set(start);
      },
    });
  };

  const onKeyDown = (event: KeyboardEvent<SVGElement>) => {
    if (!editable) return;
    let next: Datum | null = null;
    if (rotatable && (event.key === "[" || event.key === "]")) {
      const turn = (event.key === "]" ? 1 : -1) * (event.shiftKey ? KEY_TURN_SHIFT : KEY_TURN);
      next = { origin: datum.origin, angle: normalizeAngle(datum.angle + turn) };
    } else {
      const step = (originSnap > 0 ? originSnap : 1) * (event.shiftKey ? 10 : 1);
      const delta: Record<string, Point> = {
        ArrowLeft: { x: -step, y: 0 },
        ArrowRight: { x: step, y: 0 },
        ArrowUp: { x: 0, y: -step },
        ArrowDown: { x: 0, y: step },
      };
      const d = delta[event.key];
      if (d) next = moveDatum(datum, { x: datum.origin.x + d.x, y: datum.origin.y + d.y }, { grid: originSnap, bounds: area });
    }
    if (next === null) return;
    event.preventDefault();
    event.stopPropagation();
    set(next);
    onCommit?.(next);
  };

  const ring = px(DATUM_RING_PX);
  const axes = datumAxes(datum, px(armLength));
  const c = Math.cos(datum.angle);
  const s = Math.sin(datum.angle);
  // The axes start at the ring, so the origin itself stays visible.
  const iFrom = { x: datum.origin.x + ring * c, y: datum.origin.y + ring * s };
  const jFrom = { x: datum.origin.x - ring * s, y: datum.origin.y + ring * c };
  const handle = editable && rotatable;
  const head = arrowHeadPoints(axes.i, datum.angle, px(4));
  const headPoints = head.map((p) => `${p.x},${p.y}`).join(" ");
  const degrees = (datum.angle * 180) / Math.PI;
  const band = px(2 * (coarse ? TOUCH_RADIUS_PX : POINTER_RADIUS_PX));

  return (
    <svg
      viewBox={imageViewBox(stage.image)}
      className={cn("pointer-events-none absolute inset-0 h-full w-full overflow-visible", className)}
      data-editable={editable ? "" : undefined}
      data-dragging={dragging ?? undefined}
    >
      <g fill="none" strokeLinecap="round" strokeLinejoin="round" data-datum="">
        <g stroke={HALO}>
          <circle cx={datum.origin.x} cy={datum.origin.y} r={ring} strokeWidth={px(1.5 + 2)} />
          <line x1={iFrom.x} y1={iFrom.y} x2={axes.i.x} y2={axes.i.y} strokeWidth={px(1.5 + 2)} />
          <line x1={jFrom.x} y1={jFrom.y} x2={axes.j.x} y2={axes.j.y} strokeWidth={px(1 + 2)} />
          {!handle && <polyline points={headPoints} strokeWidth={px(1.5 + 2)} />}
          <circle cx={datum.origin.x} cy={datum.origin.y} r={px(1.5 + 1)} fill={HALO} stroke="none" />
        </g>
        <g stroke={stroke}>
          <circle data-datum-ring="" cx={datum.origin.x} cy={datum.origin.y} r={ring} strokeWidth={px(1.5)} />
          <line data-axis="i" x1={iFrom.x} y1={iFrom.y} x2={axes.i.x} y2={axes.i.y} strokeWidth={px(1.5)} />
          <line data-axis="j" x1={jFrom.x} y1={jFrom.y} x2={axes.j.x} y2={axes.j.y} strokeWidth={px(1)} />
          {!handle && <polyline points={headPoints} strokeWidth={px(1.5)} />}
          <circle cx={datum.origin.x} cy={datum.origin.y} r={px(1.5)} fill={stroke} stroke="none" />
        </g>
      </g>
      {editable && rotatable && (
        // The arm's band: a wide transparent stroke, so a press a few pixels off the arm still turns it.
        <line
          data-datum-arm=""
          x1={iFrom.x}
          y1={iFrom.y}
          x2={axes.i.x}
          y2={axes.i.y}
          stroke="transparent"
          strokeWidth={band}
          aria-hidden
          className="pointer-events-auto"
          style={{ pointerEvents: "stroke", cursor: "grab" }}
          onPointerDown={press}
        />
      )}
      {handle && (
        <circle
          data-handle="rotate"
          cx={axes.i.x}
          cy={axes.i.y}
          r={px(DATUM_HANDLE_PX)}
          fill={stroke}
          stroke={HALO}
          strokeWidth={px(1)}
          className="pointer-events-auto"
          style={{ cursor: "grab" }}
          onPointerDown={press}
        />
      )}
      {editable && (
        <circle
          cx={datum.origin.x}
          cy={datum.origin.y}
          r={ring + band / 2}
          fill="transparent"
          role="button"
          tabIndex={0}
          aria-label={`${label}: origin ${fmt(datum.origin.x)}, ${fmt(datum.origin.y)}, angle ${fmt(degrees)}°`}
          aria-roledescription="datum"
          className="pointer-events-auto cursor-move outline-none focus-visible:stroke-signal"
          strokeWidth={px(2)}
          onPointerDown={press}
          onKeyDown={onKeyDown}
        />
      )}
    </svg>
  );
}

/** A number for the accessible name: to a tenth, without a trailing ".0". */
function fmt(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return String(rounded === 0 ? 0 : rounded);
}
