/**
 * The arithmetic behind `MeasureOverlay`: everything that can be silently wrong, factored
 * out so it can be tested without a DOM.
 *
 * Every primitive `MeasureOverlay` draws is given in **source-image pixel coordinates** —
 * the same frame `ZoomPanCanvas`'s `nativeWidth`/`nativeHeight` describe, and the same one
 * `api/mapValues.ts`'s `u`/`v` fractions index into. Nothing here measures the DOM or knows
 * about zoom directly; `strokeWidthFor` is the one function that turns a *scale factor* a
 * caller already knows (or computes once from a `ZoomPanCanvas` `View`) into a stroke width
 * that reads as constant on screen.
 */

export interface Point {
  x: number;
  y: number;
}

/**
 * The on-screen-constant stroke width for a shape drawn in native-pixel units.
 *
 * `MeasureOverlay` is rendered as an SVG whose `viewBox` is the native image size, sitting
 * inside `ZoomPanCanvas`'s own `scale(zoom)` transform. A stroke declared as `1` in that
 * SVG's user units is `1` *native pixel*, which is `strokeScale` screen pixels once both
 * transforms are applied (`strokeScale` = the SVG's own fit ratio × the canvas zoom, or
 * just the zoom when the overlay is already at native resolution). Dividing by it is what
 * keeps a 1px caliper edge looking like 1px at any zoom, rather than growing with it the
 * way a shape's own geometry does.
 *
 * `vector-effect="non-scaling-stroke"` addresses only the SVG's *internal* transforms and
 * is inconsistently applied across browsers once a CSS transform sits above the `<svg>`
 * itself (exactly the situation inside `ZoomPanCanvas`), so this is computed explicitly
 * rather than left to the renderer.
 */
export function strokeWidthFor(strokeScale: number, screenPixels = 1): number {
  if (!Number.isFinite(strokeScale) || strokeScale <= 0) return screenPixels;
  return screenPixels / strokeScale;
}

/** Rotate `(x, y)` about the origin by `angle` radians. */
export function rotatePoint(x: number, y: number, angle: number): Point {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: x * c - y * s, y: x * s + y * c };
}

/** `M x,y L x,y … Z` through `points`, or `""` for fewer than two of them. */
export function polygonPath(points: readonly Point[]): string {
  if (points.length < 2) return "";
  const [first, ...rest] = points;
  const p0 = first as Point;
  const commands = [`M${p0.x.toFixed(2)} ${p0.y.toFixed(2)}`];
  for (const point of rest) commands.push(`L${point.x.toFixed(2)} ${point.y.toFixed(2)}`);
  commands.push("Z");
  return commands.join(" ");
}

/** The two line segments of a cross mark centred on `(x, y)`, each `2·size` long. */
export function crossSegments(x: number, y: number, size: number): [[Point, Point], [Point, Point]] {
  return [
    [{ x: x - size, y }, { x: x + size, y }],
    [{ x, y: y - size }, { x, y: y + size }],
  ];
}

/**
 * The angular sweep from `startAngle` to `endAngle`, going forward.
 *
 * Two angles alone cannot distinguish "no sweep at all" from "swept exactly one full turn"
 * — both have `endAngle - startAngle ≡ 0 (mod 2π)`. The raw (un-normalized) difference is
 * what carries that distinction: genuinely equal angles have a raw difference near zero,
 * while a caller asking for a full circle passes a raw difference of `2π` (or a multiple of
 * it). So only a raw difference near zero is treated as "nothing to draw"; every other
 * multiple of a full turn normalizes to `2π` itself rather than collapsing to `0`.
 */
function sweepAngle(startAngle: number, endAngle: number): number {
  const turn = Math.PI * 2;
  const EPSILON = 1e-9;
  const raw = endAngle - startAngle;
  if (Math.abs(raw) < EPSILON) return 0;
  const delta = raw % turn;
  return delta <= EPSILON ? delta + turn : delta;
}

/**
 * An SVG arc path centred at `(cx, cy)` with radius `r`, sweeping forward from `startAngle`
 * to `endAngle` (radians, standard `x = cx + r·cos(a)`, `y = cy + r·sin(a)` convention —
 * clockwise on screen, since image-pixel `y` increases downward).
 *
 * A single SVG `A` command cannot express a full circle (its start and end point coincide,
 * which most renderers treat as a zero-length arc), so a sweep that reaches all the way
 * around is split into two half-circle arcs instead.
 */
export function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  if (!(r > 0)) return "";

  const start = { x: cx + r * Math.cos(startAngle), y: cy + r * Math.sin(startAngle) };
  const sweep = sweepAngle(startAngle, endAngle);
  const FULL_TURN_EPSILON = 1e-9;

  if (sweep < FULL_TURN_EPSILON) {
    // A zero (or effectively zero) sweep is a point, not an arc.
    return "";
  }
  if (sweep >= Math.PI * 2 - FULL_TURN_EPSILON) {
    const mid = { x: cx + r * Math.cos(startAngle + Math.PI), y: cy + r * Math.sin(startAngle + Math.PI) };
    return (
      `M${start.x.toFixed(2)} ${start.y.toFixed(2)} ` +
      `A${r.toFixed(2)} ${r.toFixed(2)} 0 1 1 ${mid.x.toFixed(2)} ${mid.y.toFixed(2)} ` +
      `A${r.toFixed(2)} ${r.toFixed(2)} 0 1 1 ${start.x.toFixed(2)} ${start.y.toFixed(2)}`
    );
  }

  const end = { x: cx + r * Math.cos(endAngle), y: cy + r * Math.sin(endAngle) };
  const largeArc = sweep > Math.PI ? 1 : 0;
  return (
    `M${start.x.toFixed(2)} ${start.y.toFixed(2)} ` +
    `A${r.toFixed(2)} ${r.toFixed(2)} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`
  );
}

/**
 * The four corners of a caliper box: a rectangle `width` (along its own measurement axis)
 * by `height`, centred at `(cx, cy)` and rotated by `angle` radians. Corner order is
 * suitable for `polygonPath` — around the box, not crossed.
 */
export function caliperCorners(
  cx: number,
  cy: number,
  width: number,
  height: number,
  angle: number,
): [Point, Point, Point, Point] {
  const hw = width / 2;
  const hh = height / 2;
  const local: [number, number][] = [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ];
  const [a, b, c, d] = local.map(([lx, ly]) => {
    const r = rotatePoint(lx, ly, angle);
    return { x: cx + r.x, y: cy + r.y };
  });
  return [a as Point, b as Point, c as Point, d as Point];
}

/**
 * The direction arrow for a caliper box: from its centre to just past its `+local-x` edge,
 * along the box's own measurement axis. What the arrow points at is the scan direction the
 * caliper was evaluated in, not merely a decoration on the box.
 */
export function caliperArrow(
  cx: number,
  cy: number,
  width: number,
  angle: number,
): { from: Point; to: Point } {
  const reach = width / 2 + Math.max(4, width * 0.2);
  const tip = rotatePoint(reach, 0, angle);
  return { from: { x: cx, y: cy }, to: { x: cx + tip.x, y: cy + tip.y } };
}

/**
 * A small open chevron at `tip`, pointing along `angle` (radians), for a caliper's
 * direction arrow. Three points — left-back, tip, right-back — meant for an unfilled
 * `<polyline>`, which keeps the arrowhead's colour exactly the stroke colour of the line it
 * caps without the fill-vs-stroke bookkeeping a filled triangle would need per tone.
 */
export function arrowHeadPoints(tip: Point, angle: number, size: number): [Point, Point, Point] {
  const back = size * 1.6;
  const spread = size;
  const left = rotatePoint(-back, spread, angle);
  const right = rotatePoint(-back, -spread, angle);
  return [
    { x: tip.x + left.x, y: tip.y + left.y },
    tip,
    { x: tip.x + right.x, y: tip.y + right.y },
  ];
}

export interface DimensionGeometry {
  /** From the first measured point out to the dimension line. */
  extensionLine1: [Point, Point];
  /** From the second measured point out to the dimension line. */
  extensionLine2: [Point, Point];
  /** The offset line spanning the measured distance, parallel to the measured segment. */
  dimensionLine: [Point, Point];
  /** Midpoint of the dimension line — where the label sits. */
  labelAnchor: Point;
  /** The dimension line's own direction, in degrees, for an upright label rotation. */
  angleDegrees: number;
}

/**
 * The leader geometry for a dimension annotation between two measured points, offset by
 * `offset` native pixels to the line's left (so a positive offset with a left-to-right
 * measurement draws the dimension line above it, consistent with `y` increasing downward).
 *
 * Degenerate input (`x1 === x2 && y1 === y2`) falls back to an arbitrary rightward normal
 * rather than dividing by zero, so a caller need not special-case a zero-length dimension.
 */
export function dimensionGeometry(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  offset: number,
): DimensionGeometry {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy);
  const [ux, uy] = length > 1e-9 ? [dx / length, dy / length] : [1, 0];
  // The left-hand normal of the measured direction in a y-down frame: for a rightward
  // measurement (u = (1, 0)) this is (0, -1), i.e. "up" on screen, which is what makes a
  // positive offset draw the dimension line above a left-to-right span rather than below.
  const nx = uy;
  const ny = -ux;

  const p1: Point = { x: x1 + nx * offset, y: y1 + ny * offset };
  const p2: Point = { x: x2 + nx * offset, y: y2 + ny * offset };

  return {
    extensionLine1: [{ x: x1, y: y1 }, p1],
    extensionLine2: [{ x: x2, y: y2 }, p2],
    dimensionLine: [p1, p2],
    labelAnchor: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 },
    angleDegrees: (Math.atan2(dy, dx) * 180) / Math.PI,
  };
}
