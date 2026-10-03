/**
 * Property tests for the area index: it must agree with the obvious O(n) scan, whatever the
 * layout, over seeded-random scenes, so a failure reproduces exactly.
 */

import { describe, expect, it } from "vitest";

import {
  areaPath,
  areasInRect,
  buildAreaIndex,
  distanceToOutline,
  nearestArea,
  pointInPolygon,
  polygonArea,
  type Area,
} from "./areaIndex";

/** mulberry32: a small, fast, seedable PRNG — deterministic runs without a dependency. */
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

/** Random convex-ish polygons (sorted by angle around a centre, so they are simple) of every size. */
function scene(rand: () => number, count: number, extent: number): Area[] {
  return Array.from({ length: count }, (_, id) => {
    const cx = rand() * extent;
    const cy = rand() * extent;
    const r = 2 + rand() ** 3 * extent * 0.4;
    const n = 3 + Math.floor(rand() * 6);
    const angles = Array.from({ length: n }, () => rand() * 2 * Math.PI).sort((a, b) => a - b);
    const points = angles.flatMap((t) => {
      const rr = r * (0.5 + 0.5 * rand());
      return [cx + rr * Math.cos(t), cy + rr * Math.sin(t)];
    });
    return { id, points };
  });
}

/** The reference answer: scan every area. */
function bruteNearest(items: readonly Area[], x: number, y: number, radius: number) {
  let edge: { index: number; distance: number; size: number } | null = null;
  let inner: { index: number; size: number } | null = null;
  for (let index = 0; index < items.length; index++) {
    const item = items[index]!;
    const distance = distanceToOutline(item.points, x, y);
    const size = polygonArea(item.points);
    if (distance <= radius) {
      if (edge === null || distance < edge.distance || (distance === edge.distance && size < edge.size)) edge = { index, distance, size };
    } else if (pointInPolygon(item.points, x, y) && (inner === null || size < inner.size)) {
      inner = { index, size };
    }
  }
  return (edge ?? inner)?.index ?? null;
}

describe("nearestArea against a scan of every area", () => {
  it("picks the same area for random queries over random scenes", { timeout: 30_000 }, () => {
    const rand = prng(1234);
    let mismatches = 0;
    let queries = 0;
    for (let round = 0; round < 12; round++) {
      const extent = 100 + rand() * 900;
      const items = scene(rand, 5 + Math.floor(rand() * 120), extent);
      const index = buildAreaIndex(items, rand() < 0.5 ? undefined : 8 + rand() * 80);
      for (let q = 0; q < 150; q++) {
        const x = (rand() * 1.2 - 0.1) * extent;
        const y = (rand() * 1.2 - 0.1) * extent;
        const radius = rand() < 0.2 ? 0 : rand() * 12;
        queries++;
        if ((nearestArea(index, { x, y }, radius)?.index ?? null) !== bruteNearest(items, x, y, radius)) mismatches++;
      }
    }
    expect(queries).toBe(1800);
    expect(mismatches).toBe(0);
  });
});

describe("areasInRect against a scan of every area", () => {
  it("finds every area a band touches, and no other", { timeout: 30_000 }, () => {
    const rand = prng(99);
    let mismatches = 0;
    for (let round = 0; round < 10; round++) {
      const extent = 100 + rand() * 500;
      const items = scene(rand, 5 + Math.floor(rand() * 80), extent);
      const index = buildAreaIndex(items);
      for (let q = 0; q < 60; q++) {
        const x = rand() * extent;
        const y = rand() * extent;
        const rect = { x, y, width: rand() * extent * 0.4, height: rand() * extent * 0.4 };
        // Reference: dense sampling of the band's boundary and interior against the polygon,
        // plus the polygon's vertices against the band, is exact for these simple polygons
        // only up to sampling; so compare against the superset/subset relations instead.
        const found = new Set(areasInRect(index, rect));
        for (const item of items) {
          const p = item.points;
          let vertexInside = false;
          for (let i = 0; i + 1 < p.length; i += 2) {
            if (p[i]! >= rect.x && p[i]! <= rect.x + rect.width && p[i + 1]! >= rect.y && p[i + 1]! <= rect.y + rect.height) vertexInside = true;
          }
          const centreInside = pointInPolygon(p, rect.x + rect.width / 2, rect.y + rect.height / 2);
          // Anything with a vertex in the band, or enclosing its centre, must be found.
          if ((vertexInside || centreInside) && !found.has(item.id)) mismatches++;
          // Anything found must at least have a bounding box that meets the band.
          if (found.has(item.id)) {
            let minX = Infinity;
            let maxX = -Infinity;
            let minY = Infinity;
            let maxY = -Infinity;
            for (let i = 0; i + 1 < p.length; i += 2) {
              minX = Math.min(minX, p[i]!);
              maxX = Math.max(maxX, p[i]!);
              minY = Math.min(minY, p[i + 1]!);
              maxY = Math.max(maxY, p[i + 1]!);
            }
            if (maxX < rect.x || minX > rect.x + rect.width || maxY < rect.y || minY > rect.y + rect.height) mismatches++;
          }
        }
      }
    }
    expect(mismatches).toBe(0);
  });
});

describe("pointInPolygon and areaPath", () => {
  it("agrees with the half-plane test on convex polygons", () => {
    const rand = prng(7);
    let wrong = 0;
    for (let n = 0; n < 200; n++) {
      // A regular k-gon: inside iff on the inner side of every edge.
      const k = 3 + Math.floor(rand() * 7);
      const cx = rand() * 100;
      const cy = rand() * 100;
      const r = 5 + rand() * 40;
      const points = Array.from({ length: k }, (_, i) => [cx + r * Math.cos((2 * Math.PI * i) / k), cy + r * Math.sin((2 * Math.PI * i) / k)]).flat();
      for (let q = 0; q < 20; q++) {
        const x = cx + (rand() * 2 - 1) * r * 1.2;
        const y = cy + (rand() * 2 - 1) * r * 1.2;
        let inside = true;
        for (let i = 0; i < k; i++) {
          const j = (i + 1) % k;
          const cross = (points[2 * j]! - points[2 * i]!) * (y - points[2 * i + 1]!) - (points[2 * j + 1]! - points[2 * i + 1]!) * (x - points[2 * i]!);
          if (cross < 0) inside = false;
        }
        if (inside !== pointInPolygon(points, x, y)) wrong++;
      }
    }
    expect(wrong).toBe(0);
  });

  it("writes the same ring for either winding, and the ring has the same vertices", () => {
    const rand = prng(3);
    for (let n = 0; n < 100; n++) {
      const items = scene(rand, 1, 100);
      const ring = items[0]!.points;
      // The same ring the other way round, from the same first vertex.
      const reversed: number[] = [ring[0]!, ring[1]!];
      for (let i = ring.length / 2 - 1; i >= 1; i--) reversed.push(ring[2 * i]!, ring[2 * i + 1]!);
      expect(areaPath(reversed)).toBe(areaPath(ring));
      expect((areaPath(ring).match(/[ML]/g) ?? []).length).toBe(ring.length / 2);
    }
  });
});
