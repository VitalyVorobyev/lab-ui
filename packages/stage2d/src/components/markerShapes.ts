/**
 * Marker glyphs for `PointSet`: one path generator per feature kind (overlay grammar,
 * `docs/visual-language.md` §5).
 *
 * A glyph is a function from a position to SVG path data, so a layer can append thousands of
 * them into one `<path>` per state and style. Sizes are screen pixels: a generator receives
 * `unit`, the image pixels per screen pixel (`useScreenPx()(1)`), and scales its constants by
 * it. A glyph whose `paint` is `"disc"` needs no `unit` at all (it is a zero-length segment
 * drawn with round caps, its size the stroke width), so it is not rebuilt when the zoom
 * changes.
 *
 * Pure: no React, no DOM.
 */

import type { OverlayRole } from "./overlayRole";

/** One kind of marker. */
export interface MarkerShape {
  /**
   * How the path is painted:
   * - `"disc"`: `path` returns a zero-length segment per marker; the stroke width is the
   *   disc's diameter. Independent of `unit`, so a batched path survives a zoom unchanged.
   * - `"line"`: `path` returns an outline, stroked at the state's width.
   */
  readonly paint: "disc" | "line";
  /** Half the glyph's extent in screen pixels at rest: a disc's radius, a plus's arm. */
  readonly size: number;
  /** The role a marker of this kind has unless the item says otherwise. Defaults to `feature`. */
  readonly role?: OverlayRole | undefined;
  /**
   * The path data for one marker.
   *
   * @param x - Centre x, in image coordinates.
   * @param y - Centre y, in image coordinates.
   * @param unit - Image pixels per screen pixel.
   * @param angle - The item's orientation in radians, `0` when it has none.
   * @param angle2 - The item's second angle in radians, `undefined` when it has none. Most
   *   shapes ignore it; a glyph with two axes (a corner's two edge directions) reads it.
   * @returns Path commands, absolute at the start (`M x y …`) and self-contained.
   */
  path: (x: number, y: number, unit: number, angle: number, angle2?: number) => string;
}

/** Round to 1/1000 of an image pixel: enough for any zoom, and half the characters. */
function n(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * A circle as two arcs, centred at `(x, y)`.
 *
 * @param x - Centre x.
 * @param y - Centre y.
 * @param r - Radius, in the units of `x` and `y`.
 * @returns Path data.
 */
export function circlePath(x: number, y: number, r: number): string {
  return `M${n(x + r)} ${n(y)}a${n(r)} ${n(r)} 0 1 0 ${n(-2 * r)} 0a${n(r)} ${n(r)} 0 1 0 ${n(2 * r)} 0`;
}

/** The names of the built-in marker kinds. */
export type BuiltinMarkerKind = "dot" | "plus" | "cross" | "square" | "hollow" | "directed";

/** The built-in kinds, with the overlay grammar's glyph for each. */
export const MARKER_SHAPES: Readonly<Record<BuiltinMarkerKind, MarkerShape>> = {
  /** A blob, circle centre or keypoint: a dot of radius 2.5 px. */
  dot: {
    paint: "disc",
    size: 2.5,
    path: (x, y) => `M${n(x)} ${n(y)}h0`,
  },
  /** A corner or X-junction: a plus with 5 px arms, so the centre stays visible. */
  plus: {
    paint: "line",
    size: 5,
    path: (x, y, u) => {
      const a = 5 * u;
      return `M${n(x - a)} ${n(y)}h${n(2 * a)}M${n(x)} ${n(y - a)}v${n(2 * a)}`;
    },
  },
  /** A diagonal cross with 4 px arms: a second corner style, or "rejected". */
  cross: {
    paint: "line",
    size: 4,
    path: (x, y, u) => {
      const a = 4 * u;
      return `M${n(x - a)} ${n(y - a)}l${n(2 * a)} ${n(2 * a)}M${n(x - a)} ${n(y + a)}l${n(2 * a)} ${n(-2 * a)}`;
    },
  },
  /** A hollow square of half-side 3.5 px. */
  square: {
    paint: "line",
    size: 3.5,
    path: (x, y, u) => {
      const a = 3.5 * u;
      return `M${n(x - a)} ${n(y - a)}h${n(2 * a)}v${n(2 * a)}h${n(-2 * a)}Z`;
    },
  },
  /** A reprojected or predicted point: a hollow circle of radius 4 px, in the model colour. */
  hollow: {
    paint: "line",
    size: 4,
    role: "model",
    path: (x, y, u) => circlePath(x, y, 4 * u),
  },
  /**
   * A point with an orientation: a small ring and a tick of length 8 px from it along
   * `angle`, measured clockwise from +x in image coordinates (y points down).
   */
  directed: {
    paint: "line",
    size: 6,
    path: (x, y, u, angle) => {
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      return (
        `${circlePath(x, y, 2 * u)}M${n(x + 2 * u * c)} ${n(y + 2 * u * s)}L${n(x + 8 * u * c)} ${n(y + 8 * u * s)}`
      );
    },
  },
};
