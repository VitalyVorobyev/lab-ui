/**
 * The arithmetic behind `ScatterChart`: which point is under the pointer, which colour step a
 * value falls in, and the domain a colour scale covers.
 *
 * Pure: the component is a thin list of SVG elements over it.
 */

import { symmetricDomain } from "./colormap";

/** The number of colour steps a value-coloured series is quantised into: one path each. */
export const SCATTER_COLOUR_STEPS = 24;

/**
 * The projected point nearest to a position, within a radius.
 *
 * @param xy - Flat `[x0, y0, x1, y1, …]` in the plot's own units (viewBox units); a non-finite
 *   coordinate is skipped.
 * @param x - The query's x.
 * @param y - The query's y.
 * @param radius - How far from a point the query still picks it.
 * @returns The index of the nearest point (the lower index on a tie), or `-1`.
 */
export function nearestProjected(xy: ArrayLike<number>, x: number, y: number, radius: number): number {
  const limit = radius * radius;
  let best = -1;
  let bestD = Infinity;
  const count = Math.floor(xy.length / 2);
  for (let i = 0; i < count; i++) {
    const dx = xy[2 * i]! - x;
    const dy = xy[2 * i + 1]! - y;
    const d = dx * dx + dy * dy;
    if (d <= limit && d < bestD) {
      best = i;
      bestD = d;
    }
  }
  return best;
}

/**
 * The colour step of a value.
 *
 * @param value - The point's value.
 * @param domain - `[low, high]`: `low` maps to the first step.
 * @param steps - How many steps. Defaults to `SCATTER_COLOUR_STEPS`.
 * @returns An integer in `[0, steps - 1]`; `-1` for a non-finite value; a degenerate domain puts
 *   every value in step `0`.
 */
export function colourStep(value: number, domain: readonly [number, number], steps = SCATTER_COLOUR_STEPS): number {
  if (!Number.isFinite(value)) return -1;
  const [low, high] = domain;
  if (!(high > low)) return 0;
  return Math.min(steps - 1, Math.max(0, Math.floor(((value - low) / (high - low)) * steps)));
}

/**
 * The domain a value colouring covers.
 *
 * @param values - Every point's value; non-finite ones are ignored.
 * @param symmetric - Centre it on zero, for a diverging map.
 * @param given - A domain the caller fixed. It wins, centred if `symmetric`.
 * @returns `[low, high]`; `[0, 1]` when there is no finite value.
 */
export function colourDomain(values: Iterable<number>, symmetric: boolean, given?: readonly [number, number]): [number, number] {
  let low = Infinity;
  let high = -Infinity;
  if (given) [low, high] = given;
  else {
    for (const v of values) {
      if (!Number.isFinite(v)) continue;
      if (v < low) low = v;
      if (v > high) high = v;
    }
    if (low > high) return symmetric ? [-1, 1] : [0, 1];
  }
  return symmetric ? symmetricDomain([low, high]) : [low, high];
}
