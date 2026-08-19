/**
 * A vector overlay layer for measurement primitives, drawn in source-image pixel
 * coordinates.
 *
 * Meant to sit as one of the transformed children inside `ZoomPanCanvas`, alongside the
 * image itself and any raster layers (a mask, a false-colour value plane). Because the
 * whole stack is transformed together (see `ZoomPanCanvas`'s own docs), a caliper box
 * drawn here stays registered with the pixel it measures at any zoom or pan — the overlay
 * never touches the DOM to find out where it is; it is told, in `nativeWidth` ×
 * `nativeHeight` pixel coordinates, via `primitives`.
 *
 * This component holds **no app state**: no fetch, no selection, no hover tracking. It is a
 * pure function of its props, on purpose — the app decides what a "caliper box" or a
 * "detected edge" *is*; this only knows how to draw one. The one piece of arithmetic it
 * owns is `strokeScale` compensation (see `measureGeometry.ts`'s `strokeWidthFor`), because
 * getting that wrong is invisible on screen until someone zooms in and a "1px" edge marker
 * has silently become 8px wide.
 */

import { arcPath, arrowHeadPoints, caliperArrow, caliperCorners, crossSegments, dimensionGeometry, polygonPath, strokeWidthFor } from "./measureGeometry";
import { toneColor, type MeasureTone } from "../tone";
import { cn } from "./ui/cn";

export type { MeasureTone };

export interface PointPrimitive {
  kind: "point";
  x: number;
  y: number;
  tone?: MeasureTone;
  /** Native-pixel radius of the dot. Ignored when `cross` is set. */
  radius?: number;
  /** Drawn as a cross instead of a dot — the usual mark for a subpixel edge location. */
  cross?: boolean;
  label?: string;
}

export interface SegmentPrimitive {
  kind: "segment";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  tone?: MeasureTone;
  /** A short dash pattern, e.g. for a fitted line shown against its inlier points. */
  dashed?: boolean;
}

export interface CirclePrimitive {
  kind: "circle";
  cx: number;
  cy: number;
  r: number;
  tone?: MeasureTone;
  /** Filled rather than stroked — rare, but a small confidence disc wants it. */
  filled?: boolean;
}

export interface ArcPrimitive {
  kind: "arc";
  cx: number;
  cy: number;
  r: number;
  /** Radians. `x = cx + r·cos(a)`, `y = cy + r·sin(a)` — clockwise on screen. */
  startAngle: number;
  endAngle: number;
  tone?: MeasureTone;
}

export interface CaliperPrimitive {
  kind: "caliper";
  /** Box centre. */
  cx: number;
  cy: number;
  /** Along the box's own measurement axis. */
  width: number;
  /** Perpendicular to the measurement axis — the search span. */
  height: number;
  /** Radians, the box's own rotation (and its measurement direction). */
  angle: number;
  tone?: MeasureTone;
  /** Draws the direction arrow along the box's +x axis. Defaults to on. */
  showDirection?: boolean;
  label?: string;
}

export interface DimensionPrimitive {
  kind: "dimension";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
  tone?: MeasureTone;
  /** Native pixels the dimension line sits off the measured span. Defaults to 16. */
  offset?: number;
}

export type MeasurePrimitive =
  | PointPrimitive
  | SegmentPrimitive
  | CirclePrimitive
  | ArcPrimitive
  | CaliperPrimitive
  | DimensionPrimitive;

const DEFAULT_LABEL_SIZE = 11;
const DEFAULT_POINT_RADIUS = 3;
const DEFAULT_CROSS_SIZE = 5;
const DEFAULT_DIMENSION_OFFSET = 16;

export interface MeasureOverlayProps {
  /** The source image's pixel width — the overlay's `viewBox`, and every primitive's frame. */
  nativeWidth: number;
  nativeHeight: number;
  primitives: MeasurePrimitive[];
  /**
   * The combined image-pixel → screen-pixel scale currently in effect, so a stroke or a
   * label declared at "1 screen pixel" stays that size regardless of zoom. When the
   * overlay is sized to exactly `nativeWidth` × `nativeHeight` CSS pixels before any
   * `ZoomPanCanvas` transform (the common case — see that component's `View.zoom`), this
   * is simply the current `zoom`. See `measureGeometry.ts`'s `strokeWidthFor`.
   */
  strokeScale: number;
  className?: string;
}

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
      viewBox={`0 0 ${nativeWidth} ${nativeHeight}`}
      preserveAspectRatio="none"
      className={cn("pointer-events-none absolute inset-0 h-full w-full overflow-visible", className)}
    >
      {primitives.map((primitive, index) => (
        <Primitive
          key={index}
          primitive={primitive}
          hairline={hairline}
          thick={thick}
          labelSize={labelSize}
          strokeScale={strokeScale}
        />
      ))}
    </svg>
  );
}

function Primitive({
  primitive,
  hairline,
  thick,
  labelSize,
  strokeScale,
}: {
  primitive: MeasurePrimitive;
  hairline: number;
  thick: number;
  labelSize: number;
  strokeScale: number;
}) {
  const colour = toneColor(primitive.tone);

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
      const radius = strokeWidthFor(strokeScale, primitive.radius ?? DEFAULT_POINT_RADIUS);
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
          fill={primitive.filled ? colour : "none"}
          stroke={primitive.filled ? "none" : colour}
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
  text?: string;
  colour: string;
  size: number;
}) {
  if (!text) return null;
  return (
    <text x={x} y={y} fontSize={size} fill={colour} textAnchor="middle" dominantBaseline="text-after-edge">
      {text}
    </text>
  );
}
