import { describe, expect, it } from "vitest";

import { buildPointIndex, buildPointIndexFrom, nearestPoint, pointsInRect, thinPoints } from "./pointIndex";

/** mulberry32: small, fast, seedable — a failing property run reproduces exactly. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("buildPointIndex and nearestPoint", () => {
  const xy = new Float64Array([10, 10, 20, 10, 20, 20, 100, 100]);
  const index = buildPointIndex(xy, { ids: ["a", "b", "c", "far"] });

  it("finds the nearest point within the radius, with its id and distance", () => {
    expect(nearestPoint(index, 11, 10, 5)).toEqual({ index: 0, id: "a", dist: 1 });
    expect(nearestPoint(index, 19, 18, 5)).toEqual({ index: 2, id: "c", dist: Math.hypot(1, 2) });
    expect(nearestPoint(index, 100, 100, 0)).toEqual({ index: 3, id: "far", dist: 0 });
  });

  it("uses the point index as the id when none are given", () => {
    expect(nearestPoint(buildPointIndex(xy), 20, 10, 1)).toEqual({ index: 1, id: 1, dist: 0 });
  });

  it("returns null beyond the radius, for a negative radius, and on an empty set", () => {
    expect(nearestPoint(index, 50, 50, 5)).toBeNull();
    expect(nearestPoint(index, 10, 10, -1)).toBeNull();
    expect(nearestPoint(buildPointIndex(new Float32Array(0)), 0, 0, 100)).toBeNull();
  });

  it("breaks exact ties towards the lower index", () => {
    const twins = buildPointIndex(new Float64Array([5, 5, 5, 5, 9, 5]));
    expect(nearestPoint(twins, 5, 5, 1)?.index).toBe(0);
    // Equidistant from two different points: still the lower index.
    expect(nearestPoint(twins, 7, 5, 3)?.index).toBe(0);
  });

  it("does not index points with a non-finite coordinate", () => {
    const messy = buildPointIndex(new Float64Array([Number.NaN, 0, 3, 3, Infinity, 1]));
    expect(nearestPoint(messy, 3, 3, 100)?.index).toBe(1);
    expect(nearestPoint(messy, 0, 0, 1)).toBeNull();
    expect(pointsInRect(messy, { x: -10, y: -10, width: 100, height: 100 })).toEqual([1]);
    expect(nearestPoint(buildPointIndex(new Float64Array([Number.NaN, Number.NaN])), 0, 0, 10)).toBeNull();
  });

  it("works on Float32Array and on points that all share a coordinate", () => {
    const column = buildPointIndex(new Float32Array([4, 0, 4, 10, 4, 20]));
    expect(nearestPoint(column, 4, 11, 2)?.index).toBe(1);
    const single = buildPointIndex(new Float32Array([7, 7]));
    expect(nearestPoint(single, 8, 7, 2)?.index).toBe(0);
  });

  it("keeps the grid bounded when one point is a far outlier", () => {
    const wide = buildPointIndex(new Float64Array([0, 0, 1, 1, 1e9, 1e9]), { cell: 1 });
    expect(wide.cols * wide.rows).toBeLessThanOrEqual(4_000_000);
    expect(nearestPoint(wide, 1e9, 1e9, 1)?.index).toBe(2);
    expect(nearestPoint(wide, 1, 1, 0.5)?.index).toBe(1);
  });

  it("honours a per-point pick radius on top of the query radius", () => {
    const rings = buildPointIndex(new Float64Array([50, 50, 200, 50]), { radii: [30, 0] });
    // 25 px from the first centre: inside its own 30 px disc, so a zero-radius query picks it.
    expect(nearestPoint(rings, 75, 50, 0)).toEqual({ index: 0, id: 0, dist: 25 });
    expect(nearestPoint(rings, 85, 50, 0)).toBeNull();
    expect(nearestPoint(rings, 85, 50, 6)?.index).toBe(0);
    // The second has no disc of its own.
    expect(nearestPoint(rings, 203, 50, 2)).toBeNull();
    expect(nearestPoint(rings, 203, 50, 3)?.index).toBe(1);
  });
});

describe("buildPointIndexFrom", () => {
  it("indexes items by position, reading id, x, y and pickRadius", () => {
    const index = buildPointIndexFrom([
      { id: "p", x: 10, y: 10 },
      { id: "q", x: 40, y: 10, pickRadius: 8 },
    ]);
    expect(nearestPoint(index, 12, 10, 3)).toEqual({ index: 0, id: "p", dist: 2 });
    expect(nearestPoint(index, 47, 10, 0)).toEqual({ index: 1, id: "q", dist: 7 });
    expect(buildPointIndexFrom([]).count).toBe(0);
  });
});

describe("pointsInRect", () => {
  const index = buildPointIndex(new Float64Array([10, 10, 20, 20, 30, 30, 40, 10]));

  it("returns ascending indices of points inside, edges included", () => {
    expect(pointsInRect(index, { x: 10, y: 10, width: 20, height: 20 })).toEqual([0, 1, 2]);
    expect(pointsInRect(index, { x: 35, y: 0, width: 10, height: 15 })).toEqual([3]);
  });

  it("reads a negative extent as the box between the corners, and misses cleanly", () => {
    expect(pointsInRect(index, { x: 30, y: 30, width: -20, height: -20 })).toEqual([0, 1, 2]);
    expect(pointsInRect(index, { x: 500, y: 500, width: 10, height: 10 })).toEqual([]);
    expect(pointsInRect(buildPointIndex(new Float64Array(0)), { x: 0, y: 0, width: 5, height: 5 })).toEqual([]);
  });
});

describe("thinPoints", () => {
  it("keeps points in priority order, dropping those too close to a kept one", () => {
    const xy = new Float64Array([0, 0, 10, 0, 30, 0, 31, 0, 60, 0]);
    expect(thinPoints(xy, 24)).toEqual([0, 2, 4]);
    // Priority order decides who survives.
    expect(thinPoints(xy, 24, [3, 2, 1, 0, 4])).toEqual([3, 0, 4]);
  });

  it("keeps everything for a non-positive spacing, minus non-finite points", () => {
    const xy = new Float64Array([0, 0, Number.NaN, 1, 2, 2]);
    expect(thinPoints(xy, 0)).toEqual([0, 2]);
    expect(thinPoints(xy, 0, [2, 0])).toEqual([2, 0]);
  });

  it("skips non-finite points", () => {
    expect(thinPoints(new Float64Array([0, 0, Infinity, 0, 50, 0]), 10)).toEqual([0, 2]);
  });
});

describe("properties against an exhaustive search", () => {
  const WIDTH = 900;
  const HEIGHT = 700;
  const random = prng(42);
  const n = 1500;
  const xy = new Float64Array(n * 2);
  const radii = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    xy[2 * i] = random() * WIDTH;
    xy[2 * i + 1] = random() * HEIGHT;
    radii[i] = random() < 0.2 ? random() * 15 : 0;
  }
  // Duplicates, to exercise ties.
  xy.set(xy.subarray(0, 2), 2 * (n - 1));
  const plain = buildPointIndex(xy);
  const withRadii = buildPointIndex(xy, { radii });
  const coarse = buildPointIndex(xy, { cell: 500 });

  const brute = (x: number, y: number, radius: number, r: ArrayLike<number> | null) => {
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < n; i++) {
      const d = (xy[2 * i]! - x) ** 2 + (xy[2 * i + 1]! - y) ** 2;
      const reach = radius + (r ? r[i]! : 0);
      if (d <= reach * reach && d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  };

  it("nearestPoint equals the brute-force nearest, for any cell size and pick radii", () => {
    for (let q = 0; q < 1500; q++) {
      const x = random() * (WIDTH + 100) - 50;
      const y = random() * (HEIGHT + 100) - 50;
      const radius = random() * 40;
      expect(nearestPoint(plain, x, y, radius)?.index ?? -1).toBe(brute(x, y, radius, null));
      expect(nearestPoint(coarse, x, y, radius)?.index ?? -1).toBe(brute(x, y, radius, null));
      expect(nearestPoint(withRadii, x, y, radius)?.index ?? -1).toBe(brute(x, y, radius, radii));
    }
  });

  it("pointsInRect equals the brute-force filter", () => {
    for (let q = 0; q < 400; q++) {
      const rect = { x: random() * WIDTH, y: random() * HEIGHT, width: random() * 300, height: random() * 300 };
      const expected: number[] = [];
      for (let i = 0; i < n; i++) {
        const px = xy[2 * i]!;
        const py = xy[2 * i + 1]!;
        if (px >= rect.x && px <= rect.x + rect.width && py >= rect.y && py <= rect.y + rect.height) expected.push(i);
      }
      expect(pointsInRect(plain, rect)).toEqual(expected);
      expect(pointsInRect(coarse, rect)).toEqual(expected);
    }
  });

  it("thinPoints is a maximal selection with every pair at least minDist apart", () => {
    // Accumulate and assert once: an `expect` per pair makes this O(k²) assertions, which
    // times out on a CI runner.
    for (const minDist of [3, 24, 90]) {
      const kept = thinPoints(xy, minDist);
      const keptSet = new Set(kept);
      let closest = Infinity;
      for (let a = 0; a < kept.length; a++) {
        for (let b = a + 1; b < kept.length; b++) {
          const d = Math.hypot(xy[2 * kept[a]!]! - xy[2 * kept[b]!]!, xy[2 * kept[a]! + 1]! - xy[2 * kept[b]! + 1]!);
          if (d < closest) closest = d;
        }
      }
      expect(closest).toBeGreaterThanOrEqual(minDist);
      // Every dropped point is within minDist of a point kept before it.
      const orphans: number[] = [];
      for (let i = 0; i < n; i++) {
        if (keptSet.has(i)) continue;
        const close = kept.some(
          (k) => k < i && Math.hypot(xy[2 * k]! - xy[2 * i]!, xy[2 * k + 1]! - xy[2 * i + 1]!) < minDist,
        );
        if (!close) orphans.push(i);
      }
      expect(orphans).toEqual([]);
    }
  });
});
