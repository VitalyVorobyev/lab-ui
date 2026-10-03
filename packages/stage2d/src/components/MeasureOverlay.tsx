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
 * This component holds **no app state**: no fetch, no selection, no hover tracking. It is a
 * pure function of its props, on purpose — the app decides what a "caliper box" or a
 * "detected edge" *is*; this only knows how to draw one. The one piece of arithmetic it
 * owns is `strokeScale` compensation (see `measureGeometry.ts`'s `strokeWidthFor`), because
 * getting that wrong is invisible on screen until someone zooms in and a "1px" edge marker
 * has silently become 8px wide.
 */

import { imageViewBox } from "./stage/view";
import { arcPath, arrowHeadPoints, caliperArrow, caliperCorners, crossSegments, dimensionGeometry, polygonPath, strokeWidthFor } from "./measureGeometry";
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

/** Anything `MeasureOverlay` can draw, discriminated by `kind`. */
export type MeasurePrimitive =
  | PointPrimitive
  | SegmentPrimitive
  | CirclePrimitive
  | ArcPrimitive
  | CaliperPrimitive
  | DimensionPrimitive
  | PolylinePrimitive;

const DEFAULT_LABEL_SIZE = 11;
const DEFAULT_POINT_RADIUS = 3;
const DEFAULT_CROSS_SIZE = 5;
const DEFAULT_DIMENSION_OFFSET = 16;

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
 * rings it in the selection colour, and `dimmed` fades it. Each primitive is a `<g>` carrying
 * `data-kind`, plus `data-id` and `data-state` when given.
 */
export function MeasureOverlay({
  nativeWidth,
  nativeHeight,
  primitives,
  strokeScale,
  className,
}: MeasureOverlayProps) {
  const hairline = strokeWidthFor(strokeScale, 1);
  const thick = strokeWidthFor(strokeScale, 1.5);
  const labelSize = strokeWidthFor(strokeScale, DEFAULT_LABEL_SIZE);

  return (
    <svg
      role="presentation"
      aria-hidden
      viewBox={imageViewBox({ width: nativeWidth, height: nativeHeight })}
      preserveAspectRatio="none"
      className={cn("pointer-events-none absolute inset-0 h-full w-full overflow-visible", className)}
    >
      {primitives.map((primitive, index) => {
        const state = primitive.state ?? "default";
        const colour = primitive.role ? overlayRole(primitive.role) : toneColor(primitive.tone);
        // Hover and selected widen the strokes by the overlay grammar's ratios (2 and 2.5 to the
        // default's 1.5).
        const widen = state === "hover" ? 2 / 1.5 : state === "selected" ? 2.5 / 1.5 : 1;
        return (
          <g
            // Primitives carry no required identity; a position is the only stable key.
            // eslint-disable-next-line @eslint-react/no-array-index-key
            key={index}
            data-kind={primitive.kind}
            data-id={primitive.id}
            data-state={primitive.state}
            opacity={OVERLAY_STATE_OPACITY[state] === 1 ? undefined : OVERLAY_STATE_OPACITY[state]}
          >
            {state === "selected" && (
              <g opacity={0.6}>
                <Primitive
                  primitive={primitive}
                  colour={overlayRole("selection")}
                  hairline={hairline * widen + strokeWidthFor(strokeScale, 3)}
                  thick={thick * widen + strokeWidthFor(strokeScale, 3)}
                  labelSize={0}
                  strokeScale={strokeScale}
                  ring
                />
              </g>
            )}
            <Primitive
              primitive={primitive}
              colour={colour}
              hairline={hairline * widen}
              thick={thick * widen}
              labelSize={labelSize}
              strokeScale={strokeScale}
            />
          </g>
        );
      })}
    </svg>
  );
}

function Primitive({
  primitive,
  colour,
  hairline,
  thick,
  labelSize,
  strokeScale,
  ring = false,
}: {
  primitive: MeasurePrimitive;
  colour: string;
  hairline: number;
  thick: number;
  labelSize: number;
  strokeScale: number;
  /** Drawn as the selection ring under the mark: no fill on a filled circle, a larger dot. */
  ring?: boolean;
}) {

  switch (primitive.kind) {
    case "point": {
      if (primitive.cross) {
        const size = strokeWidthFor(strokeScale, DEFAULT_CROSS_SIZE);
        const [h, v] = crossSegments(primitive.x, primitive.y, size);
        return (
          <g stroke={colour} strokeWidth={hairline}>
            <line x1={h[0].x} y1={h[0].y} x2={h[1].x} y2={h[1].y} />
            <line x1={v[0].x} y1={v[0].y} x2={v[1].x} y2={v[1].y} />
            <Label x={primitive.x} y={primitive.y - size - 2} text={primitive.label} colour={colour} size={labelSize} />
          </g>
        );
      }
      // The ring under a selected dot is the dot grown by 2 screen px.
      const radius = strokeWidthFor(strokeScale, (primitive.radius ?? DEFAULT_POINT_RADIUS) + (ring ? 2 : 0));
      return (
        <g>
          <circle cx={primitive.x} cy={primitive.y} r={radius} fill={colour} />
          <Label x={primitive.x} y={primitive.y - radius - 2} text={primitive.label} colour={colour} size={labelSize} />
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
          strokeDasharray={primitive.dashed ? `${hairline * 4} ${hairline * 3}` : undefined}
        />
      );

    case "circle":
      return (
        <circle
          cx={primitive.cx}
          cy={primitive.cy}
          r={primitive.r}
          fill={primitive.filled && !ring ? colour : "none"}
          stroke={primitive.filled && !ring ? "none" : colour}
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
      const head = arrowHeadPoints(arrow.to, primitive.angle, strokeWidthFor(strokeScale, 4));
      return (
        <g>
          <path d={polygonPath(corners)} fill="none" stroke={colour} strokeWidth={hairline} />
          {primitive.showDirection !== false && (
            <g stroke={colour} strokeWidth={thick} strokeLinecap="round" strokeLinejoin="round" fill="none">
              <line x1={arrow.from.x} y1={arrow.from.y} x2={arrow.to.x} y2={arrow.to.y} />
              <polyline points={head.map((p) => `${p.x},${p.y}`).join(" ")} />
            </g>
          )}
          <Label x={primitive.cx} y={primitive.cy} text={primitive.label} colour={colour} size={labelSize} />
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
            strokeDasharray={primitive.dashed ? `${hairline * 4} ${hairline * 3}` : undefined}
          />
          {primitive.points.length >= 2 && (
            <Label
              x={primitive.points[0]!}
              y={primitive.points[1]! - strokeWidthFor(strokeScale, 4)}
              text={primitive.label}
              colour={colour}
              size={labelSize}
            />
          )}
        </g>
      );

    case "dimension": {
      const offset = primitive.offset ?? DEFAULT_DIMENSION_OFFSET;
      const geometry = dimensionGeometry(primitive.x1, primitive.y1, primitive.x2, primitive.y2, offset);
      return (
        <g stroke={colour} strokeWidth={hairline}>
          <line x1={geometry.extensionLine1[0].x} y1={geometry.extensionLine1[0].y} x2={geometry.extensionLine1[1].x} y2={geometry.extensionLine1[1].y} opacity={0.5} />
          <line x1={geometry.extensionLine2[0].x} y1={geometry.extensionLine2[0].y} x2={geometry.extensionLine2[1].x} y2={geometry.extensionLine2[1].y} opacity={0.5} />
          <line x1={geometry.dimensionLine[0].x} y1={geometry.dimensionLine[0].y} x2={geometry.dimensionLine[1].x} y2={geometry.dimensionLine[1].y} />
          <text
            x={geometry.labelAnchor.x}
            y={geometry.labelAnchor.y}
            fontSize={labelSize}
            fill={colour}
            stroke="none"
            textAnchor="middle"
            dominantBaseline="text-after-edge"
            transform={`rotate(${geometry.angleDegrees} ${geometry.labelAnchor.x} ${geometry.labelAnchor.y})`}
          >
            {primitive.label}
          </text>
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
}: {
  x: number;
  y: number;
  text?: string | undefined;
  colour: string;
  size: number;
}) {
  if (!text || !(size > 0)) return null;
  return (
    <text x={x} y={y} fontSize={size} fill={colour} textAnchor="middle" dominantBaseline="text-after-edge">
      {text}
    </text>
  );
}
