import { describe, expect, it } from "vitest";

import { arcLengths, deformContour, eraseArc, normalAtArc, pointAtArc, projectToArc, subPath } from "./contourArc";
import type { Point } from "./measureGeometry";

/** An L: 30 px right, then 40 px down. Length 70. */
const L: Point[] = [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 40 }];
/** A 10 × 10 square, clockwise on screen. Perimeter 40. */
const SQUARE: Point[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];

const near = (a: Point, b: Point) => {
  expect(a.x).toBeCloseTo(b.x, 9);
  expect(a.y).toBeCloseTo(b.y, 9);
};

describe("arcLengths", () => {
  it("accumulates segment lengths, with the closing segment for a closed path", () => {
    expect(arcLengths(L)).toEqual([0, 30, 70]);
    expect(arcLengths(L, true)).toEqual([0, 30, 70, 120]);
    expect(arcLengths(SQUARE, true)).toEqual([0, 10, 20, 30, 40]);
    expect(arcLengths([])).toEqual([]);
    expect(arcLengths([{ x: 3, y: 4 }])).toEqual([0]);
    expect(arcLengths([{ x: 3, y: 4 }], true)).toEqual([0, 0]);
  });
});

describe("pointAtArc", () => {
  it("interpolates along the segment the length falls on", () => {
    near(pointAtArc(L, 15), { x: 15, y: 0 });
    near(pointAtArc(L, 30), { x: 30, y: 0 });
    near(pointAtArc(L, 50), { x: 30, y: 20 });
  });

  it("clamps an open path and wraps a closed one", () => {
    near(pointAtArc(L, -5), { x: 0, y: 0 });
    near(pointAtArc(L, 500), { x: 30, y: 40 });
    near(pointAtArc(SQUARE, 45, true), { x: 5, y: 0 });
    near(pointAtArc(SQUARE, -5, true), { x: 0, y: 5 });
    near(pointAtArc(SQUARE, 40, true), { x: 0, y: 0 });
    near(pointAtArc(SQUARE, 35, true), { x: 0, y: 5 });
  });

  it("handles paths with no length", () => {
    expect(pointAtArc([], 3).x).toBeNaN();
    near(pointAtArc([{ x: 2, y: 3 }], 10), { x: 2, y: 3 });
    near(pointAtArc([{ x: 2, y: 3 }, { x: 2, y: 3 }], 10, true), { x: 2, y: 3 });
  });
});

describe("projectToArc", () => {
  it("finds the nearest place and its arc length", () => {
    const hit = projectToArc(L, { x: 35, y: 25 });
    expect(hit.s).toBeCloseTo(55, 9);
    near(hit.point, { x: 30, y: 25 });
    expect(hit.distance).toBeCloseTo(5, 9);
  });

  it("uses the closing segment only when closed", () => {
    const p = { x: 15, y: 25 };
    // Open: the nearest place is on the second segment.
    expect(projectToArc(L, p).s).toBeCloseTo(55, 9);
    // Closed: the segment back from (30, 40) to the origin passes closer.
    const closed = projectToArc(L, p, true);
    expect(closed.distance).toBeLessThan(15);
    expect(closed.s).toBeGreaterThan(70);
  });

  it("answers an empty path with nothing near", () => {
    const none = projectToArc([], { x: 1, y: 1 });
    expect(none.distance).toBe(Infinity);
    expect(none.point.x).toBeNaN();
  });
});

describe("subPath", () => {
  it("takes the ends and every vertex between", () => {
    expect(subPath(L, 10, 50)).toEqual([{ x: 10, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 20 }]);
    // Backwards on an open path: the same stretch, run forward.
    expect(subPath(L, 50, 10)).toEqual([{ x: 10, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 20 }]);
    expect(subPath(L, 20, 20)).toEqual([{ x: 20, y: 0 }, { x: 20, y: 0 }]);
    expect(subPath([], 0, 1)).toEqual([]);
  });

  it("wraps past the first vertex of a closed path", () => {
    expect(subPath(SQUARE, 35, 5, true)).toEqual([{ x: 0, y: 5 }, { x: 0, y: 0 }, { x: 5, y: 0 }]);
    expect(subPath(SQUARE, 0, 40, true)).toEqual([...SQUARE, { x: 0, y: 0 }]);
    expect(subPath(SQUARE, 45, 52, true)).toEqual([{ x: 5, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 2 }]);
  });
});

describe("normalAtArc", () => {
  it("turns the tangent clockwise on screen", () => {
    near(normalAtArc(L, 10), { x: 0, y: 1 });
    near(normalAtArc(L, 50), { x: -1, y: 0 });
    // At a vertex, the segment that starts there; at the end, the last segment.
    near(normalAtArc(L, 30), { x: -1, y: 0 });
    near(normalAtArc(L, 70), { x: -1, y: 0 });
    // A clockwise square's normals point inward.
    near(normalAtArc(SQUARE, 35, true), { x: 1, y: 0 });
  });

  it("skips segments with no length, and has no normal without a length", () => {
    const stutter = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }];
    near(normalAtArc(stutter, 0), { x: 0, y: 1 });
    const tail = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 0 }];
    near(normalAtArc(tail, 10), { x: 0, y: 1 });
    expect(normalAtArc([{ x: 1, y: 1 }, { x: 1, y: 1 }], 0)).toEqual({ x: 0, y: 0 });
    expect(normalAtArc([{ x: 1, y: 1 }], 0)).toEqual({ x: 0, y: 0 });
  });
});

describe("deformContour", () => {
  const line: Point[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }];

  it("divides the segments under the brush, then pushes them with a cosine falloff", () => {
    const out = deformContour(line, { x: 50, y: 0 }, { x: 0, y: 10 }, 20);
    // Divided every 20 / 4 = 5 px.
    expect(out).toHaveLength(21);
    const peak = out.find((p) => p.x === 50)!;
    expect(peak.y).toBeCloseTo(10, 9);
    // Half way out, half the push; at the rim and beyond, none.
    expect(out.find((p) => p.x === 40)!.y).toBeCloseTo(5, 9);
    expect(out.find((p) => p.x === 30)!.y).toBe(0);
    expect(out[0]).toEqual({ x: 0, y: 0 });
    expect(out.at(-1)).toEqual({ x: 100, y: 0 });
  });

  it("leaves segments the brush does not reach undivided, and divides the closing segment of a closed path", () => {
    const far = deformContour(line, { x: 50, y: 50 }, { x: 0, y: 10 }, 20);
    expect(far).toEqual(line);
    const tri: Point[] = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 0, y: 40 }];
    // The brush sits on the closing segment, from (0, 40) back to (0, 0).
    const out = deformContour(tri, { x: 0, y: 20 }, { x: 5, y: 0 }, 8, true);
    expect(out.slice(0, 3)).toEqual(tri);
    expect(out.length).toBeGreaterThan(3);
    for (const p of out.slice(3)) expect(p.x).toBeGreaterThanOrEqual(0);
  });

  it("copies the path for a brush with no radius", () => {
    const out = deformContour(line, { x: 50, y: 0 }, { x: 0, y: 10 }, 0);
    expect(out).toEqual(line);
    expect(out[0]).not.toBe(line[0]);
  });
});

describe("eraseArc", () => {
  it("leaves up to two pieces of an open path", () => {
    expect(eraseArc(L, 10, 50)).toEqual([
      [{ x: 0, y: 0 }, { x: 10, y: 0 }],
      [{ x: 30, y: 20 }, { x: 30, y: 40 }],
    ]);
    // Reaching an end leaves one piece; erasing everything leaves none.
    expect(eraseArc(L, 0, 50)).toEqual([[{ x: 30, y: 20 }, { x: 30, y: 40 }]]);
    expect(eraseArc(L, 50, -10)).toEqual([[{ x: 30, y: 20 }, { x: 30, y: 40 }]]);
    expect(eraseArc(L, 0, 70)).toEqual([]);
    expect(eraseArc([], 0, 1)).toEqual([]);
  });

  it("opens a closed path into one piece, from the end of the stretch round to its start", () => {
    expect(eraseArc(SQUARE, 5, 15, true)).toEqual([
      [{ x: 10, y: 5 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 0, y: 0 }, { x: 5, y: 0 }],
    ]);
    // Across the first vertex.
    expect(eraseArc(SQUARE, 35, 5, true)).toEqual([[{ x: 5, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 0, y: 5 }]]);
    // An empty stretch cuts it open there.
    expect(eraseArc(SQUARE, 15, 15, true)).toEqual([
      [{ x: 10, y: 5 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 }],
    ]);
  });
});
