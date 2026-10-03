import { describe, expect, it } from "vitest";

import {
  buildPolylineIndex,
  nearestPolyline,
  polylineBounds,
  polylinePath,
  polylinesInRect,
  type Polyline,
} from "./polylineIndex";
import type { Rect } from "./stage/view";

const SQUARE: Polyline = { id: "square", points: [10, 10, 30, 10, 30, 30, 10, 30], closed: true };
const LINE: Polyline = { id: 7, points: [0, 50, 100, 50] };
const DOT: Polyline = { id: "dot", points: [80, 80] };

describe("polylinePath", () => {
  it("draws open, closed and single-point lines", () => {
    expect(polylinePath(LINE.points)).toBe("M0 50L100 50");
    expect(polylinePath(SQUARE.points, true)).toBe("M10 10L30 10L30 30L10 30Z");
    expect(polylinePath(DOT.points)).toBe("M80 80L80 80");
    expect(polylinePath([])).toBe("");
  });
});

describe("polylineBounds", () => {
  it("is the box around the points", () => {
    expect(polylineBounds(SQUARE.points)).toEqual({ x: 10, y: 10, width: 20, height: 20 });
    expect(polylineBounds([])).toBeNull();
  });
});

describe("nearestPolyline", () => {
  const index = buildPolylineIndex([SQUARE, LINE, DOT]);

  it("finds the line under a point, with the closest point on it", () => {
    expect(nearestPolyline(index, { x: 50, y: 52 }, 5)).toEqual({ id: 7, point: { x: 50, y: 50 }, distance: 2 });
    // The closing segment of a closed polyline counts.
    expect(nearestPolyline(index, { x: 9, y: 20 }, 5)?.id).toBe("square");
    expect(nearestPolyline(index, { x: 81, y: 80 }, 5)?.id).toBe("dot");
  });

  it("returns null beyond the radius, and on an empty set", () => {
    expect(nearestPolyline(index, { x: 50, y: 60 }, 5)).toBeNull();
    expect(nearestPolyline(buildPolylineIndex([]), { x: 0, y: 0 }, 100)).toBeNull();
  });

  it("does not join the last point of an open polyline to its first", () => {
    const open = buildPolylineIndex([{ id: "u", points: [10, 10, 30, 10, 30, 30, 10, 30] }]);
    expect(nearestPolyline(open, { x: 9, y: 20 }, 2)).toBeNull();
  });

  it("breaks exact ties towards the earlier polyline", () => {
    const twins = buildPolylineIndex([
      { id: "a", points: [0, 0, 10, 0] },
      { id: "b", points: [0, 0, 10, 0] },
    ]);
    expect(nearestPolyline(twins, { x: 5, y: 1 }, 3)?.id).toBe("a");
  });
});

describe("polylinesInRect", () => {
  const index = buildPolylineIndex([SQUARE, LINE, DOT]);

  it("catches a line crossing the band with no vertex inside it", () => {
    expect(polylinesInRect(index, { x: 45, y: 40, width: 10, height: 20 })).toEqual([7]);
  });

  it("returns ids in input order and nothing for an empty band", () => {
    expect(polylinesInRect(index, { x: 0, y: 0, width: 200, height: 200 })).toEqual(["square", 7, "dot"]);
    expect(polylinesInRect(index, { x: 150, y: 150, width: 10, height: 10 })).toEqual([]);
  });
});

describe("agreement with brute force (seeded sweep)", () => {
  let seed = 99;
  const random = () => {
    seed = (seed * 1103515245 + 12345) % 2 ** 31;
    return seed / 2 ** 31;
  };
  const items: Polyline[] = Array.from({ length: 120 }, (_, i) => {
    const n = 1 + Math.floor(random() * 12);
    let x = random() * 800;
    let y = random() * 600;
    const points: number[] = [];
    for (let k = 0; k < n; k++) {
      points.push(x, y);
      x += (random() - 0.5) * 80;
      y += (random() - 0.5) * 80;
    }
    return { id: i, points, closed: random() < 0.3 };
  });
  const index = buildPolylineIndex(items, 24);

  const segDistance = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
    const dx = bx - ax;
    const dy = by - ay;
    const l = dx * dx + dy * dy;
    const t = l > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l)) : 0;
    return Math.hypot(ax + t * dx - px, ay + t * dy - py);
  };
  const distanceTo = (item: Polyline, x: number, y: number) => {
    const p = item.points;
    const n = p.length / 2;
    if (n === 1) return Math.hypot(p[0]! - x, p[1]! - y);
    let best = Infinity;
    const count = item.closed ? n : n - 1;
    for (let s = 0; s < count; s++) {
      const b = (s + 1) % n;
      best = Math.min(best, segDistance(x, y, p[2 * s]!, p[2 * s + 1]!, p[2 * b]!, p[2 * b + 1]!));
    }
    return best;
  };

  it("nearestPolyline matches an exhaustive search", () => {
    for (let q = 0; q < 1500; q++) {
      const x = random() * 900 - 50;
      const y = random() * 700 - 50;
      const radius = 1 + random() * 30;
      let bestId: number | null = null;
      let bestD = radius;
      items.forEach((item) => {
        const d = distanceTo(item, x, y);
        if (d < bestD - 1e-9) {
          bestD = d;
          bestId = item.id as number;
        }
      });
      const hit = nearestPolyline(index, { x, y }, radius);
      if (bestId === null) {
        expect(hit === null || hit.distance >= radius - 1e-6).toBe(true);
      } else {
        expect(hit).not.toBeNull();
        expect(hit!.distance).toBeCloseTo(bestD, 6);
      }
    }
  });

  it("polylinesInRect matches an exhaustive search", () => {
    const touches = (item: Polyline, r: Rect) => {
      // Dense sampling along each segment is enough for the brute-force reference.
      const p = item.points;
      const n = p.length / 2;
      const count = n === 1 ? 1 : item.closed ? n : n - 1;
      for (let s = 0; s < count; s++) {
        const b = n === 1 ? 0 : (s + 1) % n;
        for (let t = 0; t <= 1; t += 1 / 64) {
          const x = p[2 * s]! + t * (p[2 * b]! - p[2 * s]!);
          const y = p[2 * s + 1]! + t * (p[2 * b + 1]! - p[2 * s + 1]!);
          if (x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height) return true;
        }
      }
      return false;
    };
    for (let q = 0; q < 300; q++) {
      const r = { x: random() * 800, y: random() * 600, width: random() * 200, height: random() * 200 };
      const expected = items.filter((item) => touches(item, r)).map((item) => item.id);
      const got = polylinesInRect(index, r);
      // Sampling can miss a corner graze the exact clip finds; never the other way round.
      for (const id of expected) expect(got).toContain(id);
    }
  });
});
