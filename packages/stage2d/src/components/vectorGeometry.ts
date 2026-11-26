/**
 * The arithmetic of a vector field overlay: magnitudes, the scale that turns data units into
 * image pixels, the path of an arrow, and the bins a colour map is quantised into.
 *
 * Everything here is pure. Vectors are a flat `[dx0, dy0, dx1, dy1, …]` array in data units
 * (a displacement in pixels, a velocity, a gradient); a vector with a non-finite component is
 * absent.
 */

/**
 * How data units become image pixels.
 * - A number is image pixels per data unit: the arrows are geometry, so they grow with the zoom
 *   like the image does.
 * - `{ length }` sizes the arrows so the `percentile` vector spans `length` screen pixels at
 *   every zoom: the field stays readable whatever the magnification.
 */
export type VectorScale =
  | number
  | {
      /** The screen length, in CSS pixels, the reference vector spans. */
      length: number;
      /** Which magnitude is the reference, in `[0, 1]`. Defaults to `1`, the longest vector. */
      percentile?: number | undefined;
    };

/**
 * The length of vector `i`, or `NaN` when it is absent.
 *
 * @param vectors - Flat `[dx0, dy0, …]`.
 * @param i - The vector's index.
 * @returns `hypot(dx, dy)`, or `NaN` for a non-finite component.
 */
export function vectorMagnitude(vectors: ArrayLike<number>, i: number): number {
  const dx = vectors[2 * i];
  const dy = vectors[2 * i + 1];
  if (dx === undefined || dy === undefined || !Number.isFinite(dx) || !Number.isFinite(dy)) return Number.NaN;
  return Math.hypot(dx, dy);
}

/**
 * The magnitudes of every vector, `NaN` for an absent one.
 *
 * @param vectors - Flat `[dx0, dy0, …]`.
 * @returns One magnitude per vector.
 */
export function vectorMagnitudes(vectors: ArrayLike<number>): Float64Array {
  const count = Math.floor(vectors.length / 2);
  const out = new Float64Array(count);
  for (let i = 0; i < count; i++) out[i] = vectorMagnitude(vectors, i);
  return out;
}

/**
 * A magnitude's rank statistic over the present vectors.
 *
 * @param magnitudes - As `vectorMagnitudes` returns them; `NaN` entries are ignored.
 * @param p - The fraction in `[0, 1]` (clamped): `1` is the longest, `0.5` the median.
 * @returns The nearest-rank value, or `0` when no vector is present.
 */
export function magnitudePercentile(magnitudes: ArrayLike<number>, p: number): number {
  const live: number[] = [];
  for (let i = 0; i < magnitudes.length; i++) {
    const m = magnitudes[i]!;
    if (Number.isFinite(m)) live.push(m);
  }
  if (live.length === 0) return 0;
  live.sort((a, b) => a - b);
  const q = Number.isFinite(p) ? Math.min(1, Math.max(0, p)) : 1;
  return live[Math.max(0, Math.ceil(q * live.length) - 1)]!;
}

/**
 * The scale in image pixels per data unit.
 *
 * @param scale - See `VectorScale`.
 * @param referenceMagnitude - The reference vector's length in data units, for an automatic scale.
 * @param imagePerScreenPx - Image pixels covered by one screen pixel at the current zoom.
 * @returns Image pixels per data unit; `0` when an automatic scale has no vector to measure.
 */
export function imagePerUnit(scale: VectorScale, referenceMagnitude: number, imagePerScreenPx: number): number {
  if (typeof scale === "number") return Number.isFinite(scale) && scale > 0 ? scale : 0;
  if (!(referenceMagnitude > 0) || !(scale.length > 0)) return 0;
  return (scale.length * imagePerScreenPx) / referenceMagnitude;
}

/**
 * A round length for a key: the largest of 1, 2 and 5 times a power of ten that is at most `max`.
 *
 * @param max - The upper bound, in data units.
 * @returns The round length, or `0` for a non-positive `max`.
 */
export function niceLength(max: number): number {
  if (!(max > 0) || !Number.isFinite(max)) return 0;
  const power = 10 ** Math.floor(Math.log10(max));
  for (const m of [5, 2, 1]) if (m * power <= max * (1 + 1e-12)) return m * power;
  return power;
}

/** The shape of an arrow, in screen pixels. */
export interface ArrowStyle {
  /** The arrowhead's length. */
  head: number;
  /** The arrowhead's full width, as a fraction of its length. */
  headWidth: number;
  /** A vector shorter than this is not drawn. */
  minLength: number;
}

const r = (v: number): string => String(Math.round(v * 1000) / 1000);

/**
 * The path data of one arrow: a shaft and a filled head.
 *
 * The head is capped at 45 % of the arrow's length, so a short arrow is a small wedge rather
 * than a head on no shaft. Lengths are in the units of `(x, y)` (image pixels); `unit` converts
 * the style's screen pixels to them.
 *
 * @param x - The anchor's x.
 * @param y - The anchor's y.
 * @param dx - The displacement's x, already scaled to image pixels.
 * @param dy - The displacement's y, already scaled to image pixels.
 * @param unit - Image pixels per screen pixel.
 * @param style - The arrow's shape.
 * @returns Path data, or `""` when the arrow is absent or shorter than `style.minLength`.
 */
export function arrowPath(x: number, y: number, dx: number, dy: number, unit: number, style: ArrowStyle): string {
  const len = Math.hypot(dx, dy);
  if (!(len > 0) || len < style.minLength * unit) return "";
  const ux = dx / len;
  const uy = dy / len;
  const head = Math.min(style.head * unit, 0.45 * len);
  const half = (head * style.headWidth) / 2;
  const tx = x + dx;
  const ty = y + dy;
  const bx = tx - ux * head;
  const by = ty - uy * head;
  return (
    `M${r(x)} ${r(y)}L${r(bx)} ${r(by)}` +
    `M${r(tx)} ${r(ty)}L${r(bx - uy * half)} ${r(by + ux * half)}L${r(bx + uy * half)} ${r(by - ux * half)}Z`
  );
}

/** The number of colour steps a magnitude-coloured field is quantised into: one path each. */
export const VECTOR_COLOR_BINS = 24;

/**
 * The colour bin of a magnitude.
 *
 * @param magnitude - The vector's length.
 * @param low - The magnitude drawn in the map's first colour.
 * @param high - The magnitude drawn in the map's last colour.
 * @param bins - The number of bins. Defaults to `VECTOR_COLOR_BINS`.
 * @returns An integer in `[0, bins - 1]`; a degenerate range puts everything in bin `0`.
 */
export function colorBin(magnitude: number, low: number, high: number, bins = VECTOR_COLOR_BINS): number {
  if (!(high > low)) return 0;
  const t = (magnitude - low) / (high - low);
  return Math.min(bins - 1, Math.max(0, Math.floor(t * bins)));
}
