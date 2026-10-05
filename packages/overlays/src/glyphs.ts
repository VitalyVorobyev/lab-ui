/**
 * The glyphs of a calibration-target overlay, as path generators.
 *
 * A glyph is a `MarkerShape` for `@vitavision/stage2d`'s `PointSet`: a pure function from a
 * position to SVG path data, so a layer appends thousands of them into one `<path>`.
 * They are registered under the names in `TARGET_MARKERS`, which `TargetOverlay` passes as
 * `markers`. Sizes are screen pixels, from `unit` (image pixels per screen pixel).
 *
 * Pure: no React, no DOM.
 */

import { circlePath, type MarkerShape } from "@vitavision/stage2d";

/** Round to 1/1000 of an image pixel. */
function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** An angle as a direction of a line: modulo π, in [0, π). */
function lineAngle(angle: number): number {
  const wrapped = angle % Math.PI;
  return wrapped < 0 ? wrapped + Math.PI : wrapped;
}

/** Half-length of a directed corner's axes, and the gap left at its centre, in screen pixels. */
const AXIS_REACH = 8;
const AXIS_GAP = 2;

/**
 * A corner with its edge directions: one or two lines through the point, 8 px each way with a
 * 2 px gap at the centre, so the corner itself stays visible. Give it `angle` and, for the
 * second direction, `angle2`. Directions are lines, so each is read modulo π.
 */
const directed: MarkerShape = {
  paint: "line",
  size: AXIS_REACH,
  path: (x, y, unit, angle, angle2) => {
    let d = "";
    for (const direction of angle2 === undefined ? [angle] : [angle, angle2]) {
      if (!Number.isFinite(direction)) continue;
      const line = lineAngle(direction);
      const c = Math.cos(line);
      const s = Math.sin(line);
      const near = AXIS_GAP * unit;
      const far = AXIS_REACH * unit;
      d +=
        `M${round(x - far * c)} ${round(y - far * s)}L${round(x - near * c)} ${round(y - near * s)}` +
        `M${round(x + near * c)} ${round(y + near * s)}L${round(x + far * c)} ${round(y + far * s)}`;
    }
    return d;
  },
};

/** Radius of a matched circle's glyph, screen pixels. */
const CIRCLE_RADIUS = 5.5;
/** Radius of the centre mark of a black circle, screen pixels; stroked, it reads as a filled dot. */
const CENTRE_RADIUS = 0.8;

/** A white circle of a marker board: a hollow ring of radius 5.5 px. */
const circleWhite: MarkerShape = {
  paint: "line",
  size: CIRCLE_RADIUS,
  path: (x, y, unit) => circlePath(x, y, CIRCLE_RADIUS * unit),
};

/** A black circle: the same ring with a dot at its centre, so polarity is a shape and not a colour. */
const circleBlack: MarkerShape = {
  paint: "line",
  size: CIRCLE_RADIUS,
  path: (x, y, unit) => circlePath(x, y, CIRCLE_RADIUS * unit) + circlePath(x, y, CENTRE_RADIUS * unit),
};

/** The marker names `TargetOverlay` uses, to pass to `PointSet`'s `markers`. */
export const TARGET_MARKERS = {
  /** Edge directions of a corner, from `angle` and `angle2`. */
  directed,
  /** A white matched circle. */
  "circle-white": circleWhite,
  /** A black matched circle. */
  "circle-black": circleBlack,
} as const satisfies Readonly<Record<string, MarkerShape>>;
