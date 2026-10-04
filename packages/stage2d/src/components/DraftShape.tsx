/**
 * What an annotation tool shows while a shape is being drawn: a dashed preview of the
 * point, line, polyline, polygon, rectangle or ellipse so far, and the rubber band of a
 * multi-select.
 *
 * Both draw from state the app's tool keeps; neither takes input. The tool decides what a
 * press means (`StageSurface` and `useStageHitTest`); these only make it visible.
 */

import { overlayRole, type OverlayRole } from "./overlayRole";
import type { Point } from "./measureGeometry";
import { rectFromCorners } from "./roiEdit";
import { useStage } from "./stage/ImageStage";
import { useScreenPx } from "./stage/useScreenPx";
import { imageViewBox, type Rect } from "./stage/view";

/**
 * The shape being drawn.
 * - `point`: a position.
 * - `line`: a segment from `from` to `to`.
 * - `polyline` and `polygon`: the vertices placed so far, flat `[x0, y0, x1, y1, …]`, and
 *   the pointer as `cursor`, which the next vertex would land on. A polygon with `closing`
 *   set has the pointer on its first vertex: a click there closes it, so the first vertex is
 *   highlighted and the closing edge drawn solid.
 * - `stroke`: a brush trail, the flat `points` swept by a round brush of `width` image pixels
 *   (never thinner than 1 screen pixel), as a translucent filled band without dashes.
 * - `brush`: a brush footprint cursor, a circle of `diameter` image pixels centred on `x`, `y`.
 * - `rect` and `ellipse`: two opposite corners of the axis-aligned box (the drag's start and
 *   the pointer).
 */
export type DraftShapeSpec =
  | { kind: "point"; x: number; y: number }
  | { kind: "line"; from: Point; to: Point }
  | { kind: "polyline"; points: ArrayLike<number>; cursor?: Point | undefined }
  | { kind: "polygon"; points: ArrayLike<number>; cursor?: Point | undefined; closing?: boolean | undefined }
  | { kind: "stroke"; points: ArrayLike<number>; width: number }
  | { kind: "brush"; x: number; y: number; diameter: number }
  | { kind: "rect"; from: Point; to: Point }
  | { kind: "ellipse"; from: Point; to: Point };

/** Props of `DraftShape`. */
export interface DraftShapeProps {
  /** The shape so far, or `null` when nothing is being drawn. */
  shape: DraftShapeSpec | null;
  /** The overlay role it is drawn in. Defaults to `"selection"`, the accent. */
  role?: OverlayRole | undefined;
  /** A CSS colour that overrides `role`, for example `"var(--defect)"` for an eraser. */
  stroke?: string | undefined;
  /** Draw the dark band under the outline. On by default. */
  halo?: boolean | undefined;
}

const HALO = overlayRole("halo");
/** Dash, gap, outline width and vertex dot size, in screen pixels. */
const DASH = 6;
const GAP = 4;
const STROKE_PX = 1.5;
const VERTEX_PX = 6;

/**
 * A dashed preview of a shape being drawn, inside an `ImageStage`.
 *
 * The outline is 1.5 screen px, dashed 6 4 screen px, in the accent (`selection`) role by
 * default, with a halo; regions (`polygon`, `rect`, `ellipse`) carry the 12 % fill. A polyline
 * or polygon shows its placed vertices as dots and a segment on to the pointer; a polygon also
 * shows, fainter, the segment that would close it; with `closing` the first vertex gets a
 * ring and that segment turns solid and full strength: "click here to close". A `stroke`
 * (brush trail) is a translucent band of its own width with round caps and joins and no
 * dashes, and a `brush` is a footprint ring: a dark ring under a light one, so it reads on
 * any image. `points` may be a typed-array view that changes identity every move: the draft
 * is rebuilt in one O(n) pass per render, with no per-vertex elements. It takes no pointer events and is hidden
 * from assistive technology: it is transient feedback for a gesture.
 *
 * The SVG carries `data-draft` (the shape's kind).
 */
export function DraftShape({ shape, role = "selection", stroke, halo = true }: DraftShapeProps) {
  const stage = useStage();
  const px = useScreenPx();
  const colour = stroke ?? overlayRole(role);
  const dash = `${px(DASH)} ${px(GAP)}`;
  const width = px(STROKE_PX);
  const parts = shape ? draftParts(shape, px(1)) : null;

  return (
    <svg
      viewBox={imageViewBox(stage.image)}
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      aria-hidden
      data-draft={shape?.kind}
    >
      {parts && (
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          {parts.outline && halo && <path d={parts.outline} stroke={HALO} strokeWidth={width + px(2)} opacity={0.6} />}
          {parts.outline && parts.region && <path d={parts.outline} fill={colour} fillOpacity={0.12} stroke="none" />}
          {parts.outline && <path data-draft-outline="" d={parts.outline} stroke={colour} strokeWidth={width} strokeDasharray={dash} />}
          {parts.trail && <path data-draft-stroke="" d={parts.trail.d} stroke={colour} strokeWidth={Math.max(parts.trail.width, px(1))} opacity={0.4} />}
          {parts.footprint && halo && <path d={parts.footprint} stroke={HALO} strokeWidth={px(3.5)} opacity={0.6} />}
          {parts.footprint && <path data-draft-brush="" d={parts.footprint} stroke={colour} strokeWidth={px(1.5)} />}
          {parts.closing && <path data-draft-closing="" d={parts.closing} stroke={colour} strokeWidth={parts.armed ? width : px(1)} strokeDasharray={parts.armed ? undefined : dash} opacity={parts.armed ? 1 : 0.5} />}
          {parts.first && <path data-draft-first="" d={parts.first} stroke={colour} strokeWidth={width} fill={colour} fillOpacity={0.35} />}
          {parts.vertices && <path data-draft-vertices="" d={parts.vertices} stroke={colour} strokeWidth={px(VERTEX_PX)} />}
        </g>
      )}
    </svg>
  );
}

/** A shape as the path data of its outline, and what goes with it. */
interface DraftParts {
  /** The outline. `null` before a polyline has a vertex. */
  outline: string | null;
  /** Whether the outline encloses a region, which takes the fill. */
  region: boolean;
  /** The segment that would close a polygon, from the pointer to the first vertex. */
  closing: string | null;
  /** The placed vertices, as zero-length segments drawn with round caps. */
  vertices: string | null;
  /** Whether the closing segment is the live "click to close" cue: solid, full strength. */
  armed: boolean;
  /** The ring around the first vertex while the pointer is on it. */
  first: string | null;
  /** A brush trail: its path and the width in image pixels. */
  trail: { d: string; width: number } | null;
  /** A brush footprint circle. */
  footprint: string | null;
}

const NONE: DraftParts = { outline: null, region: false, closing: null, vertices: null, armed: false, first: null, trail: null, footprint: null };

/** An ellipse with the given centre and radii as two arcs. */
function ellipsePath(cx: number, cy: number, rx: number, ry: number): string {
  return `M${cx + rx} ${cy}a${rx} ${ry} 0 1 0 ${-2 * rx} 0a${rx} ${ry} 0 1 0 ${2 * rx} 0Z`;
}

function draftParts(shape: DraftShapeSpec, unit: number): DraftParts {
  switch (shape.kind) {
    case "point":
      return { ...NONE, outline: ellipsePath(shape.x, shape.y, 8 * unit, 8 * unit), vertices: `M${shape.x} ${shape.y}h0` };
    case "line":
      return { ...NONE, outline: `M${shape.from.x} ${shape.from.y}L${shape.to.x} ${shape.to.y}` };
    case "rect":
    case "ellipse": {
      const box = rectFromCorners(shape.from, shape.to);
      const outline =
        shape.kind === "rect"
          ? `M${box.x} ${box.y}h${box.width}v${box.height}h${-box.width}Z`
          : ellipsePath(box.x + box.width / 2, box.y + box.height / 2, box.width / 2, box.height / 2);
      return { ...NONE, outline, region: true };
    }
    case "brush":
      return { ...NONE, footprint: ellipsePath(shape.x, shape.y, Math.max(shape.diameter, 2 * unit) / 2, Math.max(shape.diameter, 2 * unit) / 2) };
    case "stroke": {
      const n = Math.floor(shape.points.length / 2);
      if (n === 0) return NONE;
      let d = "";
      for (let i = 0; i < n; i++) d += `${i === 0 ? "M" : "L"}${shape.points[2 * i]} ${shape.points[2 * i + 1]}`;
      // A single point is a zero-length segment: the round caps make it a dot.
      return { ...NONE, trail: { d: n === 1 ? `${d}h0` : d, width: shape.width } };
    }
    case "polyline":
    case "polygon": {
      const n = Math.floor(shape.points.length / 2);
      if (n === 0) return NONE;
      let outline = "";
      let vertices = "";
      for (let i = 0; i < n; i++) {
        outline += `${i === 0 ? "M" : "L"}${shape.points[2 * i]} ${shape.points[2 * i + 1]}`;
        vertices += `M${shape.points[2 * i]} ${shape.points[2 * i + 1]}h0`;
      }
      if (shape.cursor) outline += `L${shape.cursor.x} ${shape.cursor.y}`;
      const polygon = shape.kind === "polygon";
      const armed = polygon && shape.closing === true && n >= 2;
      let closing: string | null = null;
      if (armed) closing = `M${shape.points[2 * n - 2]} ${shape.points[2 * n - 1]}L${shape.points[0]} ${shape.points[1]}`;
      else if (polygon && shape.cursor) closing = `M${shape.cursor.x} ${shape.cursor.y}L${shape.points[0]} ${shape.points[1]}`;
      return {
        ...NONE,
        outline,
        region: polygon && n + (shape.cursor ? 1 : 0) >= 3,
        closing,
        vertices,
        armed,
        first: armed ? ellipsePath(shape.points[0]!, shape.points[1]!, 5 * unit, 5 * unit) : null,
      };
    }
  }
}

/** Props of `MarqueeRect`. */
export interface MarqueeRectProps {
  /** The band in image coordinates, or `null` when no band is being dragged. */
  rect: Rect | null;
  /** CSS colour of the band. Defaults to the overlay `selection` role. */
  stroke?: string | undefined;
}

/**
 * The rubber band of a multi-select, inside an `ImageStage`: the 12 % fill and a 1 screen px
 * outline in the selection colour, the same as `PolylineSet`'s own band. Feed it the box
 * between the press and the pointer from `StageSurface`, and the box to `pointsInRect`,
 * `polylinesInRect` or `areasInRect` at the release. It takes no pointer events.
 *
 * The SVG carries `data-marquee`.
 */
export function MarqueeRect({ rect, stroke = overlayRole("selection") }: MarqueeRectProps) {
  const stage = useStage();
  const px = useScreenPx();
  return (
    <svg
      viewBox={imageViewBox(stage.image)}
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      aria-hidden
      data-marquee={rect ? "" : undefined}
    >
      {rect && (
        <rect x={rect.x} y={rect.y} width={rect.width} height={rect.height} fill={stroke} fillOpacity={0.12} stroke={stroke} strokeWidth={px(1)} />
      )}
    </svg>
  );
}
