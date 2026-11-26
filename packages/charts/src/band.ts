/**
 * The arithmetic of a series' error band: the ribbon between a lower and an upper value at every
 * point of a series, its outline, and its value at an x between two points. Pure, so the geometry
 * is testable apart from the SVG.
 */

import { seriesValueAt } from "./interpolate";
import type { Scale } from "./scale";

/** A series' band: the values either side of its line, one per point, by index. */
export interface SeriesBand {
  /** The lower edge at each point. A non-finite value breaks the band there. */
  lower: readonly number[];
  /** The upper edge at each point. */
  upper: readonly number[];
  /** What the legend says after the series' name. Default `"± band"`. */
  label?: string | undefined;
}

/** The band's edges at point `index`, ordered low to high, or `null` where either is missing or non-finite. */
export function bandBoundsAt(band: Pick<SeriesBand, "lower" | "upper">, index: number): [number, number] | null {
  const a = band.lower[index];
  const b = band.upper[index];
  if (a === undefined || b === undefined || !Number.isFinite(a) || !Number.isFinite(b)) return null;
  return a <= b ? [a, b] : [b, a];
}

/**
 * The outline of a band as an SVG path `d`: the upper edge left to right and the lower edge back,
 * closed, once for every run of points whose x and both edges are finite. A run of one point has
 * no area and draws nothing; a gap ends the run, so the band is not bridged across missing data.
 *
 * @param points - The series' points, in draw order.
 * @param band - The edges, by point index. Missing entries count as gaps.
 * @param xScale - The horizontal scale.
 * @param yScale - The vertical scale.
 * @returns The path, or `""` when there is nothing to fill.
 */
export function bandPath(
  points: readonly { x: number; y: number }[],
  band: Pick<SeriesBand, "lower" | "upper">,
  xScale: Scale,
  yScale: Scale,
): string {
  const runs: { x: number; lo: number; hi: number }[][] = [];
  let run: { x: number; lo: number; hi: number }[] = [];
  const close = () => {
    if (run.length > 1) runs.push(run);
    run = [];
  };
  points.forEach((point, index) => {
    const bounds = bandBoundsAt(band, index);
    if (!Number.isFinite(point.x) || bounds === null) {
      close();
      return;
    }
    run.push({ x: xScale.project(point.x), lo: yScale.project(bounds[0]), hi: yScale.project(bounds[1]) });
  });
  close();
  const f = (n: number) => n.toFixed(2);
  return runs
    .map((r) => {
      const top = r.map((p, i) => `${i === 0 ? "M" : "L"}${f(p.x)} ${f(p.hi)}`);
      const bottom = r.map((p) => `L${f(p.x)} ${f(p.lo)}`).reverse();
      return `${[...top, ...bottom].join(" ")} Z`;
    })
    .join(" ");
}

/** Every finite edge of a band, for the chart's y extent. */
export function bandValues(band: Pick<SeriesBand, "lower" | "upper">): number[] {
  return [...band.lower, ...band.upper].filter(Number.isFinite);
}

/** A series' band at `x`, interpolated like {@link seriesValueAt}: `[lower, upper]`, or `null` outside the series or across a gap. */
export function bandValueAt(
  points: readonly { x: number; y: number }[],
  band: Pick<SeriesBand, "lower" | "upper">,
  x: number,
): [number, number] | null {
  const edge = (pick: 0 | 1) =>
    seriesValueAt(
      points.map((point, index) => ({ x: point.x, y: bandBoundsAt(band, index)?.[pick] ?? Number.NaN })),
      x,
    );
  const lo = edge(0);
  const hi = edge(1);
  return lo === null || hi === null ? null : [lo, hi];
}

/**
 * A value with its band as text: `3.2 ± 0.4` when the band is symmetric about the value, else
 * `3.2 [2.8, 3.9]`.
 *
 * @param value - The series' value.
 * @param bounds - The band's `[lower, upper]` there.
 * @param format - Formats one number.
 */
export function formatWithBand(value: number, bounds: readonly [number, number], format: (n: number) => string): string {
  const [lo, hi] = bounds;
  const up = hi - value;
  const down = value - lo;
  const symmetric = Math.abs(up - down) <= 1e-6 * Math.max(Math.abs(up), Math.abs(down), Number.MIN_VALUE);
  return symmetric ? `${format(value)} ± ${format(up)}` : `${format(value)} [${format(lo)}, ${format(hi)}]`;
}
