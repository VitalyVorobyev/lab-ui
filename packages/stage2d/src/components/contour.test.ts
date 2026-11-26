import { describe, expect, it } from "vitest";

import type { ValuePlane } from "../api/mapValues";
import { channelExtent, contourAtLevel, contourPaths, lineLength, MAX_LEVELS, pointsAlong, resolveLevels } from "./contour";

const NAN = Number.NaN;
const plane = (width: number, height: number, values: number[], channels = 1): ValuePlane => ({
  width,
  height,
  stride: 1,
  channels,
  values: Float32Array.from(values),
});
const pairs = (points: number[]) => {
  const out: [number, number][] = [];
  for (let k = 0; k < points.length; k += 2) out.push([points[k]!, points[k + 1]!]);
  return out;
};

describe("contourAtLevel", () => {
  it("finds nothing in a flat field, a field under the level or above it, or a plane under 2 x 2", () => {
    expect(contourAtLevel([1, 1, 1, 1], 2, 2, 0.5)).toEqual([]);
    expect(contourAtLevel([0, 0, 0, 0], 2, 2, 0.5)).toEqual([]);
    expect(contourAtLevel([1, 2], 2, 1, 1.5)).toEqual([]);
    expect(contourAtLevel([1, 2, 3, 4], 2, 2, Number.NaN)).toEqual([]);
  });

  it("interpolates a single corner linearly along its edges", () => {
    // Only the top-left node is above (2, against 0 and a level of 1.5): both edges are cut a quarter in.
    const lines = contourAtLevel([2, 0, 0, 0], 2, 2, 1.5);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.closed).toBe(false);
    expect(pairs(lines[0]!.points).sort((a, b) => a[0] - b[0])).toEqual([
      [0, 0.25],
      [0.25, 0],
    ]);
  });

  it("is one straight line across a ramp, whatever the width", () => {
    const w = 5;
    const h = 4;
    const values = Array.from({ length: w * h }, (_, k) => k % w);
    const lines = contourAtLevel(values, w, h, 2.5);
    expect(lines).toHaveLength(1);
    const pts = pairs(lines[0]!.points);
    expect(pts).toHaveLength(h);
    for (const [x] of pts) expect(x).toBeCloseTo(2.5);
    expect(pts.map(([, y]) => y).sort((a, b) => a - b)).toEqual([0, 1, 2, 3]);
    expect(lineLength(lines[0]!)).toBeCloseTo(h - 1);
  });

  it("closes a ring around a peak, once, with no repeated first point", () => {
    const w = 7;
    const values = Array.from({ length: w * w }, (_, k) => -Math.hypot((k % w) - 3, Math.floor(k / w) - 3));
    const lines = contourAtLevel(values, w, w, -2.2);
    expect(lines).toHaveLength(1);
    const line = lines[0]!;
    expect(line.closed).toBe(true);
    const pts = pairs(line.points);
    expect(pts.length).toBeGreaterThan(8);
    for (const [x, y] of pts) expect(Math.hypot(x - 3, y - 3)).toBeGreaterThan(1.9);
    for (const [x, y] of pts) expect(Math.hypot(x - 3, y - 3)).toBeLessThan(2.5);
    expect(new Set(pts.map((p) => p.join())).size).toBe(pts.length);
  });

  it("separates the two ends of a saddle by the cell's mean", () => {
    // Above: top-right and bottom-left.  Mean 0.5 (>= level 0.4): the above corners join -> the two
    // below corners are cut off, two separate lines, and the middle of the cell is above.
    const joined = contourAtLevel([0, 1, 1, 0], 2, 2, 0.4);
    expect(joined).toHaveLength(2);
    // The mean is below the level: the above corners are isolated, the lines cut those instead.
    const split = contourAtLevel([0, 1, 1, 0], 2, 2, 0.6);
    expect(split).toHaveLength(2);
    const near = (line: { points: number[] }, x: number, y: number) =>
      pairs(line.points).some(([px, py]) => Math.hypot(px - x, py - y) < 0.5);
    // Joined: each line hugs a below corner (0,0) and (1,1).
    expect(joined.some((l) => near(l, 0, 0) && !near(l, 1, 0))).toBe(true);
    expect(joined.some((l) => near(l, 1, 1) && !near(l, 0, 1))).toBe(true);
    // Split: each hugs an above corner (1,0) and (0,1).
    expect(split.some((l) => near(l, 1, 0) && !near(l, 0, 0))).toBe(true);
    expect(split.some((l) => near(l, 0, 1) && !near(l, 1, 1))).toBe(true);
  });

  it("is symmetric under the other saddle orientation", () => {
    expect(contourAtLevel([1, 0, 0, 1], 2, 2, 0.4)).toHaveLength(2);
    expect(contourAtLevel([1, 0, 0, 1], 2, 2, 0.6)).toHaveLength(2);
  });

  it("joins the cells of a saddle row into longer lines", () => {
    // A checkerboard-ish 3 x 3: every line is chained through shared edges, none is left in pieces of one segment
    // when it could continue.
    const lines = contourAtLevel([0, 1, 0, 1, 0, 1, 0, 1, 0], 3, 3, 0.5);
    const segments = lines.reduce((n, l) => n + pairs(l.points).length - (l.closed ? 0 : 1), 0);
    // Four cells, each with two segments.
    expect(segments).toBe(8);
    for (const l of lines) for (const [x, y] of pairs(l.points)) expect(x >= 0 && x <= 2 && y >= 0 && y <= 2).toBe(true);
  });

  it("never crosses a NaN cell: a line ends at the hole", () => {
    const w = 6;
    const h = 6;
    const values = Array.from({ length: w * h }, (_, k) => k % w);
    values[2 * w + 2] = NAN;
    const lines = contourAtLevel(values, w, h, 2.5);
    // The ramp's line is cut by the hole's four cells (rows 1 and 2): two pieces.
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      for (const [x, y] of pairs(line.points)) {
        // No vertex on an edge of a cell touching the NaN node (2, 2): cells (1..2, 1..2).
        const inHole = x > 1 && x < 3 && y > 1 && y < 3;
        expect(inHole).toBe(false);
      }
    }
    expect(lines.every((l) => !l.closed)).toBe(true);
  });

  it("draws nothing in a plane of only NaN and never emits NaN", () => {
    expect(contourAtLevel([NAN, NAN, NAN, NAN], 2, 2, 0)).toEqual([]);
    const lines = contourAtLevel([0, 1, NAN, 1, 0, 1, 1, NAN, 0], 3, 3, 0.5);
    for (const l of lines) for (const v of l.points) expect(Number.isFinite(v)).toBe(true);
  });

  it("puts a vertex on the node when the level equals a value, and still yields a line", () => {
    const lines = contourAtLevel([0, 1, 0, 1], 2, 2, 1);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.points.every(Number.isFinite)).toBe(true);
  });

  it("is deterministic and reads a channel at its offset", () => {
    const a = contourAtLevel([0, 0, 1, 1, 9, 9, 9, 9], 2, 2, 0.5, 0);
    const b = contourAtLevel([0, 0, 1, 1, 9, 9, 9, 9], 2, 2, 0.5, 0);
    expect(a).toEqual(b);
    const second = contourPaths(plane(2, 2, [0, 0, 1, 1, 0, 1, 0, 1], 2), 1, [0.5]);
    expect(second).toHaveLength(1);
    expect(pairs(second[0]!.points).every(([x]) => Math.abs(x - 0.5) < 1e-9)).toBe(true);
  });
});

describe("contourPaths", () => {
  it("is empty for a channel out of range", () => {
    expect(contourPaths(plane(2, 2, [0, 0, 1, 1]), 1, [0.5])).toEqual([]);
    expect(contourPaths(plane(2, 2, [0, 0, 1, 1]), -1, [0.5])).toEqual([]);
    expect(contourPaths(plane(2, 2, [0, 0, 1, 1]), 0.5, [0.5])).toEqual([]);
  });

  it("returns each level's lines tagged with it, in the given order", () => {
    const p = plane(4, 2, [0, 1, 2, 3, 0, 1, 2, 3]);
    const lines = contourPaths(p, 0, [0.5, 1.5, 2.5]);
    expect(lines.map((l) => l.level)).toEqual([0.5, 1.5, 2.5]);
  });
});

describe("resolveLevels", () => {
  it("sorts, dedupes and drops non-finite explicit levels", () => {
    expect(resolveLevels([2, 1, 2, NAN, Infinity, 0], 0, 1)).toEqual([0, 1, 2]);
  });

  it("takes every multiple of a step inside the extent, with an optional origin", () => {
    expect(resolveLevels({ step: 0.5 }, -0.6, 1.1)).toEqual([-0.5, 0, 0.5, 1]);
    expect(resolveLevels({ step: 1, origin: 0.25 }, 0, 2.5)).toEqual([0.25, 1.25, 2.25]);
  });

  it("widens a step that would give too many levels, and refuses a bad one", () => {
    const many = resolveLevels({ step: 0.001 }, 0, 10);
    expect(many.length).toBeLessThanOrEqual(MAX_LEVELS + 1);
    expect(many.length).toBeGreaterThan(10);
    expect(resolveLevels({ step: 0 }, 0, 1)).toEqual([]);
    expect(resolveLevels({ step: -1 }, 0, 1)).toEqual([]);
    expect(resolveLevels({ step: 1 }, NAN, 1)).toEqual([]);
  });
});

describe("channelExtent", () => {
  it("is the finite extent of the channel, or null", () => {
    expect(channelExtent(plane(2, 2, [NAN, 3, -1, 2]))).toEqual([-1, 3]);
    expect(channelExtent(plane(2, 1, [NAN, NAN]))).toBeNull();
    expect(channelExtent(plane(2, 1, [1, 2, 5, 6], 2), 1)).toEqual([5, 6]);
  });
});

describe("pointsAlong", () => {
  const line = { level: 0, points: [0, 0, 4, 0, 4, 4], closed: false };
  it("places labels at the middle of equal shares of the arc", () => {
    expect(lineLength(line)).toBe(8);
    expect(pointsAlong(line, 1)).toEqual([[4, 0]]);
    expect(pointsAlong(line, 2)).toEqual([
      [2, 0],
      [4, 2],
    ]);
  });

  it("walks a closed line's closing segment and handles degenerate lines", () => {
    const closed = { level: 0, points: [0, 0, 2, 0, 2, 2, 0, 2], closed: true };
    expect(lineLength(closed)).toBe(8);
    expect(pointsAlong(closed, 1)).toEqual([[2, 2]]);
    expect(pointsAlong({ level: 0, points: [], closed: false }, 1)).toEqual([]);
    expect(pointsAlong({ level: 0, points: [1, 1], closed: false }, 1)).toEqual([[1, 1]]);
    expect(pointsAlong(line, 0)).toEqual([]);
  });
});
