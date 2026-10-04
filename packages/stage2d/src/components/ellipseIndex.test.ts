import { describe, expect, it } from "vitest";

import {
  buildEllipseIndex,
  distanceToEllipse,
  ellipseBounds,
  ellipsesInRect,
  nearestEllipse,
  pointInEllipse,
  type Ellipse,
} from "./ellipseIndex";

const ROUND: Ellipse = { id: "round", x: 50, y: 50, rx: 20, ry: 20 };
const WIDE: Ellipse = { id: "wide", x: 200, y: 50, rx: 40, ry: 10 };
const TURNED: Ellipse = { id: "turned", x: 200, y: 150, rx: 40, ry: 10, angle: Math.PI / 2 };

describe("ellipseBounds", () => {
  it("is the centre plus the semi-axes for an unrotated ellipse", () => {
    expect(ellipseBounds(WIDE)).toEqual([160, 40, 240, 60]);
  });

  it("swaps the extents for a quarter turn", () => {
    const [x0, y0, x1, y1] = ellipseBounds(TURNED)!;
    expect([x0, y0, x1, y1].map((v) => Math.round(v * 1e6) / 1e6)).toEqual([190, 110, 210, 190]);
  });

  it("is null for a degenerate ellipse", () => {
    expect(ellipseBounds({ id: 1, x: 0, y: 0, rx: 0, ry: 3 })).toBeNull();
    expect(ellipseBounds({ id: 1, x: 0, y: 0, rx: 3, ry: -1 })).toBeNull();
    expect(ellipseBounds({ id: 1, x: Number.NaN, y: 0, rx: 3, ry: 1 })).toBeNull();
  });
});

describe("pointInEllipse", () => {
  it("follows the rotated frame", () => {
    expect(pointInEllipse(WIDE, 230, 50)).toBe(true);
    expect(pointInEllipse(WIDE, 200, 65)).toBe(false);
    expect(pointInEllipse(TURNED, 200, 185)).toBe(true);
    expect(pointInEllipse(TURNED, 230, 150)).toBe(false);
  });
  it("is false for a degenerate ellipse", () => {
    expect(pointInEllipse({ id: 1, x: 0, y: 0, rx: 0, ry: 1 }, 0, 0)).toBe(false);
  });
});

describe("distanceToEllipse", () => {
  it("is exact for a circle", () => {
    expect(distanceToEllipse(ROUND, 80, 50)).toBeCloseTo(10, 9);
    expect(distanceToEllipse(ROUND, 50, 50)).toBeCloseTo(20, 9);
    expect(distanceToEllipse(ROUND, 55, 50)).toBeCloseTo(15, 9);
  });
  it("is exact along an axis", () => {
    expect(distanceToEllipse(WIDE, 250, 50)).toBeCloseTo(10, 9);
    expect(distanceToEllipse(WIDE, 200, 70)).toBeCloseTo(10, 9);
  });
  it("is Infinity for a degenerate ellipse", () => {
    expect(distanceToEllipse({ id: 1, x: 0, y: 0, rx: 0, ry: 1 }, 0, 0)).toBe(Infinity);
  });
});

describe("nearestEllipse", () => {
  const index = buildEllipseIndex([ROUND, WIDE, TURNED]);

  it("picks an ellipse whose outline is within the radius, and reports the distance", () => {
    const hit = nearestEllipse(index, { x: 73, y: 50 }, 5);
    expect(hit).toMatchObject({ id: "round", index: 0, inside: false });
    expect(hit!.distance).toBeCloseTo(3, 9);
  });

  it("picks a containing ellipse when no outline is near", () => {
    expect(nearestEllipse(index, { x: 50, y: 50 }, 2)).toMatchObject({ id: "round", inside: true });
  });

  it("prefers a nearby outline over a containing ellipse", () => {
    const nested = buildEllipseIndex([
      { id: "outer", x: 0, y: 0, rx: 100, ry: 100 },
      { id: "inner", x: 0, y: 0, rx: 30, ry: 30 },
    ]);
    // On the inner ring's outline, inside the outer ellipse.
    expect(nearestEllipse(nested, { x: 31, y: 0 }, 3)!.id).toBe("inner");
    // Inside both, away from either outline: the smaller wins.
    expect(nearestEllipse(nested, { x: 0, y: 5 }, 3)!.id).toBe("inner");
    // Between the two: only the outer contains it.
    expect(nearestEllipse(nested, { x: 60, y: 0 }, 3)!.id).toBe("outer");
  });

  it("breaks an exact tie by the smaller ellipse, then the earlier one", () => {
    const tied = buildEllipseIndex([
      { id: "a", x: 0, y: 0, rx: 10, ry: 10 },
      { id: "b", x: 0, y: 0, rx: 10, ry: 10 },
    ]);
    expect(nearestEllipse(tied, { x: 12, y: 0 }, 3)!.id).toBe("a");
  });

  it("returns null away from every ellipse, for a negative radius, and for no ellipses", () => {
    expect(nearestEllipse(index, { x: 400, y: 400 }, 5)).toBeNull();
    expect(nearestEllipse(index, { x: 50, y: 50 }, -1)).toBeNull();
    expect(nearestEllipse(buildEllipseIndex([]), { x: 0, y: 0 }, 5)).toBeNull();
  });

  it("never picks a degenerate ellipse", () => {
    const bad = buildEllipseIndex([{ id: "bad", x: 0, y: 0, rx: 0, ry: 5 }, { id: "ok", x: 0, y: 0, rx: 5, ry: 5 }]);
    expect(nearestEllipse(bad, { x: 0, y: 0 }, 3)!.id).toBe("ok");
  });
});

describe("ellipsesInRect", () => {
  const index = buildEllipseIndex([ROUND, WIDE, TURNED]);

  it("finds an ellipse the rectangle crosses, contains, or lies inside", () => {
    expect(ellipsesInRect(index, { x: 25, y: 45, width: 10, height: 10 })).toEqual(["round"]); // crosses the outline
    expect(ellipsesInRect(index, { x: 0, y: 0, width: 100, height: 100 })).toEqual(["round"]); // contains it
    expect(ellipsesInRect(index, { x: 48, y: 48, width: 4, height: 4 })).toEqual(["round"]); // inside it
  });

  it("is exact where the bounding boxes overlap but the shapes do not", () => {
    // The top-left corner of the round ellipse's box is outside the circle.
    expect(ellipsesInRect(index, { x: 30, y: 30, width: 3, height: 3 })).toEqual([]);
  });

  it("finds an edge crossing with every corner outside", () => {
    expect(ellipsesInRect(index, { x: 195, y: 0, width: 10, height: 100 })).toEqual(["wide"]);
  });

  it("reads a negative extent as the box between its corners, and returns ids in item order", () => {
    expect(ellipsesInRect(index, { x: 260, y: 200, width: -260, height: -200 })).toEqual(["round", "wide", "turned"]);
  });
});
