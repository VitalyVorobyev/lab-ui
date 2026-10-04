/**
 * A rotated rectangle or ellipse as an object: moved, resized from eight handles in its own
 * frame, and turned from a rotation handle, on the image.
 *
 * The axis-aligned `RectRoiEditor` cannot hold a rotated bounding box or an ellipse fit, which
 * is what an annotation tool and a detector's fitted marker are. The arithmetic is `shapeEdit.ts`;
 * this is the gestures, the handles and the keyboard.
 */

import { useEffect, useRef, type KeyboardEvent, type PointerEvent, type SVGProps } from "react";

import type { Point } from "./measureGeometry";
import { overlayRole } from "./overlayRole";
import { ROI_HANDLES, type RoiHandle } from "./roiEdit";
import {
  fromShapeFrame,
  moveShape,
  resizeShape,
  rotateShape,
  rotationHandlePoint,
  shapeHandleCursor,
  shapeHandlePoint,
  shapePress,
  SHAPE_HANDLE_PX,
  SHAPE_ROTATE_OFFSET_PX,
  SHAPE_ROTATE_RADIUS_PX,
  type RotatedShape,
} from "./shapeEdit";
import { POINTER_RADIUS_PX, TOUCH_RADIUS_PX, hitRadiusPx } from "./stage/gesture";
import { useStage } from "./stage/ImageStage";
import { useCoarsePointer } from "./stage/useCoarsePointer";
import { useScreenPx } from "./stage/useScreenPx";
import { imageViewBox } from "./stage/view";

/** Outline width, in screen pixels. */
const STROKE_PX = 1.5;
/** The halo under the outline (visual-language §5), in screen pixels on each side. */
const HALO_PX = 1;
/** Shift while rotating rounds to this step, and `[` / `]` turn by 1° (15° with Shift). */
const SNAP = Math.PI / 12;
const KEY_TURN = Math.PI / 180;
const HALO = overlayRole("halo");

/** Props of `ShapeEditor`. */
export interface ShapeEditorProps {
  /** `"rect"` draws a rotated rectangle, `"ellipse"` the ellipse inscribed in it. */
  kind: "rect" | "ellipse";
  /**
   * The shape in image coordinates, or `null` for none. `rotation` is in **radians, clockwise
   * on screen**, so a value in degrees (Konva's, say) is `degrees * Math.PI / 180`. An
   * ellipse's `width` and `height` are its full axes, `2 · radiusX` and `2 · radiusY`.
   */
  value: RotatedShape | null;
  /** Called with the shape as it changes: on every move of a drag, and on each key nudge. */
  onValueChange: (value: RotatedShape) => void;
  /** Called once a gesture ends (a drag released, a nudge made): the moment to save or re-run. */
  onCommit?: ((value: RotatedShape) => void) | undefined;
  /** Show handles and accept moves, resizes and rotations. Defaults to `true`. */
  editable?: boolean | undefined;
  /** Show the rotation handle and accept `[` / `]`. Defaults to `true`; off for a shape that must stay level. */
  rotatable?: boolean | undefined;
  /** The smallest extent on either axis, in image pixels. Defaults to 5. */
  minSize?: number | undefined;
  /** The shape's accessible name. Defaults to "Shape". */
  label?: string | undefined;
  /** CSS colour of the outline and handles. Defaults to the overlay `selection` role. */
  stroke?: string | undefined;
}

type Drag = (
  | { kind: "move"; from: Point }
  | { kind: "resize"; handle: RoiHandle }
  | { kind: "rotate" }
) & { start: RotatedShape; moved: boolean; pointerId: number };

/**
 * An editable rotated rectangle or ellipse inside an `ImageStage`.
 *
 * - **Handles.** Eight handles resize the shape in its own frame: the dragged side follows the
 *   pointer and the opposite side stays where it is, whatever the rotation. A shape stops at
 *   `minSize` rather than flipping. The interior moves it, and so does the band along its
 *   outline (the pointer's tolerance: 6 px for a mouse, 12 px for a finger), which is how a thin
 *   or rotated shape is grabbed. The band is as wide as the device's primary pointer needs
 *   (`(pointer: coarse)`), so on a touch laptop whose primary pointer is fine, a touch 6 to
 *   12 px outside the outline reaches the layers below instead of the editor.
 * - **Press order.** One decision serves every part of the editor: the nearest handle first,
 *   then the interior or outline band (move), then nothing. A small shape's interior does not
 *   steal a press meant for a handle, and a press that hits none of them is not claimed, so
 *   it reaches whatever is below, or the stage.
 * - **Touch.** A press that grabs the shape is claimed; a second finger landing during an edit
 *   cancels it (the shape reverts, nothing is committed) and is left to the stage.
 * - **Rotation.** The handle past the top side turns the shape about its centre; hold Shift to
 *   round to 15°.
 * - **Keyboard.** The shape is focusable: arrow keys move it by one image pixel (ten with Shift),
 *   with Alt they grow or shrink it along its own axes from its top-left corner, and `[` / `]`
 *   turn it by 1° (15° with Shift).
 * - **Rendering.** Handles and the outline are a constant size on screen at every zoom; an
 *   ellipse also shows its bounding box, where the handles are.
 * - **Panning.** A press with the hand tool, or with space held, still pans.
 *
 * It does not draw a new shape (`DraftShape` previews one while the app's tool does), and does
 * not keep the shape inside the image.
 *
 * The SVG carries `data-editable`; the outline carries `data-shape`.
 */
export function ShapeEditor({
  kind,
  value,
  onValueChange,
  onCommit,
  editable = true,
  rotatable = true,
  minSize = 5,
  label = "Shape",
  stroke = overlayRole("selection"),
}: ShapeEditorProps) {
  const stage = useStage();
  const px = useScreenPx();
  const coarse = useCoarsePointer();
  const dragRef = useRef<Drag | null>(null);
  const lastRef = useRef<RotatedShape | null>(null);
  const stopWatchRef = useRef<(() => void) | null>(null);

  const report = (next: RotatedShape) => {
    lastRef.current = next;
    onValueChange(next);
  };

  /** Abandon an edit in flight: the shape reverts and nothing is committed. */
  const cancelEdit = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    stopWatchRef.current?.();
    stopWatchRef.current = null;
    if (drag && lastRef.current) onValueChange(drag.start);
    lastRef.current = null;
  };

  // An edit still in flight when the editor goes away is cancelled, not left listening.
  useEffect(() => () => stopWatchRef.current?.(), []);

  /**
   * The one press decision for the whole editor: every target (the interior, the outline
   * band, a handle) comes here, and the nearest handle wins over the interior. A declined
   * press is not claimed and bubbles to the stage.
   */
  const press = (event: PointerEvent<SVGElement>) => {
    if (!value || stage.panMode) return;
    const touch = event.pointerType === "touch";
    if (!touch && event.button !== 0) return;
    // A second finger while an edit is in flight cancels it (a pinch, not an edit), unclaimed.
    if (dragRef.current) {
      if (touch && dragRef.current.pointerId !== event.pointerId) cancelEdit();
      return;
    }
    const at = stage.toImage({ x: event.clientX, y: event.clientY });
    const decision = shapePress(value, kind, stage.view.scale, at, hitRadiusPx(event.pointerType), rotatable);
    if (!decision) return;
    event.stopPropagation();
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // The pointer ended before this handler ran; the edit still follows the events the editor receives.
    }
    const base = { start: value, moved: false, pointerId: event.pointerId };
    dragRef.current =
      decision.kind === "move"
        ? { ...base, kind: "move", from: at }
        : decision.kind === "resize"
          ? { ...base, kind: "resize", handle: decision.handle }
          : { ...base, kind: "rotate" };
    lastRef.current = null;
    if (touch) {
      const id = event.pointerId;
      const other = (e: globalThis.PointerEvent) => {
        if (e.pointerId !== id && e.pointerType === "touch") cancelEdit();
      };
      window.addEventListener("pointerdown", other);
      stopWatchRef.current = () => window.removeEventListener("pointerdown", other);
    }
  };

  const onMove = (event: PointerEvent<SVGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.stopPropagation();
    const p = stage.toImage({ x: event.clientX, y: event.clientY });
    drag.moved = true;
    if (drag.kind === "move") report(moveShape(drag.start, p.x - drag.from.x, p.y - drag.from.y));
    else if (drag.kind === "resize") report(resizeShape(drag.start, drag.handle, p, minSize));
    else report(rotateShape(drag.start, p, event.shiftKey ? SNAP : 0));
  };

  const onEnd = (event: PointerEvent<SVGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.stopPropagation();
    dragRef.current = null;
    stopWatchRef.current?.();
    stopWatchRef.current = null;
    if (drag.moved && lastRef.current) onCommit?.(lastRef.current);
  };

  /** The handlers every target of the editor shares. */
  const gesture = {
    onPointerDown: press,
    onPointerMove: onMove,
    onPointerUp: onEnd,
    onPointerCancel: (event: PointerEvent<SVGElement>) => {
      if (dragRef.current?.pointerId === event.pointerId) cancelEdit();
    },
    onLostPointerCapture: onEnd,
    onDoubleClick: (event: { stopPropagation: () => void }) => event.stopPropagation(),
  };

  const onKeyDown = (event: KeyboardEvent<SVGElement>) => {
    if (!editable || value === null) return;
    const turn = rotatable && (event.key === "[" || event.key === "]");
    if (turn) {
      event.preventDefault();
      event.stopPropagation();
      const angle = (event.key === "]" ? 1 : -1) * (event.shiftKey ? SNAP : KEY_TURN);
      const next = { ...value, rotation: value.rotation + angle };
      onValueChange(next);
      onCommit?.(next);
      return;
    }
    const step = event.shiftKey ? 10 : 1;
    const delta: Record<string, Point> = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    };
    const d = delta[event.key];
    if (!d) return;
    event.preventDefault();
    event.stopPropagation();
    // Alt grows from the top-left corner, along the shape's own axes, as `RectRoiEditor` does.
    const next = event.altKey
      ? resizeShape(value, "se", fromShapeFrame(value, { x: value.width / 2 + d.x, y: value.height / 2 + d.y }), minSize)
      : moveShape(value, d.x, d.y);
    onValueChange(next);
    onCommit?.(next);
  };

  const stem = value ? { from: shapeHandlePoint(value, "n"), to: rotationHandlePoint(value, px(SHAPE_ROTATE_OFFSET_PX)) } : null;
  const handleSize = px(SHAPE_HANDLE_PX);

  return (
    <svg
      viewBox={imageViewBox(stage.image)}
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      data-editable={editable ? "" : undefined}
    >
      {value && <Outline kind={kind} shape={value} fill="none" stroke={HALO} strokeWidth={px(STROKE_PX + 2 * HALO_PX)} />}
      {value && <Outline kind={kind} shape={value} data-shape={kind} fill={stroke} fillOpacity={0.12} stroke={stroke} strokeWidth={px(STROKE_PX)} />}
      {kind === "ellipse" && value && (
        <rect
          x={value.cx - value.width / 2}
          y={value.cy - value.height / 2}
          width={value.width}
          height={value.height}
          transform={turned(value)}
          fill="none"
          stroke={stroke}
          strokeWidth={px(1)}
          strokeDasharray={`${px(4)} ${px(3)}`}
          opacity={0.6}
        />
      )}
      {editable && value && (
        // The outline band: a wide transparent stroke, so a press a few pixels outside the
        // outline still reaches the editor. Sized for the device's primary pointer (a finger's
        // 12 px on a touch-first device, a mouse's 6 px otherwise) so a mouse press just
        // outside the outline reaches the layers below. `press` decides with the event's own pointer.
        <Outline
          kind={kind}
          shape={value}
          data-shape-band=""
          fill="none"
          stroke="transparent"
          strokeWidth={px(2 * (coarse ? TOUCH_RADIUS_PX : POINTER_RADIUS_PX))}
          strokeLinejoin="round"
          aria-hidden
          className="pointer-events-auto cursor-move"
          style={{ pointerEvents: "stroke" }}
          {...gesture}
        />
      )}
      {editable && value && (
        <Outline
          kind={kind}
          shape={value}
          fill="transparent"
          role="button"
          tabIndex={0}
          aria-label={`${label}: centre ${fmt(value.cx)}, ${fmt(value.cy)}, ${fmt(value.width)} × ${fmt(value.height)} px, rotated ${fmt((value.rotation * 180) / Math.PI)}°`}
          aria-roledescription={kind === "rect" ? "rotated rectangle" : "ellipse"}
          className="pointer-events-auto cursor-move outline-none focus-visible:stroke-signal"
          strokeWidth={px(2)}
          {...gesture}
          onKeyDown={onKeyDown}
        />
      )}
      {editable && value && rotatable && stem && (
        <>
          <line x1={stem.from.x} y1={stem.from.y} x2={stem.to.x} y2={stem.to.y} stroke={HALO} strokeWidth={px(1 + 2 * HALO_PX)} />
          <line x1={stem.from.x} y1={stem.from.y} x2={stem.to.x} y2={stem.to.y} stroke={stroke} strokeWidth={px(1)} />
          <circle
            data-handle="rotate"
            cx={stem.to.x}
            cy={stem.to.y}
            r={px(SHAPE_ROTATE_RADIUS_PX)}
            fill={stroke}
            stroke={HALO}
            strokeWidth={px(1)}
            className="pointer-events-auto"
            style={{ cursor: "grab" }}
            {...gesture}
          />
        </>
      )}
      {editable &&
        value &&
        ROI_HANDLES.map((handle) => {
          const centre = shapeHandlePoint(value, handle);
          return (
            <rect
              key={handle}
              data-handle={handle}
              x={centre.x - handleSize / 2}
              y={centre.y - handleSize / 2}
              width={handleSize}
              height={handleSize}
              fill={stroke}
              stroke={HALO}
              strokeWidth={px(1)}
              className="pointer-events-auto"
              style={{ cursor: shapeHandleCursor(handle, value.rotation) }}
              {...gesture}
            />
          );
        })}
    </svg>
  );
}

/** What the outline element takes: any SVG attribute, and `data-*`. */
type OutlineProps = Omit<SVGProps<SVGElement>, "ref"> & Record<`data-${string}`, string>;

/** The shape drawn level about its centre and turned by its rotation: a rectangle, or the ellipse inscribed in it. */
function Outline({ kind, shape, ...rest }: OutlineProps & { kind: "rect" | "ellipse"; shape: RotatedShape }) {
  const transform = turned(shape);
  return kind === "rect" ? (
    <rect x={shape.cx - shape.width / 2} y={shape.cy - shape.height / 2} width={shape.width} height={shape.height} transform={transform} {...rest} />
  ) : (
    <ellipse cx={shape.cx} cy={shape.cy} rx={shape.width / 2} ry={shape.height / 2} transform={transform} {...rest} />
  );
}

/** The SVG transform that turns a shape drawn level about its centre. */
function turned(shape: RotatedShape): string {
  return `rotate(${(shape.rotation * 180) / Math.PI} ${shape.cx} ${shape.cy})`;
}

function fmt(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
