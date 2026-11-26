/** Reading a series between its points. */

/**
 * A series' value at `x`, linearly interpolated between the points either side, or `null`
 * outside its range or across a gap.
 *
 * @param points - The series, in ascending `x`.
 * @param x - Where.
 * @returns The interpolated value, or `null`.
 */
export function seriesValueAt(points: readonly { x: number; y: number }[], x: number): number | null {
  if (points.length === 0) return null;
  if (points.length === 1) return points[0]!.x === x ? points[0]!.y : null;
  let lo = 0;
  let hi = points.length - 1;
  if (x < points[lo]!.x || x > points[hi]!.x) return null;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid]!.x <= x) lo = mid;
    else hi = mid;
  }
  const a = points[lo]!;
  const b = points[hi]!;
  if (!Number.isFinite(a.y) || !Number.isFinite(b.y)) return null;
  if (b.x === a.x) return a.y;
  return a.y + ((x - a.x) / (b.x - a.x)) * (b.y - a.y);
}
