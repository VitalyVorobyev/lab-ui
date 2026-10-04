/**
 * A region of interest as an object rather than a gesture: drawn, moved and resized on the
 * image, kept inside it.
 *
 * Its predecessors in the apps could only draw a *new* box: every press started again from a
 * corner, so a box that was nearly right had to be redrawn, and one drawn at fit could not
 * be refined by zooming in first. Here the box has eight handles and an interior, and it lives
 * inside `ImageStage`'s transform, so it stays on the pixels it encloses at any zoom.
 *
 * Every press on the box is decided once, by `shapePress`: the nearest handle first, then the
 * band along the outline, then (unless `interior` is `"none"`) the inside. Every gesture then
 * runs through `useShapeDrag`, so a press that stays within the click slop edits nothing.
 */

import { useImperativeHandle, useState, type KeyboardEvent, type PointerEvent, type Ref } from "react";

import { cn } from "@vitavision/ui";
import type { Point } from "./measureGeometry";
import {
  ROI_HANDLES,
  ROI_HANDLE_CURSOR,
  clampRect,
  moveRect,
  rectFromCorners,
  resizeRect,
  roiHandlePoint,
} from "./roiEdit";
import { overlayRole } from "./overlayRole";
import { shapePress, type RotatedShape } from "./shapeEdit";
import { CLICK_SLOP, POINTER_RADIUS_PX, TOUCH_RADIUS_PX, hitRadiusPx } from "./stage/gesture";
import type { StagePointerEvent } from "./stage/hitContext";
import { useStage } from "./stage/ImageStage";
import type { StageDrag, StagePress } from "./stage/StageSurface";
import { useCoarsePointer } from "./stage/useCoarsePointer";
import { useScreenPx } from "./stage/useScreenPx";
import { PIXEL_CENTRE, imageViewBox, type Rect } from "./stage/view";
import { useShapeDrag } from "./useShapeDrag";

/** Handle square side, in screen pixels. */
const HANDLE_PX = 9;
/** Outline width, in screen pixels. */
const STROKE_PX = 1.5;
/** The dark halo under the outline, in screen pixels on each side. */
const HALO_PX = 1;
const HALO = overlayRole("halo");

/**
 * What `RectRoiEditor`'s `ref` exposes: a new region drawn from a press the app's own target
 * received, for an app whose one `StageSurface` decides what a press means.
 */
export interface RectRoiEditorHandle {
  /**
   * Draw a new region from a press: call it from a `pointerdown` handler, such as a layer's
   * `onItemPress`. The press is claimed (the stage does not pan) and followed on `window`; a
   * drag shorter than the click slop, or a box smaller than `minSize`, draws nothing. Another
   * event type (a touch tap reported on release) does nothing. Works whether or not `draw` is
   * set, and does nothing while `editable` is off or the stage is in pan mode.
   */
  startDraw(event: StagePointerEvent): void;
  /**
   * The same draw as a `StageDrag`, to return from `StageSurface`'s `onPress`. It claims a
   * touch, so a finger draws instead of panning. While `editable` is off it is an empty drag:
   * the press is claimed and nothing is drawn.
   */
  drawDrag(press: StagePress): StageDrag;
}

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
   * Whether `draw` puts a full-frame draw target (`data-draw-surface`) in this layer. Defaults
   * to `true`. Turn it off when the app's own `StageSurface` decides what a press means, so
   * other layers can sit between the target and the region's handles, and start the draw from
   * there with the `ref`'s `drawDrag` or `startDraw`.
   */
  drawSurface?: boolean | undefined;
  /**
   * What a press inside the region does. `"move"` (the default) moves it. `"none"` leaves the
   * inside to the layers below (a press there selects what lies under the region, say): only
   * the handles and the band along the outline grab the region. The region stays focusable and
   * the arrow keys still move it.
   */
  interior?: "move" | "none" | undefined;
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
  /** CSS colour of the tint inside the region. Defaults to `stroke`. */
  fill?: string | undefined;
  /** Opacity of the tint inside the region, 0 to 1. Defaults to 0.06; `0` draws no tint. */
  fillOpacity?: number | undefined;
  /** Draw from the app's own press target; see `RectRoiEditorHandle`. */
  ref?: Ref<RectRoiEditorHandle> | undefined;
}

/**
 * An editable axis-aligned region inside an `ImageStage`.
 *
 * - **Handles.** The eight handles resize the region, and the interior moves it, as does the
 *   band along the outline (the pointer's tolerance: 6 px for a mouse, 12 px for a finger). A
 *   handle dragged through the opposite edge flips the box.
 * - **Press order.** One decision serves every part of the editor: the nearest handle first,
 *   then the outline band, then the interior (unless `interior` is `"none"`). A small region's
 *   interior does not steal a press meant for a handle, and a press that grabs nothing is not
 *   claimed.
 * - **Click slop.** A press becomes an edit only once the pointer has moved 3 screen pixels, so
 *   a jittery click calls neither `onValueChange` nor `onCommit`. An interrupted drag
 *   (`pointercancel`) puts the region back and commits nothing.
 * - **Drawing.** With `draw`, a drag elsewhere on the image draws a new region; with
 *   `drawSurface={false}` the app starts it through the `ref`.
 * - **Keyboard.** The region is focusable: arrow keys move it by one image pixel (ten with
 *   Shift), and with Alt they grow or shrink it from the bottom-right corner.
 * - **Limits.** The region stays inside `bounds` and never gets smaller than `minSize`.
 * - **Rendering.** Handles and the outline are a constant size on screen at every zoom.
 * - **Panning.** A press with the hand tool, or with space held, still pans.
 *
 * Data attributes, for styling and tests: the SVG carries `data-editable`, and `data-drawing`
 * while a draw is in progress; the full-frame draw target is `data-draw-surface`; the region's
 * focusable inside is `data-roi-interior`; the band along its outline is `data-roi-band`; and
 * each handle is `data-handle`, one of `nw`, `n`, `ne`, `e`, `se`, `s`, `sw`, `w`.
 */
export function RectRoiEditor({
  value,
  onValueChange,
  onCommit,
  editable = true,
  draw = false,
  drawSurface = true,
  interior = "move",
  bounds,
  minSize = 4,
  label = "Region",
  stroke = overlayRole("selection"),
  fill = stroke,
  fillOpacity = 0.06,
  ref,
}: RectRoiEditorProps) {
  const stage = useStage();
  const area = bounds ?? { x: -PIXEL_CENTRE, y: -PIXEL_CENTRE, width: stage.image.width, height: stage.image.height };
  const [drawing, setDrawing] = useState<Rect | null>(null);
  const startShapeDrag = useShapeDrag();
  const coarse = useCoarsePointer();

  const px = useScreenPx();
  const shown = drawing ?? value;

  /**
   * The one press decision for the band, the interior and every handle: the nearest handle
   * wins over the band and the interior. A declined press is not claimed and bubbles on.
   */
  const press = (event: PointerEvent<SVGElement>) => {
    if (!value || !editable || stage.panMode || event.button !== 0) return;
    const at = stage.toImage({ x: event.clientX, y: event.clientY });
    const decision = shapePress(asShape(value), "rect", stage.view.scale, at, hitRadiusPx(event.pointerType), false, interior === "move");
    if (!decision) return;
    const start = value;
    let last: Rect | null = null;
    startShapeDrag(event, {
      onMove: (delta) => {
        last =
          decision.kind === "resize"
            ? resizeRect(start, decision.handle, { x: at.x + delta.x, y: at.y + delta.y }, area, minSize)
            : moveRect(start, delta.x, delta.y, area);
        onValueChange(last);
      },
      onEnd: (_delta, moved) => {
        if (moved && last) onCommit?.(last);
      },
      onCancel: () => {
        if (last) onValueChange(start);
      },
    });
  };

  /** A draw from `from`: the box to the pointer, clamped, shown while in flight and kept on release. */
  const drawFrom = (from: Point) => {
    let drawn: Rect | null = null;
    return {
      to: (p: Point) => {
        drawn = clampRect(rectFromCorners(clampPoint(from, area), clampPoint(p, area)), area, 0);
        setDrawing(drawn);
      },
      end: (moved: boolean) => {
        setDrawing(null);
        // A drawn box smaller than `minSize` is a click, not a region.
        if (moved && drawn && drawn.width >= minSize && drawn.height >= minSize) {
          onValueChange(drawn);
          onCommit?.(drawn);
        }
      },
      cancel: () => setDrawing(null),
    };
  };

  const startDraw = (event: StagePointerEvent) => {
    if (!editable || stage.panMode) return;
    const from = stage.toImage({ x: event.clientX, y: event.clientY });
    const gesture = drawFrom(from);
    startShapeDrag(event, {
      onMove: (delta) => gesture.to({ x: from.x + delta.x, y: from.y + delta.y }),
      onEnd: (_delta, moved) => gesture.end(moved),
      onCancel: gesture.cancel,
    });
  };

  const drawDrag = (pressed: StagePress): StageDrag => {
    if (!editable) return {};
    const gesture = drawFrom(pressed.point);
    let moved = false;
    return {
      claimsTouch: true,
      onMove: (point, event) => {
        if (!moved && Math.hypot(event.clientX - pressed.client.x, event.clientY - pressed.client.y) <= CLICK_SLOP) return;
        moved = true;
        gesture.to(point);
      },
      onEnd: () => gesture.end(moved),
      onCancel: gesture.cancel,
    };
  };

  useImperativeHandle(ref, () => ({ startDraw, drawDrag }));

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

  const keepDoubleClick = (event: { stopPropagation: () => void }) => event.stopPropagation();

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
        fill={fillOpacity > 0 ? fill : "none"}
        fillOpacity={fillOpacity > 0 ? fillOpacity : undefined}
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
      {draw && editable && drawSurface && (
        <rect
          data-draw-surface=""
          x={area.x}
          y={area.y}
          width={area.width}
          height={area.height}
          fill="transparent"
          className="pointer-events-auto cursor-crosshair"
          onPointerDown={(event) => {
            if (event.button === 0) startDraw(event);
          }}
        />
      )}
      {outline}
      {editable && value && !drawing && (
        // The outline band: a wide transparent stroke, so a press a few pixels either side of
        // the outline still grabs the region, even when its inside is left to the layers
        // below. Sized for the device's primary pointer; `press` decides with the event's own.
        <rect
          data-roi-band=""
          x={value.x}
          y={value.y}
          width={value.width}
          height={value.height}
          fill="none"
          stroke="transparent"
          strokeWidth={px(2 * (coarse ? TOUCH_RADIUS_PX : POINTER_RADIUS_PX))}
          aria-hidden
          className="pointer-events-auto cursor-move"
          style={{ pointerEvents: "stroke" }}
          onPointerDown={press}
          onDoubleClick={keepDoubleClick}
        />
      )}
      {editable && value && !drawing && (
        <rect
          data-roi-interior=""
          x={value.x}
          y={value.y}
          width={value.width}
          height={value.height}
          fill="transparent"
          role="button"
          tabIndex={0}
          aria-label={`${label}: ${fmt(value.x)}, ${fmt(value.y)}, ${fmt(value.width)} × ${fmt(value.height)} px`}
          aria-roledescription="region"
          className={cn(
            "outline-none focus-visible:stroke-signal",
            interior === "move" ? "pointer-events-auto cursor-move" : "pointer-events-none",
          )}
          onPointerDown={press}
          onKeyDown={onKeyDown}
          onDoubleClick={keepDoubleClick}
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
              onPointerDown={press}
              onDoubleClick={keepDoubleClick}
            />
          );
        })}
    </svg>
  );
}

/** The region as an unrotated shape, for the shared press decision. */
function asShape(rect: Rect): RotatedShape {
  return { cx: rect.x + rect.width / 2, cy: rect.y + rect.height / 2, width: rect.width, height: rect.height, rotation: 0 };
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
