/**
 * A vector overlay layer for measurement primitives, drawn in source-image pixel
 * coordinates.
 *
 * Meant to sit as one of the layers inside `ImageStage`, alongside the image itself and any
 * raster layers (a mask, a false-colour value plane). Because the whole stack is transformed
 * together, a caliper box drawn here stays registered with the pixel it measures at any zoom
 * or pan. The overlay never touches the DOM to find out where it is; it is told, in
 * `nativeWidth` × `nativeHeight` pixel coordinates, via `primitives`.
 *
 * This component holds **no app state**: no fetch, no selection. It draws its props, on
 * purpose — the app decides what a "caliper box" or a "detected edge" *is*; this only knows
 * how to draw one. The one piece of arithmetic it owns is `strokeScale` compensation (see
 * `measureGeometry.ts`'s `strokeWidthFor`), because getting that wrong is invisible on screen
 * until someone zooms in and a "1px" edge marker has silently become 8px wide.
 *
 * Given a hover or press handler it becomes pickable: it answers the stage's hit-test with
 * `measureHit.ts`'s geometry and tracks the hover the app does not control, while its SVG
 * still takes no pointer events.
 */

import { useEffect, useState } from "react";

import { nearestMeasurePrimitive } from "./measureHit";
import type { StagePointerEvent } from "./stage/hitContext";
import { STAGE_HIT_PRIORITY } from "./stage/hitTest";
import { useStageHitLayer } from "./stage/useStageHitTest";
import { imageViewBox } from "./stage/view";
import {
  arcPath,
  arrowHeadPoints,
  caliperArrow,
  caliperCorners,
  crossSegments,
  dimensionGeometry,
  MEASURE_ARROW_HEAD_PX,
  MEASURE_CROSS_PX,
  MEASURE_DIMENSION_OFFSET,
  MEASURE_POINT_RADIUS_PX,
  polygonPath,
  segmentsPath,
  strokeWidthFor,
} from "./measureGeometry";
import { OVERLAY_STATE_OPACITY, overlayRole, type OverlayRole, type OverlayState } from "./overlayRole";
import { polylinePath } from "./polylineIndex";
import { cn, toneColor, type MeasureTone } from "@vitavision/ui";

export type { MeasureTone };

/**
 * Optional fields every primitive takes. All are additive: a primitive without them draws
 * exactly as before.
 */
export interface PrimitiveCommon {
  /** An identity, written to the primitive's `data-id`, for linking a mark to a row in a list. */
  id?: string | undefined;
  /** Interaction state: hover thickens, selected adds a ring, dimmed fades (overlay grammar). */
  state?: OverlayState | undefined;
  /** An overlay role colour, instead of `tone`: `feature`, `model`, `structure`. */
  role?: OverlayRole | undefined;
}

/** A marked location: a dot, or a cross for a subpixel edge. */
export interface PointPrimitive extends PrimitiveCommon {
  /** Discriminant. */
  kind: "point";
  /** Image x of the point. */
  x: number;
  /** Image y of the point. */
  y: number;
  /** Verdict colour. Defaults to the neutral tone. */
  tone?: MeasureTone;
  /** Native-pixel radius of the dot. Ignored when `cross` is set. */
  radius?: number;
  /** Drawn as a cross instead of a dot — the usual mark for a subpixel edge location. */
  cross?: boolean;
  /** Text drawn just above the mark. */
  label?: string;
}

/** A straight line between two image points. */
export interface SegmentPrimitive extends PrimitiveCommon {
  /** Discriminant. */
  kind: "segment";
  /** Image x of the first end. */
  x1: number;
  /** Image y of the first end. */
  y1: number;
  /** Image x of the second end. */
  x2: number;
  /** Image y of the second end. */
  y2: number;
  /** Verdict colour. Defaults to the neutral tone. */
  tone?: MeasureTone;
  /** A short dash pattern, e.g. for a fitted line shown against its inlier points. */
  dashed?: boolean;
}

/** A circle — a fitted bore, a tolerance ring. */
export interface CirclePrimitive extends PrimitiveCommon {
  /** Discriminant. */
  kind: "circle";
  /** Image x of the centre. */
  cx: number;
  /** Image y of the centre. */
  cy: number;
  /** Radius, in image pixels. */
  r: number;
  /** Verdict colour. Defaults to the neutral tone. */
  tone?: MeasureTone;
  /** Filled rather than stroked — rare, but a small confidence disc wants it. */
  filled?: boolean;
}

/** A circular arc, swept forward (clockwise on screen) from `startAngle` to `endAngle`. */
export interface ArcPrimitive extends PrimitiveCommon {
  /** Discriminant. */
  kind: "arc";
  /** Image x of the centre. */
  cx: number;
  /** Image y of the centre. */
  cy: number;
  /** Radius, in image pixels. */
  r: number;
  /** Radians. `x = cx + r·cos(a)`, `y = cy + r·sin(a)` — clockwise on screen. */
  startAngle: number;
  /** Radians, same convention as `startAngle`. A full turn past it draws a whole circle. */
  endAngle: number;
  /** Verdict colour. Defaults to the neutral tone. */
  tone?: MeasureTone;
}

/** A caliper search box: a rotated rectangle with an arrow along its scan direction. */
export interface CaliperPrimitive extends PrimitiveCommon {
  /** Discriminant. */
  kind: "caliper";
  /** Image x of the box centre. */
  cx: number;
  /** Image y of the box centre. */
  cy: number;
  /** Along the box's own measurement axis. */
  width: number;
  /** Perpendicular to the measurement axis — the search span. */
  height: number;
  /** Radians, the box's own rotation (and its measurement direction). */
  angle: number;
  /** Verdict colour. Defaults to the neutral tone. */
  tone?: MeasureTone;
  /** Draws the direction arrow along the box's +x axis. Defaults to on. */
  showDirection?: boolean;
  /** Text drawn at the box centre. */
  label?: string;
}

/** A dimension annotation: extension lines, an offset dimension line, and its value as text. */
export interface DimensionPrimitive extends PrimitiveCommon {
  /** Discriminant. */
  kind: "dimension";
  /** Image x of the first measured point. */
  x1: number;
  /** Image y of the first measured point. */
  y1: number;
  /** Image x of the second measured point. */
  x2: number;
  /** Image y of the second measured point. */
  y2: number;
  /** The measured value as text, drawn along the dimension line. */
  label: string;
  /** Verdict colour. Defaults to the neutral tone. */
  tone?: MeasureTone;
  /** Native pixels the dimension line sits off the measured span. Defaults to 16. */
  offset?: number;
}

/**
 * A polyline through image points, e.g. a model's contour. It replaces one `segment` per
 * edge, which runs to thousands of elements for a model outline.
 */
export interface PolylinePrimitive extends PrimitiveCommon {
  /** Discriminant. */
  kind: "polyline";
  /** `[x0, y0, x1, y1, …]` in image coordinates. */
  points: number[];
  /** Join the last point to the first. */
  closed?: boolean;
  /** Verdict colour. Defaults to the neutral tone. */
  tone?: MeasureTone;
  /** A short dash pattern. */
  dashed?: boolean;
  /** Text drawn just above the first point. */
  label?: string;
}

/**
 * Many unconnected segments drawn as one element, e.g. the tick marks of a shape model whose
 * points are stored in no particular order, so that a `polyline` cannot join them. Thousands
 * of segments cost one path, not one element each.
 */
export interface SegmentsPrimitive extends PrimitiveCommon {
  /** Discriminant. */
  kind: "segments";
  /**
   * `[x1, y1, x2, y2, …]` in image coordinates: four numbers per segment. A trailing partial
   * segment is ignored, and a segment with a non-finite coordinate is skipped.
   */
  points: number[];
  /** Verdict colour. Defaults to the neutral tone. */
  tone?: MeasureTone;
  /** A short dash pattern. */
  dashed?: boolean;
  /** Text drawn just above the first segment's start. */
  label?: string;
}

/**
 * Anything `MeasureOverlay` can draw, discriminated by `kind`. Kinds are added in minor
 * releases, so code that switches over `kind` should keep a default case.
 */
export type MeasurePrimitive =
  | PointPrimitive
  | SegmentPrimitive
  | SegmentsPrimitive
  | CirclePrimitive
  | ArcPrimitive
  | CaliperPrimitive
  | DimensionPrimitive
  | PolylinePrimitive;

const DEFAULT_LABEL_SIZE = 11;
/** How much wider than the mark above it a halo is, in screen pixels. */
const HALO_PX = 2;
const HALO_OPACITY = 0.6;
/** The halo behind a label's glyphs, in screen pixels. */
const LABEL_HALO_PX = 3;
/** How much wider than the mark a selection ring is, and how much a selected dot's ring grows its radius. */
const RING_PX = 3;
const RING_GROW_PX = 2;
const HALO = overlayRole("halo");

/** Props of `MeasureOverlay`. */
export interface MeasureOverlayProps {
  /** The source image's pixel width — the overlay's `viewBox`, and every primitive's frame. */
  nativeWidth: number;
  /** The source image's pixel height. */
  nativeHeight: number;
  /** What to draw, in image pixel coordinates, bottom to top. */
  primitives: MeasurePrimitive[];
  /**
   * The combined image-pixel → screen-pixel scale currently in effect, so a stroke or a
   * label declared at "1 screen pixel" stays that size regardless of zoom. Inside an
   * `ImageStage` (which lays the overlay out at exactly `nativeWidth` × `nativeHeight` CSS
   * pixels) this is simply `useStage().view.scale`. See `strokeWidthFor`.
   */
  strokeScale: number;
  /**
   * Which primitives get a halo: a dark band under the mark (2 screen px wider, at 60 %
   * opacity) and behind its label's glyphs (3 screen px), so it holds on a bright part of the
   * image as well as a dark one.
   * - `"role"` (the default): primitives that carry a `role`.
   * - `"all"`: every primitive, verdict tones included.
   * - `"none"`: none.
   */
  halo?: "role" | "all" | "none" | undefined;
  /**
   * The hovered primitive's `id`, when the app controls hover (a table beside the stage hovers
   * rows too). That primitive is drawn in the hover state unless it is selected. Without it, a
   * pickable overlay tracks the pointer's hover itself.
   */
  hoveredId?: string | null | undefined;
  /**
   * Called when the primitive under the pointer changes: its `id`, or `null` when the pointer
   * leaves every primitive. Only primitives with an `id` are picked.
   *
   * Setting this or `onItemPress` makes the overlay pickable: it answers the stage's hit-test,
   * so it must then sit inside an `ImageStage`. Its SVG still takes no pointer events.
   */
  onHoverChange?: ((id: string | null) => void) | undefined;
  /**
   * A press landed on a primitive with an `id`: the nearest within the pointer's tolerance, the
   * later one on a tie. The press is claimed, so the stage does not pan from it. Return `false`
   * to decline it: the press then goes to the next layer under the pointer, or to the stage.
   * The event is the `pointerdown` (the `pointerup` for a touch tap).
   */
  onItemPress?: ((id: string, event: StagePointerEvent) => boolean | void) | undefined;
  /** The id hit-tests report for this layer. Defaults to a generated one. */
  layerId?: string | undefined;
  /** Rank against other layers in hit-tests. Defaults to `STAGE_HIT_PRIORITY.line`. */
  priority?: number | undefined;
  /** Merged onto the `<svg>` with `cn`. */
  className?: string;
}

/**
 * A vector overlay of measurement primitives — points, segments, polylines, circles, arcs,
 * caliper boxes, dimensions — drawn in source-image pixel coordinates.
 *
 * Place it as a layer inside `ImageStage` so it moves with the image. It is a pure function
 * of its props and decorative to assistive technology (`aria-hidden`), so a result drawn
 * only here must also be stated in text.
 *
 * A primitive's colour is its `role` (overlay grammar) if given, else its verdict `tone`.
 * Its `state` follows the overlay grammar: `hover` thickens it, `selected` thickens it and
 * rings it in the selection colour, and `dimmed` fades it. A primitive with a `role` is drawn
 * over a halo, and so is its label; `halo` widens or drops that.
 *
 * **Picking.** With `onHoverChange` or `onItemPress` the overlay answers the stage's hit-test
 * (`useStageHitTest` finds its primitives too): the pointer picks the nearest primitive with
 * an `id`, a dot, a filled circle and a caliper box by their inside, every other kind by its
 * strokes. The hovered one is drawn in the hover state.
 *
 * Each primitive is a `<g>` carrying `data-kind`, plus `data-id` and `data-state` (`hover`
 * while hovered) when given; its halo is the `<g data-halo>` inside it. The SVG carries
 * `data-hovered` (the hovered id).
 */
export function MeasureOverlay({
  nativeWidth,
  nativeHeight,
  primitives,
  strokeScale,
  halo = "role",
  hoveredId,
  onHoverChange,
  onItemPress,
  layerId,
  priority = STAGE_HIT_PRIORITY.line,
  className,
}: MeasureOverlayProps) {
  const pickable = onHoverChange !== undefined || onItemPress !== undefined;
  const [ownHover, setOwnHover] = useState<string | null>(null);
  const hoverId = hoveredId !== undefined ? hoveredId : pickable ? ownHover : null;
  const hairline = strokeWidthFor(strokeScale, 1);
  const thick = strokeWidthFor(strokeScale, 1.5);
  const labelSize = strokeWidthFor(strokeScale, DEFAULT_LABEL_SIZE);
  const labelHalo = strokeWidthFor(strokeScale, LABEL_HALO_PX);

  return (
    <>
      {pickable && (
        <MeasureHitLayer
          primitives={primitives}
          strokeScale={strokeScale}
          layerId={layerId}
          priority={priority}
          setOwnHover={setOwnHover}
          onHoverChange={onHoverChange}
          onItemPress={onItemPress}
        />
      )}
      <svg
        role="presentation"
        aria-hidden
        viewBox={imageViewBox({ width: nativeWidth, height: nativeHeight })}
        preserveAspectRatio="none"
        className={cn("pointer-events-none absolute inset-0 h-full w-full overflow-visible", className)}
        data-hovered={hoverId ?? undefined}
      >
        {primitives.map((primitive, index) => {
          // Hover is drawn on any primitive but a selected one, which keeps its selection.
          const hovered = hoverId !== null && primitive.id === hoverId && primitive.state !== "selected";
          const shown = hovered ? "hover" : primitive.state;
          const state = shown ?? "default";
          const colour = primitive.role ? overlayRole(primitive.role) : toneColor(primitive.tone);
          // Hover and selected widen the strokes by the overlay grammar's ratios (2 and 2.5 to the
          // default's 1.5).
          const widen = state === "hover" ? 2 / 1.5 : state === "selected" ? 2.5 / 1.5 : 1;
          const haloed = halo === "all" || (halo === "role" && primitive.role !== undefined);
          // Measured off the mark's own width, so the bands under a dashed mark break where it does.
          const dash = `${hairline * widen * 4} ${hairline * widen * 3}`;
          // A selected mark's outermost band is its ring: the halo goes under that and outgrows it.
          const ring = state === "selected";
          const haloPx = (ring ? RING_PX : 0) + HALO_PX;
          return (
            <g
              // Primitives carry no required identity; a position is the only stable key.
              // eslint-disable-next-line @eslint-react/no-array-index-key
              key={index}
              data-kind={primitive.kind}
              data-id={primitive.id}
              data-state={shown}
              opacity={OVERLAY_STATE_OPACITY[state] === 1 ? undefined : OVERLAY_STATE_OPACITY[state]}
            >
              {haloed && (
                <g data-halo="" opacity={HALO_OPACITY}>
                  <Primitive
                    primitive={primitive}
                    colour={HALO}
                    hairline={hairline * widen + strokeWidthFor(strokeScale, haloPx)}
                    thick={thick * widen + strokeWidthFor(strokeScale, haloPx)}
                    dash={dash}
                    labelSize={0}
                    labelHalo={0}
                    strokeScale={strokeScale}
                    grow={(ring ? RING_GROW_PX : 0) + HALO_PX / 2}
                  />
                </g>
              )}
              {ring && (
                <g opacity={0.6}>
                  <Primitive
                    primitive={primitive}
                    colour={overlayRole("selection")}
                    hairline={hairline * widen + strokeWidthFor(strokeScale, RING_PX)}
                    thick={thick * widen + strokeWidthFor(strokeScale, RING_PX)}
                    dash={dash}
                    labelSize={0}
                    labelHalo={0}
                    strokeScale={strokeScale}
                    grow={RING_GROW_PX}
                  />
                </g>
              )}
              <Primitive
                primitive={primitive}
                colour={colour}
                hairline={hairline * widen}
                thick={thick * widen}
                dash={dash}
                labelSize={labelSize}
                labelHalo={haloed ? labelHalo : 0}
                strokeScale={strokeScale}
              />
            </g>
          );
        })}
      </svg>
    </>
  );
}

/**
 * The overlay's registration with the stage's hit-test. A component of its own so that it is
 * mounted only when the overlay is pickable: a plain overlay needs no `ImageStage` around it.
 */
function MeasureHitLayer({
  primitives,
  strokeScale,
  layerId,
  priority,
  setOwnHover,
  onHoverChange,
  onItemPress,
}: {
  primitives: readonly MeasurePrimitive[];
  strokeScale: number;
  layerId: string | undefined;
  priority: number;
  setOwnHover: (id: string | null) => void;
  onHoverChange: ((id: string | null) => void) | undefined;
  onItemPress: ((id: string, event: StagePointerEvent) => boolean | void) | undefined;
}) {
  useStageHitLayer({
    layerId,
    priority,
    pick: (point, radius) => {
      const hit = nearestMeasurePrimitive(primitives, point, radius, strokeScale);
      return hit ? { id: hit.id, dist: hit.distance } : null;
    },
    onHover: (id) => {
      const next = id === null ? null : String(id);
      setOwnHover(next);
      onHoverChange?.(next);
    },
    onPress: onItemPress ? (id, event) => onItemPress(String(id), event) : undefined,
  });
  // A hover tracked here ends with the layer, so it is not drawn when the overlay is made pickable again.
  useEffect(() => () => setOwnHover(null), [setOwnHover]);
  return null;
}

function Primitive({
  primitive,
  colour,
  hairline,
  thick,
  dash,
  labelSize,
  labelHalo,
  strokeScale,
  grow,
}: {
  primitive: MeasurePrimitive;
  colour: string;
  hairline: number;
  thick: number;
  /** The dash pattern of a dashed mark. */
  dash: string;
  /** Label font size; 0 draws no label. */
  labelSize: number;
  /** Width of the halo behind a label's glyphs; 0 draws none. */
  labelHalo: number;
  strokeScale: number;
  /**
   * Set for a band drawn under the mark (its halo, its selection ring): screen pixels a dot's
   * radius grows by. A filled circle is then outlined rather than filled.
   */
  grow?: number | undefined;
}) {
  const band = grow !== undefined;

  switch (primitive.kind) {
    case "point": {
      if (primitive.cross) {
        const size = strokeWidthFor(strokeScale, MEASURE_CROSS_PX);
        const [h, v] = crossSegments(primitive.x, primitive.y, size);
        return (
          <g stroke={colour} strokeWidth={hairline}>
            <line x1={h[0].x} y1={h[0].y} x2={h[1].x} y2={h[1].y} />
            <line x1={v[0].x} y1={v[0].y} x2={v[1].x} y2={v[1].y} />
            <Label x={primitive.x} y={primitive.y - size - 2} text={primitive.label} colour={colour} size={labelSize} halo={labelHalo} />
          </g>
        );
      }
      const radius = strokeWidthFor(strokeScale, (primitive.radius ?? MEASURE_POINT_RADIUS_PX) + (grow ?? 0));
      return (
        <g>
          <circle cx={primitive.x} cy={primitive.y} r={radius} fill={colour} />
          <Label x={primitive.x} y={primitive.y - radius - 2} text={primitive.label} colour={colour} size={labelSize} halo={labelHalo} />
        </g>
      );
    }

    case "segment":
      return (
        <line
          x1={primitive.x1}
          y1={primitive.y1}
          x2={primitive.x2}
          y2={primitive.y2}
          stroke={colour}
          strokeWidth={hairline}
          strokeDasharray={primitive.dashed ? dash : undefined}
        />
      );

    case "segments": {
      const p = primitive.points;
      return (
        <g>
          <path d={segmentsPath(p)} fill="none" stroke={colour} strokeWidth={hairline} strokeDasharray={primitive.dashed ? dash : undefined} />
          {p.length >= 4 && (
            <Label x={p[0]!} y={p[1]! - strokeWidthFor(strokeScale, 4)} text={primitive.label} colour={colour} size={labelSize} halo={labelHalo} />
          )}
        </g>
      );
    }

    case "circle":
      return (
        <circle
          cx={primitive.cx}
          cy={primitive.cy}
          r={primitive.r}
          fill={primitive.filled && !band ? colour : "none"}
          stroke={primitive.filled && !band ? "none" : colour}
          strokeWidth={hairline}
        />
      );

    case "arc":
      return (
        <path
          d={arcPath(primitive.cx, primitive.cy, primitive.r, primitive.startAngle, primitive.endAngle)}
          fill="none"
          stroke={colour}
          strokeWidth={hairline}
          strokeLinecap="round"
        />
      );

    case "caliper": {
      const corners = caliperCorners(primitive.cx, primitive.cy, primitive.width, primitive.height, primitive.angle);
      const arrow = caliperArrow(primitive.cx, primitive.cy, primitive.width, primitive.angle);
      const head = arrowHeadPoints(arrow.to, primitive.angle, strokeWidthFor(strokeScale, MEASURE_ARROW_HEAD_PX));
      return (
        <g>
          <path d={polygonPath(corners)} fill="none" stroke={colour} strokeWidth={hairline} />
          {primitive.showDirection !== false && (
            <g stroke={colour} strokeWidth={thick} strokeLinecap="round" strokeLinejoin="round" fill="none">
              <line x1={arrow.from.x} y1={arrow.from.y} x2={arrow.to.x} y2={arrow.to.y} />
              <polyline points={head.map((p) => `${p.x},${p.y}`).join(" ")} />
            </g>
          )}
          <Label x={primitive.cx} y={primitive.cy} text={primitive.label} colour={colour} size={labelSize} halo={labelHalo} />
        </g>
      );
    }

    case "polyline":
      return (
        <g>
          <path
            d={polylinePath(primitive.points, primitive.closed === true)}
            fill="none"
            stroke={colour}
            strokeWidth={hairline}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={primitive.dashed ? dash : undefined}
          />
          {primitive.points.length >= 2 && (
            <Label
              x={primitive.points[0]!}
              y={primitive.points[1]! - strokeWidthFor(strokeScale, 4)}
              text={primitive.label}
              colour={colour}
              size={labelSize}
              halo={labelHalo}
            />
          )}
        </g>
      );

    case "dimension": {
      const offset = primitive.offset ?? MEASURE_DIMENSION_OFFSET;
      const geometry = dimensionGeometry(primitive.x1, primitive.y1, primitive.x2, primitive.y2, offset);
      return (
        <g stroke={colour} strokeWidth={hairline}>
          <line x1={geometry.extensionLine1[0].x} y1={geometry.extensionLine1[0].y} x2={geometry.extensionLine1[1].x} y2={geometry.extensionLine1[1].y} opacity={0.5} />
          <line x1={geometry.extensionLine2[0].x} y1={geometry.extensionLine2[0].y} x2={geometry.extensionLine2[1].x} y2={geometry.extensionLine2[1].y} opacity={0.5} />
          <line x1={geometry.dimensionLine[0].x} y1={geometry.dimensionLine[0].y} x2={geometry.dimensionLine[1].x} y2={geometry.dimensionLine[1].y} />
          {labelSize > 0 && (
            <text
              x={geometry.labelAnchor.x}
              y={geometry.labelAnchor.y}
              fontSize={labelSize}
              fill={colour}
              stroke={labelHalo > 0 ? HALO : "none"}
              strokeWidth={labelHalo > 0 ? labelHalo : undefined}
              strokeLinejoin={labelHalo > 0 ? "round" : undefined}
              paintOrder={labelHalo > 0 ? "stroke" : undefined}
              textAnchor="middle"
              dominantBaseline="text-after-edge"
              transform={`rotate(${geometry.angleDegrees} ${geometry.labelAnchor.x} ${geometry.labelAnchor.y})`}
            >
              {primitive.label}
            </text>
          )}
        </g>
      );
    }

    default:
      return null;
  }
}

function Label({
  x,
  y,
  text,
  colour,
  size,
  halo,
}: {
  x: number;
  y: number;
  text?: string | undefined;
  colour: string;
  size: number;
  /** Width of the halo behind the glyphs; 0 draws none, and the text keeps the stroke it inherits. */
  halo: number;
}) {
  if (!text || !(size > 0)) return null;
  return (
    <text
      x={x}
      y={y}
      fontSize={size}
      fill={colour}
      stroke={halo > 0 ? HALO : undefined}
      strokeWidth={halo > 0 ? halo : undefined}
      strokeLinejoin={halo > 0 ? "round" : undefined}
      paintOrder={halo > 0 ? "stroke" : undefined}
      textAnchor="middle"
      dominantBaseline="text-after-edge"
    >
      {text}
    </text>
  );
}
