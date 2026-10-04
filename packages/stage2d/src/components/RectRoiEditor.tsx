/**
 * A region of interest as an object rather than a gesture: drawn, moved and resized on the
 * image, kept inside it.
 *
 * Its predecessors in the apps could only draw a *new* box: every press started again from a
 * corner, so a box that was nearly right had to be redrawn, and one drawn at fit could not
 * be refined by zooming in first. Here the box has eight handles and an interior, and it lives
 * inside `ImageStage`'s transform, so it stays on the pixels it encloses at any zoom.
 */

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import type { Point } from "./measureGeometry";
import {
  ROI_HANDLES,
  ROI_HANDLE_CURSOR,
  clampRect,
  moveRect,
  rectFromCorners,
  resizeRect,
  roiHandlePoint,
  type RoiHandle,
} from "./roiEdit";
import { overlayRole } from "./overlayRole";
import { useStage } from "./stage/ImageStage";
import { useScreenPx } from "./stage/useScreenPx";
import { PIXEL_CENTRE, imageViewBox, type Rect } from "./stage/view";

/** Handle square side, in screen pixels. */
const HANDLE_PX = 9;
/** Outline width, in screen pixels. */
const STROKE_PX = 1.5;
/** The halo under the outline (visual-language §5), in screen pixels on each side. */
const HALO_PX = 1;
const HALO = overlayRole("halo");

/** Props of `RectRoiEditor`. */
export interface RectRoiEditorProps {
  /** The region in image coordinates, or `null` for none. */
  value: Rect | null;
  /** Called with the region as it changes: on every move of a drag, and on each key nudge. */
  onValueChange: (value: Rect) => void;
  /** Called once a gesture ends (a drag released, a nudge made): the moment to save or re-run. */
  onCommit?: ((value: Rect) => void) | undefined;
  /** Show handles and accept moves and resizes. Defaults to `true`. */
  editable?: boolean | undefined;
  /**
   * Draw a new region with a drag on the image, outside the current one. Only while the app's
   * region tool is active: in draw mode the layer claims presses that would otherwise pan.
   */
  draw?: boolean | undefined;
  /**
   * The area the region must stay in, in the stage's centre convention. Defaults to
   * `{ x: -0.5, y: -0.5, width, height }` of the image: its full extent, so a region that
   * fills it outlines the image edges.
   */
  bounds?: Rect | undefined;
  /** The smallest side, in image pixels; a smaller drawn box is a click, not a region. Defaults to 4. */
  minSize?: number | undefined;
  /** The region's accessible name. Defaults to "Region". */
  label?: string | undefined;
  /** CSS colour of the outline and handles. Defaults to the overlay `selection` role. */
  stroke?: string | undefined;
}

type Drag =
  | { kind: "move"; from: Point; start: Rect; moved: boolean }
  | { kind: "resize"; handle: RoiHandle; start: Rect; moved: boolean }
  | { kind: "draw"; from: Point; moved: boolean };

/**
 * An editable axis-aligned region inside an `ImageStage`.
 *
 * - **Handles.** The eight handles resize the region, and the interior moves it. A handle
 *   dragged through the opposite edge flips the box.
 * - **Drawing.** With `draw`, a drag elsewhere on the image draws a new region.
 * - **Keyboard.** The region is focusable: arrow keys move it by one image pixel (ten with
 *   Shift), and with Alt they grow or shrink it from the bottom-right corner.
 * - **Limits.** The region stays inside `bounds` and never gets smaller than `minSize`.
 * - **Rendering.** Handles and the outline are a constant size on screen at every zoom.
 * - **Panning.** A press with the hand tool, or with space held, still pans.
 *
 * The SVG carries `data-editable` and `data-drawing` (while a draw is in progress).
 */
export function RectRoiEditor({
  value,
  onValueChange,
  onCommit,
  editable = true,
  draw = false,
  bounds,
  minSize = 4,
  label = "Region",
  stroke = overlayRole("selection"),
}: RectRoiEditorProps) {
  const stage = useStage();
  const area = bounds ?? { x: -PIXEL_CENTRE, y: -PIXEL_CENTRE, width: stage.image.width, height: stage.image.height };
  const dragRef = useRef<Drag | null>(null);
  const lastRef = useRef<Rect | null>(null);
  const [drawing, setDrawing] = useState<Rect | null>(null);

  const px = useScreenPx();
  const shown = drawing ?? value;

  const report = (next: Rect) => {
    lastRef.current = next;
    onValueChange(next);
  };

  const begin = (event: PointerEvent<SVGElement>, drag: Drag) => {
    if (stage.panMode || event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = drag;
    lastRef.current = null;
  };

  const onMove = (event: PointerEvent<SVGElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    event.stopPropagation();
    const p = stage.toImage({ x: event.clientX, y: event.clientY });
    drag.moved = true;
    if (drag.kind === "move") {
      report(moveRect(drag.start, p.x - drag.from.x, p.y - drag.from.y, area));
    } else if (drag.kind === "resize") {
      report(resizeRect(drag.start, drag.handle, p, area, minSize));
    } else {
      const drawn = clampRect(rectFromCorners(clampPoint(drag.from, area), clampPoint(p, area)), area, 0);
      // Kept in the ref too: a pointer-up can arrive before the move's render, and the end of
      // the gesture must see the box the last move drew.
      lastRef.current = drawn;
      setDrawing(drawn);
    }
  };

  const onEnd = (event: PointerEvent<SVGElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    event.stopPropagation();
    dragRef.current = null;
    if (drag.kind === "draw") {
      const drawn = lastRef.current;
      setDrawing(null);
      // A drawn box smaller than `minSize` is a click, not a region.
      if (drawn && drawn.width >= minSize && drawn.height >= minSize) {
        onValueChange(drawn);
        onCommit?.(drawn);
      }
      return;
    }
    if (drag.moved && lastRef.current) onCommit?.(lastRef.current);
  };

  const onKeyDown = (event: KeyboardEvent<SVGElement>) => {
    if (!editable || value === null) return;
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
    const next = event.altKey
      ? clampRect({ ...value, width: value.width + d.x, height: value.height + d.y }, area, minSize)
      : moveRect(value, d.x, d.y, area);
    onValueChange(next);
    onCommit?.(next);
  };

  const outline = shown && (
    <>
      <rect
        x={shown.x}
        y={shown.y}
        width={shown.width}
        height={shown.height}
        fill="none"
        stroke={HALO}
        strokeWidth={px(STROKE_PX + 2 * HALO_PX)}
      />
      <rect
        x={shown.x}
        y={shown.y}
        width={shown.width}
        height={shown.height}
        fill={stroke}
        fillOpacity={0.06}
        stroke={stroke}
        strokeWidth={px(STROKE_PX)}
        strokeDasharray={`${px(6)} ${px(4)}`}
      />
    </>
  );

  return (
    <svg
      viewBox={imageViewBox(stage.image)}
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      data-editable={editable ? "" : undefined}
      data-drawing={drawing ? "" : undefined}
    >
      {draw && editable && (
        <rect
          data-draw-surface=""
          x={area.x}
          y={area.y}
          width={area.width}
          height={area.height}
          fill="transparent"
          className="pointer-events-auto cursor-crosshair"
          onPointerDown={(event) =>
            begin(event, { kind: "draw", from: stage.toImage({ x: event.clientX, y: event.clientY }), moved: false })
          }
          onPointerMove={onMove}
          onPointerUp={onEnd}
          onLostPointerCapture={onEnd}
        />
      )}
      {outline}
      {editable && value && !drawing && (
        <rect
          x={value.x}
          y={value.y}
          width={value.width}
          height={value.height}
          fill="transparent"
          role="button"
          tabIndex={0}
          aria-label={`${label}: ${fmt(value.x)}, ${fmt(value.y)}, ${fmt(value.width)} × ${fmt(value.height)} px`}
          aria-roledescription="region"
          className="pointer-events-auto cursor-move outline-none focus-visible:stroke-signal"
          onPointerDown={(event) =>
            begin(event, {
              kind: "move",
              from: stage.toImage({ x: event.clientX, y: event.clientY }),
              start: value,
              moved: false,
            })
          }
          onPointerMove={onMove}
          onPointerUp={onEnd}
          onLostPointerCapture={onEnd}
          onKeyDown={onKeyDown}
          onDoubleClick={(event) => event.stopPropagation()}
        />
      )}
      {editable &&
        value &&
        !drawing &&
        ROI_HANDLES.map((handle) => {
          const centre = roiHandlePoint(value, handle);
          const size = px(HANDLE_PX);
          return (
            <rect
              key={handle}
              data-handle={handle}
              x={centre.x - size / 2}
              y={centre.y - size / 2}
              width={size}
              height={size}
              fill={stroke}
              stroke={HALO}
              strokeWidth={px(1)}
              className="pointer-events-auto"
              style={{ cursor: ROI_HANDLE_CURSOR[handle] }}
              onPointerDown={(event) => begin(event, { kind: "resize", handle, start: value, moved: false })}
              onPointerMove={onMove}
              onPointerUp={onEnd}
              onLostPointerCapture={onEnd}
              onDoubleClick={(event) => event.stopPropagation()}
            />
          );
        })}
    </svg>
  );
}

function clampPoint(p: Point, area: Rect): Point {
  return {
    x: Math.min(area.x + area.width, Math.max(area.x, p.x)),
    y: Math.min(area.y + area.height, Math.max(area.y, p.y)),
  };
}

function fmt(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
