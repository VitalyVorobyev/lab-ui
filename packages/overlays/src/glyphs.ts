/**
 * The glyphs of a calibration-target overlay, as path generators.
 *
 * A glyph is a `MarkerShape` for `@vitavision/stage2d`'s `PointSet`: a pure function from a
 * position to SVG path data, so a layer appends thousands of them into one `<path>` (ADR-0004).
 * They are registered under the names in `TARGET_MARKERS`, which `TargetOverlay` passes as
 * `markers`. Sizes are screen pixels, from `unit` (image pixels per screen pixel).
 *
 * `MarkerShape.path` receives one number per item, `angle`. A corner with two edge directions
 * needs two, so `packAxes` folds both into that one number (see below); that is the only reason
 * the packing exists.
 *
 * Pure: no React, no DOM.
 */

import { circlePath, type MarkerShape } from "@vitavision/stage2d";

/** Round to 1/1000 of an image pixel. */
function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** Quantisation steps per half turn when two axes share one number: 2²⁶, so about 4.7e-8 rad. */
const STEPS = 2 ** 26;
/** Packed values start here; a plain angle (normalised to [0, π)) is always below it. */
const PACKED_FLOOR = 8;

/** An angle as a direction of a line: modulo π, in [0, π). */
function lineAngle(angle: number): number {
  const wrapped = angle % Math.PI;
  return wrapped < 0 ? wrapped + Math.PI : wrapped;
}

/**
 * Fold one or two edge directions into the single `angle` number a `MarkerShape` receives.
 *
 * Directions are lines (`θ` and `θ + π` are the same line), so each is taken modulo π. With one
 * direction the result is that angle in [0, π). With two they are quantised to 2⁻²⁶ of a half
 * turn (4.7e-8 rad, under a millionth of a screen pixel on a 10 px glyph) and packed into one
 * integer-valued double above 8, which stays exact because it is below 2⁵³. `unpackAxes` is the
 * inverse.
 *
 * @param angle - The first direction, radians.
 * @param angle2 - The second direction, radians. Optional.
 * @returns A number to put in `PointSetItem.angle` for the `directed` marker.
 */
export function packAxes(angle: number, angle2?: number): number {
  if (angle2 === undefined) return lineAngle(angle);
  const q = (a: number) => Math.round((lineAngle(a) / Math.PI) * STEPS) % STEPS;
  return PACKED_FLOOR + q(angle) * STEPS + q(angle2);
}

/**
 * The directions folded into `angle` by `packAxes`.
 *
 * @param packed - A value from `packAxes`, or a plain angle in radians.
 * @returns One direction for a plain angle, two for a packed value; each in [0, π).
 */
export function unpackAxes(packed: number): number[] {
  if (!Number.isFinite(packed)) return [];
  if (packed < PACKED_FLOOR) return [lineAngle(packed)];
  const rest = packed - PACKED_FLOOR;
  const first = Math.floor(rest / STEPS);
  return [(first / STEPS) * Math.PI, ((rest - first * STEPS) / STEPS) * Math.PI];
}

/** Half-length of a directed corner's axes, and the gap left at its centre, in screen pixels. */
const AXIS_REACH = 8;
const AXIS_GAP = 2;

/**
 * A corner with its edge directions: one or two lines through the point, 8 px each way with a
 * 2 px gap at the centre, so the corner itself stays visible. Give it `angle: packAxes(a, b)`.
 */
const directed: MarkerShape = {
  paint: "line",
  size: AXIS_REACH,
  path: (x, y, unit, packed) => {
    let d = "";
    for (const angle of unpackAxes(packed)) {
      const c = Math.cos(angle);
      const s = Math.sin(angle);
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
  /** Edge directions of a corner; see `packAxes`. */
  directed,
  /** A white matched circle. */
  "circle-white": circleWhite,
  /** A black matched circle. */
  "circle-black": circleBlack,
} as const satisfies Readonly<Record<string, MarkerShape>>;

/**
 * An ellipse as two arcs, exactly: no polygon approximation, so it stays round at any zoom.
 *
 * @param cx - Centre x, image pixels.
 * @param cy - Centre y, image pixels.
 * @param rx - Semi-axis along the rotated x axis, image pixels.
 * @param ry - Semi-axis along the rotated y axis, image pixels.
 * @param angle - Rotation of the `rx` axis, radians clockwise on screen.
 * @returns Path data, or `""` for a degenerate ellipse (a non-finite value, or a radius not above zero).
 */
export function ellipsePath(cx: number, cy: number, rx: number, ry: number, angle = 0): string {
  if (!(rx > 0) || !(ry > 0) || !Number.isFinite(cx + cy + rx + ry + angle)) return "";
  const dx = rx * Math.cos(angle);
  const dy = rx * Math.sin(angle);
  const degrees = round((angle * 180) / Math.PI);
  const arc = `A${round(rx)} ${round(ry)} ${degrees} 1 0`;
  return `M${round(cx + dx)} ${round(cy + dy)}${arc} ${round(cx - dx)} ${round(cy - dy)}${arc} ${round(cx + dx)} ${round(cy + dy)}`;
}
