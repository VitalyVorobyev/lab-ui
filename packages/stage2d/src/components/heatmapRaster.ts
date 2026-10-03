/**
 * Scalar field to pixels: the colourising step of `HeatmapLayer`, pure so the cases that bite
 * (NaN holes, a flat field, a value outside the range) are tested without a canvas.
 */

import type { ValuePlane } from "../api/mapValues";

/**
 * A sequential colour map: a position in `[0, 1]` to an `[r, g, b]` colour, each channel
 * 0 to 255. `@vitavision/charts`' `colormapRgb(name, t)` is one: `(t) => colormapRgb("viridis", t)`.
 */
export type Colormap = (t: number) => readonly [number, number, number];

/** A range of values mapped onto the colour map: `low` to its start, `high` to its end. */
export interface ValueRange {
  /** The value drawn in the map's first colour. */
  low: number;
  /** The value drawn in the map's last colour. */
  high: number;
}

/** How many steps the colour map is sampled at: one per 8-bit level, so no pixel is off by a visible amount. */
const STEPS = 256;

/**
 * The extent of a plane's finite values.
 *
 * @param plane - The plane.
 * @param channel - Which of its channels. Defaults to the first.
 * @returns `{ low, high }`, or `null` when the channel is missing or has no finite value.
 */
export function planeRange(plane: ValuePlane, channel = 0): ValueRange | null {
  if (!(channel >= 0 && channel < plane.channels)) return null;
  const size = plane.width * plane.height;
  const offset = channel * size;
  let low = Infinity;
  let high = -Infinity;
  for (let k = 0; k < size; k++) {
    const v = plane.values[offset + k]!;
    if (!Number.isFinite(v)) continue;
    if (v < low) low = v;
    if (v > high) high = v;
  }
  return low <= high ? { low, high } : null;
}

/**
 * Colour a plane through a colour map.
 *
 * Opaque where the value is finite; transparent where it is `NaN` or infinite (an uncovered
 * pixel, as in `valueAt`). Values outside `range` take the map's end colours. A flat range
 * (`high <= low`) draws every pixel in the map's first colour.
 *
 * @param plane - The plane.
 * @param colormap - The colour map; sampled at 256 positions.
 * @param range - What the map spans. Defaults to the extent of the channel's finite values.
 * @param channel - Which channel to draw. Defaults to the first.
 * @returns `width · height` RGBA pixels, row-major; all transparent for a missing channel.
 */
export function rasterizePlane(plane: ValuePlane, colormap: Colormap, range?: ValueRange, channel = 0): Uint8ClampedArray {
  const size = plane.width * plane.height;
  const out = new Uint8ClampedArray(size * 4);
  if (!(channel >= 0 && channel < plane.channels)) return out;
  const { low, high } = range ?? planeRange(plane, channel) ?? { low: 0, high: 0 };
  const lut = new Uint8ClampedArray(STEPS * 3);
  for (let s = 0; s < STEPS; s++) {
    const [r, g, b] = colormap(s / (STEPS - 1));
    lut[3 * s] = r;
    lut[3 * s + 1] = g;
    lut[3 * s + 2] = b;
  }
  const scale = high > low ? (STEPS - 1) / (high - low) : 0;
  const offset = channel * size;
  for (let k = 0; k < size; k++) {
    const v = plane.values[offset + k]!;
    if (!Number.isFinite(v)) continue;
    const s = Math.min(STEPS - 1, Math.max(0, Math.round((v - low) * scale)));
    out[4 * k] = lut[3 * s]!;
    out[4 * k + 1] = lut[3 * s + 1]!;
    out[4 * k + 2] = lut[3 * s + 2]!;
    out[4 * k + 3] = 255;
  }
  return out;
}
