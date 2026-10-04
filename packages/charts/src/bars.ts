/**
 * The pure core of the histogram charts: binning, bin lookup and the one path that draws
 * every bar. Nothing here touches React or the DOM.
 */

import type { PlotArea } from "./interaction";
import type { Scale } from "./scale";
import { extent, padDomain } from "./scale";

/** Bins used when the caller does not say. */
export const DEFAULT_BINS = 32;

/** A histogram as the chart draws it: counts over equal-width bins spanning `domain`. */
export interface BinnedData {
  /** One non-negative finite count per bin, left to right. */
  counts: number[];
  /** The x range the bins span, never degenerate (`low < high`). */
  domain: [number, number];
}

/** A finite, ordered, non-degenerate domain; `[0, 1]` when `domain` is unusable. */
function usableDomain(low: number, high: number): [number, number] {
  return padDomain(Math.min(low, high), Math.max(low, high));
}

/**
 * Bin raw values into `bins` equal-width buckets.
 *
 * @param values - The samples. Non-finite values are ignored, and so are values outside an
 *   explicit `domain` (the upper edge itself belongs to the last bin).
 * @param bins - Bucket count; a non-finite or sub-1 request falls back to 1, and `undefined`
 *   to {@link DEFAULT_BINS}.
 * @param domain - The x range. Omitted: the data's extent. A single distinct value is
 *   widened so it lands in a middle bin rather than on an edge.
 * @returns The counts and the domain they span.
 */
export function binValues(
  values: ArrayLike<number>,
  bins: number | undefined,
  domain?: [number, number],
): BinnedData {
  const count = bins === undefined ? DEFAULT_BINS : Number.isFinite(bins) ? Math.max(1, Math.floor(bins)) : 1;
  const finite: number[] = [];
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value !== undefined && Number.isFinite(value)) finite.push(value);
  }
  const [low, high] = domain ? usableDomain(domain[0], domain[1]) : usableDomain(...extent(finite));
  const counts = new Array<number>(count).fill(0);
  const span = high - low;
  for (const value of finite) {
    if (value < low || value > high) continue;
    const index = Math.min(count - 1, Math.floor(((value - low) / span) * count));
    counts[index] = (counts[index] ?? 0) + 1;
  }
  return { counts, domain: [low, high] };
}

/**
 * Take pre-binned counts as given, with the junk removed.
 *
 * @param counts - One count per bin, left to right.
 * @param domain - The x range the bins span.
 * @returns The counts with every non-finite or negative entry set to 0, and a usable domain.
 */
export function cleanCounts(counts: ArrayLike<number>, domain: [number, number]): BinnedData {
  const clean = Array.from(counts, (value) => (Number.isFinite(value) && value > 0 ? value : 0));
  return { counts: clean, domain: usableDomain(domain[0], domain[1]) };
}

/**
 * The bin containing `x`, or `null` when `x` is not finite, outside `domain`, or there are
 * no bins. The domain's upper edge belongs to the last bin.
 */
export function binAt(binCount: number, domain: [number, number], x: number | null | undefined): number | null {
  if (x === null || x === undefined || !Number.isFinite(x) || binCount < 1) return null;
  const [low, high] = domain;
  if (x < low || x > high) return null;
  return Math.min(binCount - 1, Math.floor(((x - low) / (high - low)) * binCount));
}

/**
 * One SVG path `d` drawing every non-empty bar as a rectangle from the baseline.
 *
 * @param counts - The bins' counts.
 * @param yScale - Maps a count to a pixel `y`.
 * @param area - The plot area; the bins fill `x0`…`x1` and stand on `y0`.
 * @param select - `{ skip: null }` (the default) draws every bar; `{ only: i }` draws just
 *   bin `i`; `{ skip: i }` draws all but bin `i` — so a highlighted bin is its own path.
 */
export function barsPath(
  counts: readonly number[],
  yScale: Scale,
  area: PlotArea,
  select: { only: number } | { skip: number | null } = { skip: null },
): string {
  const width = (area.x1 - area.x0) / Math.max(1, counts.length);
  // A hairline gap separates bars while they are wide enough to afford one.
  const barWidth = Math.max(0.5, width > 3 ? width - 0.5 : width);
  const parts: string[] = [];
  counts.forEach((count, index) => {
    if (count <= 0) return;
    if ("only" in select ? index !== select.only : index === select.skip) return;
    const x = area.x0 + index * width;
    const y = yScale.project(count);
    if (!Number.isFinite(y)) return;
    parts.push(`M${x.toFixed(2)} ${area.y0}V${y.toFixed(2)}h${barWidth.toFixed(2)}V${area.y0}z`);
  });
  return parts.join("");
}

/** The largest count, at least 1, so an empty or all-zero histogram still has a y axis. */
export function tallest(...series: readonly (readonly number[])[]): number {
  let max = 1;
  for (const counts of series) for (const count of counts) if (count > max) max = count;
  return max;
}
