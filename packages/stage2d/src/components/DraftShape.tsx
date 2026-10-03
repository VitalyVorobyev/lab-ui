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
 *   the pointer as `cursor`, which the next vertex would land on.
 * - `rect` and `ellipse`: two opposite corners of the axis-aligned box (the drag's start and
 *   the pointer).
 */
export type DraftShapeSpec =
  | { kind: "point"; x: number; y: number }
  | { kind: "line"; from: Point; to: Point }
  | { kind: "polyline"; points: ArrayLike<number>; cursor?: Point | undefined }
  | { kind: "polygon"; points: ArrayLike<number>; cursor?: Point | undefined }
  | { kind: "rect"; from: Point; to: Point }
  | { kind: "ellipse"; from: Point; to: Point };

/** Props of `DraftShape`. */
export interface DraftShapeProps {
  /** The shape so far, or `null` when nothing is being drawn. */
  shape: DraftShapeSpec | null;
  /** The overlay role it is drawn in. Defaults to `"selection"`, the accent. */
  role?: OverlayRole | undefined;
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
 * shows, fainter, the segment that would close it. It takes no pointer events and is hidden
 * from assistive technology: it is transient feedback for a gesture.
 *
 * The SVG carries `data-draft` (the shape's kind).
 */
export function DraftShape({ shape, role = "selection", halo = true }: DraftShapeProps) {
  const stage = useStage();
  const px = useScreenPx();
  const colour = overlayRole(role);
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
          {parts.closing && <path data-draft-closing="" d={parts.closing} stroke={colour} strokeWidth={px(1)} strokeDasharray={dash} opacity={0.5} />}
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
}

/** An ellipse with the given centre and radii as two arcs. */
function ellipsePath(cx: number, cy: number, rx: number, ry: number): string {
  return `M${cx + rx} ${cy}a${rx} ${ry} 0 1 0 ${-2 * rx} 0a${rx} ${ry} 0 1 0 ${2 * rx} 0Z`;
}

function draftParts(shape: DraftShapeSpec, unit: number): DraftParts {
  switch (shape.kind) {
    case "point":
      return { outline: ellipsePath(shape.x, shape.y, 8 * unit, 8 * unit), region: false, closing: null, vertices: `M${shape.x} ${shape.y}h0` };
    case "line":
      return { outline: `M${shape.from.x} ${shape.from.y}L${shape.to.x} ${shape.to.y}`, region: false, closing: null, vertices: null };
    case "rect":
    case "ellipse": {
      const box = rectFromCorners(shape.from, shape.to);
      const outline =
        shape.kind === "rect"
          ? `M${box.x} ${box.y}h${box.width}v${box.height}h${-box.width}Z`
          : ellipsePath(box.x + box.width / 2, box.y + box.height / 2, box.width / 2, box.height / 2);
      return { outline, region: true, closing: null, vertices: null };
    }
    case "polyline":
    case "polygon": {
      const n = Math.floor(shape.points.length / 2);
      if (n === 0) return { outline: null, region: false, closing: null, vertices: null };
      let outline = "";
      let vertices = "";
      for (let i = 0; i < n; i++) {
        outline += `${i === 0 ? "M" : "L"}${shape.points[2 * i]} ${shape.points[2 * i + 1]}`;
        vertices += `M${shape.points[2 * i]} ${shape.points[2 * i + 1]}h0`;
      }
      if (shape.cursor) outline += `L${shape.cursor.x} ${shape.cursor.y}`;
      const polygon = shape.kind === "polygon";
      return {
        outline,
        region: polygon && n + (shape.cursor ? 1 : 0) >= 3,
        closing: polygon && shape.cursor ? `M${shape.cursor.x} ${shape.cursor.y}L${shape.points[0]} ${shape.points[1]}` : null,
        vertices,
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
