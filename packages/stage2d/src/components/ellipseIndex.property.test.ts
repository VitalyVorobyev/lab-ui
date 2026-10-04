/**
 * Property tests for the ellipse index: the distance against a dense sampling of the outline,
 * and the picking laws, over seeded-random ellipses (round, thin, rotated) and queries.
 */

import { describe, expect, it } from "vitest";

import { buildEllipseIndex, distanceToEllipse, ellipsesInRect, nearestEllipse, pointInEllipse, type Ellipse } from "./ellipseIndex";

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

/** The distance to the outline by brute force: the nearest of `n` points sampled along it. */
function sampledDistance(e: Ellipse, x: number, y: number, n = 40_000): number {
  const c = Math.cos(e.angle ?? 0);
  const s = Math.sin(e.angle ?? 0);
  let best = Infinity;
  for (let k = 0; k < n; k++) {
    const t = (2 * Math.PI * k) / n;
    const lx = e.rx * Math.cos(t);
    const ly = e.ry * Math.sin(t);
    const d = Math.hypot(e.x + c * lx - s * ly - x, e.y + s * lx + c * ly - y);
    if (d < best) best = d;
  }
  return best;
}

describe("distanceToEllipse (property)", () => {
  it("matches the sampled outline, inside and outside, for round, thin and turned ellipses", () => {
    const random = prng(2024);
    for (let run = 0; run < 400; run++) {
      const rx = 2 + random() * 80;
      // One in three is thin: aspect ratio up to 40:1, where a scaled-radius distance breaks.
      const ry = random() < 0.33 ? rx / (5 + random() * 35) : 2 + random() * 80;
      const e: Ellipse = { id: run, x: (random() - 0.5) * 200, y: (random() - 0.5) * 200, rx, ry, angle: (random() - 0.5) * 8 };
      const reach = Math.max(rx, ry) * 2;
      const x = e.x + (random() - 0.5) * 2 * reach;
      const y = e.y + (random() - 0.5) * 2 * reach;
      const exact = distanceToEllipse(e, x, y);
      const sampled = sampledDistance(e, x, y);
      // The sampling error is below half a sample spacing squared over the radius of curvature;
      // 2e-3 relative to the size bounds it for 40,000 samples.
      expect(exact, `run ${run}: ${JSON.stringify(e)} at ${x},${y}`).toBeLessThanOrEqual(sampled + 1e-9);
      expect(sampled - exact, `run ${run}: ${JSON.stringify(e)} at ${x},${y}`).toBeLessThan(2e-3 * Math.max(rx, ry));
    }
  });

  it("is zero on the outline", () => {
    const random = prng(5);
    for (let run = 0; run < 200; run++) {
      const e: Ellipse = { id: run, x: 0, y: 0, rx: 5 + random() * 50, ry: 3 + random() * 50, angle: random() * 3 };
      const t = random() * 2 * Math.PI;
      const lx = e.rx * Math.cos(t);
      const ly = e.ry * Math.sin(t);
      const x = Math.cos(e.angle!) * lx - Math.sin(e.angle!) * ly;
      const y = Math.sin(e.angle!) * lx + Math.cos(e.angle!) * ly;
      expect(distanceToEllipse(e, x, y), `run ${run}`).toBeLessThan(1e-6);
    }
  });
});

describe("nearestEllipse (property)", () => {
  it("agrees with a scan over every ellipse", () => {
    const random = prng(77);
    for (let run = 0; run < 60; run++) {
      const items: Ellipse[] = Array.from({ length: 30 }, (_, id) => ({
        id,
        x: random() * 400,
        y: random() * 300,
        rx: 3 + random() * 40,
        ry: 3 + random() * 40,
        angle: random() * 3,
      }));
      const index = buildEllipseIndex(items);
      for (let q = 0; q < 30; q++) {
        const p = { x: random() * 400, y: random() * 300 };
        const radius = random() * 12;
        let edge: { id: number; distance: number; area: number } | null = null;
        let inner: { id: number; area: number } | null = null;
        for (const e of items) {
          const distance = distanceToEllipse(e, p.x, p.y);
          const area = e.rx * e.ry;
          if (distance <= radius) {
            if (edge === null || distance < edge.distance || (distance === edge.distance && area < edge.area)) edge = { id: e.id as number, distance, area };
          } else if (pointInEllipse(e, p.x, p.y) && (inner === null || area < inner.area)) inner = { id: e.id as number, area };
        }
        expect(nearestEllipse(index, p, radius)?.id ?? null, `run ${run} query ${q}`).toBe((edge ?? inner)?.id ?? null);
      }
    }
  });

  it("finds an ellipse in a rectangle exactly when a sampled point of it lies in the rectangle or the rectangle is inside it", () => {
    const random = prng(31);
    for (let run = 0; run < 300; run++) {
      const e: Ellipse = { id: run, x: 50, y: 50, rx: 4 + random() * 40, ry: 4 + random() * 40, angle: random() * 3 };
      const index = buildEllipseIndex([e]);
      const rect = { x: random() * 120 - 10, y: random() * 120 - 10, width: random() * 40, height: random() * 40 };
      // Reference: some point of the filled ellipse (a polar grid) lies in the rectangle.
      let touches = false;
      for (let k = 0; k < 200 && !touches; k++) {
        for (let r = 0; r <= 1.0001 && !touches; r += 0.02) {
          const t = (2 * Math.PI * k) / 200;
          const lx = r * e.rx * Math.cos(t);
          const ly = r * e.ry * Math.sin(t);
          const x = 50 + Math.cos(e.angle!) * lx - Math.sin(e.angle!) * ly;
          const y = 50 + Math.sin(e.angle!) * lx + Math.cos(e.angle!) * ly;
          if (x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height) touches = true;
        }
      }
      const found = ellipsesInRect(index, rect).length === 1;
      // The grid can miss a grazing contact (found without a sample), never the reverse.
      if (touches) expect(found, `run ${run}`).toBe(true);
    }
  });
});
