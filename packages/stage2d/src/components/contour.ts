/**
 * Iso-lines of a scalar field: marching squares over a `ValuePlane` channel.
 *
 * Pure and deterministic. The plane's samples are nodes (at pixel centres); a cell is the four nodes
 * of a 2×2 block. A node is *above* a level when its value is `>=` the level. Each cell that mixes
 * above and below nodes holds one segment (two in a saddle), its ends at the linear crossings of the
 * cell's edges. A cell with a `NaN` (or infinite) node holds none, so a line stops at a hole and
 * never bridges it. Segments are chained into polylines through the edge they share.
 *
 * Coordinates are in nodes: `(i, j)` is the centre of the plane's pixel `(i, j)`.
 */

import type { ValuePlane } from "../api/mapValues";

/** One iso-line: a polyline at a level. */
export interface ContourLine {
  /** The level it lies on. */
  level: number;
  /** Flat `[x0, y0, x1, y1, …]` in nodes. For a closed line the first point is not repeated. */
  points: number[];
  /** Whether it returns to its start. */
  closed: boolean;
}

/** The most levels a `step` is allowed to produce; a finer step is widened by whole multiples. */
export const MAX_LEVELS = 64;

/**
 * The levels to draw.
 *
 * @param spec - Explicit levels (non-finite ones are dropped, duplicates merged), or `{ step }`:
 *   every multiple of `step` (offset by `origin`) inside `[min, max]`. If that gives more than
 *   `MAX_LEVELS` levels the step is multiplied by a whole number until it does not.
 * @param min - The field's smallest finite value, for a step.
 * @param max - The field's largest finite value.
 * @returns Ascending, distinct levels.
 */
export function resolveLevels(spec: readonly number[] | { step: number; origin?: number | undefined }, min: number, max: number): number[] {
  if (Array.isArray(spec) || ArrayBuffer.isView(spec)) {
    return [...new Set((spec as readonly number[]).filter(Number.isFinite))].sort((a, b) => a - b);
  }
  const { step, origin = 0 } = spec as { step: number; origin?: number | undefined };
  if (!(step > 0) || !Number.isFinite(step) || !Number.isFinite(min) || !Number.isFinite(max) || max < min) return [];
  let use = step;
  while ((max - min) / use > MAX_LEVELS) use += step;
  const first = Math.ceil((min - origin) / use - 1e-9);
  const last = Math.floor((max - origin) / use + 1e-9);
  const levels: number[] = [];
  for (let k = first; k <= last; k++) levels.push(origin + k * use);
  return levels;
}

/** The finite extent of one channel of a plane, `null` when it has no finite value. */
export function channelExtent(plane: ValuePlane, channel = 0): [number, number] | null {
  const size = plane.width * plane.height;
  const base = channel * size;
  let min = Infinity;
  let max = -Infinity;
  for (let k = 0; k < size; k++) {
    const v = plane.values[base + k]!;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return min <= max && Number.isFinite(min) && Number.isFinite(max) ? [min, max] : null;
}

// Edge ids: a horizontal edge from node (i, j) to (i + 1, j) is `2 (j w + i)`, a vertical edge from
// (i, j) to (i, j + 1) is `2 (j w + i) + 1`. One crossing lies on each edge, so segments of
// neighbouring cells meet at equal ids.

/** Segment endpoints (as edges `T`op, `R`ight, `B`ottom, `L`eft) for each case; corners a b c d clockwise from top-left, a = 8. */
const T = 0;
const R = 1;
const B = 2;
const L = 3;
const CASES: readonly (readonly (readonly [number, number])[])[] = [
  [],
  [[L, B]],
  [[B, R]],
  [[L, R]],
  [[T, R]],
  [], // saddle, below
  [[T, B]],
  [[T, L]],
  [[T, L]],
  [[T, B]],
  [], // saddle, below
  [[T, R]],
  [[L, R]],
  [[B, R]],
  [[L, B]],
  [],
];

/**
 * The iso-lines of one channel at one level.
 *
 * @param values - The samples, row-major within the channel (`plane.values`).
 * @param width - Columns (nodes).
 * @param height - Rows.
 * @param level - The level.
 * @param offset - Index of the channel's first sample. Default 0.
 * @returns The lines, in a deterministic order (by the first cell, row-major, each line starting
 *   at its first segment). Empty for a plane under 2×2 nodes.
 */
export function contourAtLevel(values: ArrayLike<number>, width: number, height: number, level: number, offset = 0): ContourLine[] {
  if (!(width >= 2 && height >= 2) || !Number.isFinite(level)) return [];
  const edgeId = (i: number, j: number, edge: number): number => {
    switch (edge) {
      case T:
        return 2 * (j * width + i);
      case B:
        return 2 * ((j + 1) * width + i);
      case L:
        return 2 * (j * width + i) + 1;
      default:
        return 2 * (j * width + i + 1) + 1;
    }
  };

  const segments: [number, number][] = [];
  for (let j = 0; j < height - 1; j++) {
    for (let i = 0; i < width - 1; i++) {
      const a = values[offset + j * width + i]!;
      const b = values[offset + j * width + i + 1]!;
      const c = values[offset + (j + 1) * width + i + 1]!;
      const d = values[offset + (j + 1) * width + i]!;
      // `NaN` fails every comparison; an infinity has no finite crossing. Either leaves the cell empty.
      if (!(Number.isFinite(a) && Number.isFinite(b) && Number.isFinite(c) && Number.isFinite(d))) continue;
      const index = (a >= level ? 8 : 0) | (b >= level ? 4 : 0) | (c >= level ? 2 : 0) | (d >= level ? 1 : 0);
      let pairs = CASES[index]!;
      if (index === 5 || index === 10) {
        // A saddle. The cell's mean decides whether the above corners are joined through the middle.
        const joined = (a + b + c + d) / 4 >= level;
        pairs =
          index === 5
            ? joined
              ? [
                  [T, L],
                  [B, R],
                ]
              : [
                  [T, R],
                  [L, B],
                ]
            : joined
              ? [
                  [T, R],
                  [L, B],
                ]
              : [
                  [T, L],
                  [B, R],
                ];
      }
      for (const [e0, e1] of pairs) segments.push([edgeId(i, j, e0), edgeId(i, j, e1)]);
    }
  }
  if (segments.length === 0) return [];

  // Each edge id has at most two segments.
  const at = new Map<number, number[]>();
  segments.forEach(([p, q], s) => {
    for (const id of [p, q]) {
      const list = at.get(id);
      if (list) list.push(s);
      else at.set(id, [s]);
    }
  });

  const crossing = (id: number): [number, number] => {
    const vertical = id % 2 === 1;
    const node = (id - (vertical ? 1 : 0)) / 2;
    const i = node % width;
    const j = (node - i) / width;
    const v0 = values[offset + node]!;
    const v1 = values[offset + node + (vertical ? width : 1)]!;
    const t = Math.min(1, Math.max(0, (level - v0) / (v1 - v0)));
    return vertical ? [i, j + t] : [i + t, j];
  };

  const used = new Uint8Array(segments.length);
  const lines: ContourLine[] = [];
  for (let s = 0; s < segments.length; s++) {
    if (used[s]) continue;
    used[s] = 1;
    const ids = [segments[s]![0], segments[s]![1]];
    // Forward from the tail, then backward from the head, until a loop closes or the line ends.
    walk(ids, at, segments, used, true);
    walk(ids, at, segments, used, false);
    const closed = ids.length > 2 && ids[0] === ids[ids.length - 1];
    if (closed) ids.pop();
    const points: number[] = [];
    for (const id of ids) points.push(...crossing(id));
    lines.push({ level, points, closed });
  }
  return lines;
}

/** Extends a chain of edge ids at its tail (`forward`) or head by the unused segments meeting there. */
function walk(ids: number[], at: Map<number, number[]>, segments: readonly [number, number][], used: Uint8Array, forward: boolean): void {
  for (;;) {
    const end = forward ? ids[ids.length - 1]! : ids[0]!;
    if (ids.length > 2 && ids[0] === ids[ids.length - 1]) return;
    const next = at.get(end)!.find((other) => !used[other]);
    if (next === undefined) return;
    used[next] = 1;
    const [p, q] = segments[next]!;
    const far = p === end ? q : p;
    if (forward) ids.push(far);
    else ids.unshift(far);
  }
}

/**
 * The iso-lines of a plane's channel at every level, lowest level first.
 *
 * @param plane - The field; `NaN` is "no data".
 * @param channel - Which channel. Default 0; out of range gives no lines.
 * @param levels - See `resolveLevels`; the lines of each level, in turn.
 */
export function contourPaths(plane: ValuePlane, channel: number, levels: readonly number[]): ContourLine[] {
  if (!Number.isInteger(channel) || channel < 0 || channel >= plane.channels) return [];
  const offset = channel * plane.width * plane.height;
  return levels.flatMap((level) => contourAtLevel(plane.values, plane.width, plane.height, level, offset));
}

/** Total length of a polyline (closing segment included for a closed line), in nodes. */
export function lineLength(line: ContourLine): number {
  const p = line.points;
  let length = 0;
  for (let k = 2; k < p.length; k += 2) length += Math.hypot(p[k]! - p[k - 2]!, p[k + 1]! - p[k - 1]!);
  if (line.closed && p.length >= 4) length += Math.hypot(p[0]! - p[p.length - 2]!, p[1]! - p[p.length - 1]!);
  return length;
}

/**
 * Points along a line at fractions of its length, for placing labels.
 *
 * @param line - The line.
 * @param count - How many labels; they sit at `(k + 0.5) / count` of the arc length.
 * @returns `[x, y]` per label, in nodes.
 */
export function pointsAlong(line: ContourLine, count: number): [number, number][] {
  const p = line.points;
  const n = p.length / 2;
  if (n === 0 || count < 1) return [];
  const total = lineLength(line);
  if (n === 1 || total === 0) return [[p[0]!, p[1]!]];
  const out: [number, number][] = [];
  const segs = line.closed ? n : n - 1;
  for (let k = 0; k < count; k++) {
    let target = ((k + 0.5) / count) * total;
    for (let s = 0; s < segs; s++) {
      const x0 = p[2 * s]!;
      const y0 = p[2 * s + 1]!;
      const t = (s + 1) % n;
      const x1 = p[2 * t]!;
      const y1 = p[2 * t + 1]!;
      const len = Math.hypot(x1 - x0, y1 - y0);
      if (target <= len || s === segs - 1) {
        const f = len === 0 ? 0 : Math.min(1, target / len);
        out.push([x0 + f * (x1 - x0), y0 + f * (y1 - y0)]);
        break;
      }
      target -= len;
    }
  }
  return out;
}
