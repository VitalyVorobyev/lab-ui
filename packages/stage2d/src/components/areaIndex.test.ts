import { describe, expect, it } from "vitest";

import {
  areaCentre,
  areaPath,
  areasInRect,
  buildAreaIndex,
  distanceToOutline,
  nearestArea,
  pointInPolygon,
  polygonArea,
  type Area,
} from "./areaIndex";

const SQUARE: Area = { id: "square", points: [10, 10, 30, 10, 30, 30, 10, 30] };
const BIG: Area = { id: "big", points: [0, 0, 100, 0, 100, 100, 0, 100] };
const TRIANGLE: Area = { id: 3, points: [200, 10, 240, 10, 220, 40] };
const SEGMENT: Area = { id: "segment", points: [150, 150, 190, 150] };
const DOT: Area = { id: "dot", points: [180, 180] };

describe("pointInPolygon", () => {
  it("separates inside from outside by the even-odd rule", () => {
    expect(pointInPolygon(SQUARE.points, 20, 20)).toBe(true);
    expect(pointInPolygon(SQUARE.points, 5, 20)).toBe(false);
    expect(pointInPolygon(SQUARE.points, 20, 35)).toBe(false);
    expect(pointInPolygon(TRIANGLE.points, 220, 20)).toBe(true);
    expect(pointInPolygon(TRIANGLE.points, 205, 35)).toBe(false);
  });

  it("is false for a ring with fewer than three vertices", () => {
    expect(pointInPolygon(SEGMENT.points, 170, 150)).toBe(false);
    expect(pointInPolygon(DOT.points, 180, 180)).toBe(false);
    expect(pointInPolygon([], 0, 0)).toBe(false);
  });

  it("treats a concave ring's notch as outside", () => {
    const u = [0, 0, 30, 0, 30, 30, 20, 30, 20, 10, 10, 10, 10, 30, 0, 30];
    expect(pointInPolygon(u, 5, 20)).toBe(true);
    expect(pointInPolygon(u, 15, 20)).toBe(false);
    expect(pointInPolygon(u, 25, 20)).toBe(true);
  });
});

describe("distanceToOutline and polygonArea", () => {
  it("measures to the nearest edge, the closing edge included", () => {
    expect(distanceToOutline(SQUARE.points, 20, 20)).toBe(10);
    expect(distanceToOutline(SQUARE.points, 5, 20)).toBe(5);
    expect(distanceToOutline(SQUARE.points, 10, 35)).toBe(5);
    expect(distanceToOutline(SEGMENT.points, 170, 155)).toBe(5);
    expect(distanceToOutline(DOT.points, 183, 184)).toBe(5);
    expect(distanceToOutline([], 0, 0)).toBe(Infinity);
  });

  it("computes the unsigned shoelace area", () => {
    expect(polygonArea(SQUARE.points)).toBe(400);
    expect(polygonArea([10, 10, 10, 30, 30, 30, 30, 10])).toBe(400);
    expect(polygonArea(TRIANGLE.points)).toBe(600);
    expect(polygonArea(SEGMENT.points)).toBe(0);
  });
});

describe("areaPath and areaCentre", () => {
  it("closes the ring and winds it the same way whichever way it came", () => {
    expect(areaPath(SQUARE.points)).toBe("M10 10L30 10L30 30L10 30Z");
    // The same square given the other way round is wound back, still from its first vertex.
    expect(areaPath([10, 10, 10, 30, 30, 30, 30, 10])).toBe("M10 10L30 10L30 30L10 30Z");
    expect(areaPath(DOT.points)).toBe("M180 180h0");
    expect(areaPath(SEGMENT.points)).toBe("M150 150L190 150Z");
    expect(areaPath([])).toBe("");
  });

  it("puts the label at the mean of the vertices", () => {
    expect(areaCentre(SQUARE.points)).toEqual({ x: 20, y: 20 });
    expect(areaCentre([])).toBeNull();
  });
});

describe("nearestArea", () => {
  const index = buildAreaIndex([BIG, SQUARE, TRIANGLE, SEGMENT, DOT]);

  it("picks the area containing the point", () => {
    expect(nearestArea(index, { x: 220, y: 20 }, 3)).toMatchObject({ id: 3, inside: true });
    expect(nearestArea(index, { x: 60, y: 60 }, 3)).toMatchObject({ id: "big", inside: true, distance: 40 });
  });

  it("prefers the smaller of nested areas", () => {
    expect(nearestArea(index, { x: 20, y: 20 }, 3)?.id).toBe("square");
  });

  it("lets an outline within the radius beat an interior", () => {
    // Inside the big region, 2 px outside the square's edge: the square's outline is what was aimed at.
    const hit = nearestArea(index, { x: 32, y: 20 }, 4);
    expect(hit).toMatchObject({ id: "square", inside: false, distance: 2 });
    // Beyond the radius, the containing region is the answer.
    expect(nearestArea(index, { x: 40, y: 20 }, 4)?.id).toBe("big");
  });

  it("picks an area by its outline from outside it, and degenerate rings by their line", () => {
    expect(nearestArea(index, { x: 105, y: 50 }, 6)).toMatchObject({ id: "big", inside: false, distance: 5 });
    expect(nearestArea(index, { x: 170, y: 153 }, 4)).toMatchObject({ id: "segment", inside: false, distance: 3 });
    expect(nearestArea(index, { x: 182, y: 180 }, 3)?.id).toBe("dot");
  });

  it("returns null away from everything, for a negative radius and on an empty set", () => {
    expect(nearestArea(index, { x: 300, y: 300 }, 5)).toBeNull();
    expect(nearestArea(index, { x: 20, y: 20 }, -1)).toBeNull();
    expect(nearestArea(buildAreaIndex([]), { x: 0, y: 0 }, 10)).toBeNull();
  });

  it("breaks an exact tie towards the smaller area, then the earlier one", () => {
    const twins = buildAreaIndex([
      { id: "a", points: [0, 0, 10, 0, 10, 10, 0, 10] },
      { id: "b", points: [0, 0, 10, 0, 10, 10, 0, 10] },
    ]);
    expect(nearestArea(twins, { x: 5, y: 5 }, 1)?.id).toBe("a");
    const nested = buildAreaIndex([
      { id: "outer", points: [0, 0, 20, 0, 20, 20, 0, 20] },
      { id: "inner", points: [10, 0, 30, 0, 30, 10, 10, 10] },
    ]);
    // On the shared edge x = 10..20 at y = 0 both outlines are at distance 0: the smaller wins.
    expect(nearestArea(nested, { x: 15, y: 0 }, 1)?.id).toBe("inner");
  });

  it("ignores rings with no finite vertex and keeps the grid bounded for a far outlier", () => {
    const messy = buildAreaIndex([
      { id: "nan", points: [Number.NaN, 0, Number.NaN, 5] },
      { id: "ok", points: [0, 0, 4, 0, 4, 4, 0, 4] },
      { id: "far", points: [1e9, 1e9, 1e9 + 4, 1e9, 1e9 + 4, 1e9 + 4] },
    ]);
    expect(messy.cols * messy.rows).toBeLessThanOrEqual(4_000_000);
    expect(nearestArea(messy, { x: 2, y: 2 }, 1)?.id).toBe("ok");
    expect(nearestArea(messy, { x: 1e9 + 3, y: 1e9 + 1 }, 1)?.id).toBe("far");
    expect(nearestArea(buildAreaIndex([{ id: "nan", points: [Number.NaN, Number.NaN] }]), { x: 0, y: 0 }, 9)).toBeNull();
  });

  it("indexes a polygon in every cell its box covers, so a large region is found from any of them", () => {
    const wide = buildAreaIndex([{ id: "wide", points: [0, 0, 1000, 0, 1000, 20, 0, 20] }, ...Array.from({ length: 20 }, (_, n): Area => ({ id: n, points: [n * 40 + 500, 200, n * 40 + 510, 200, n * 40 + 510, 210] }))], 16);
    expect(nearestArea(wide, { x: 990, y: 10 }, 1)?.id).toBe("wide");
    expect(nearestArea(wide, { x: 7, y: 10 }, 1)?.id).toBe("wide");
  });
});

describe("areasInRect", () => {
  const index = buildAreaIndex([BIG, SQUARE, TRIANGLE, SEGMENT, DOT]);

  it("finds areas with a vertex inside the band", () => {
    expect(areasInRect(index, { x: 195, y: 0, width: 60, height: 20 })).toEqual([3]);
  });

  it("finds an area whose edge crosses the band without a vertex inside it", () => {
    expect(areasInRect(index, { x: 40, y: 45, width: 20, height: 10 })).toEqual(["big"]);
    expect(areasInRect(index, { x: 165, y: 140, width: 5, height: 20 })).toEqual(["segment"]);
  });

  it("finds the area a band lies wholly inside of", () => {
    expect(areasInRect(index, { x: 40, y: 40, width: 10, height: 10 })).toEqual(["big"]);
    expect(areasInRect(index, { x: 15, y: 15, width: 5, height: 5 })).toEqual(["big", "square"]);
  });

  it("returns ids in the order given, reads a negative extent, and is empty away from everything", () => {
    expect(areasInRect(index, { x: 260, y: 60, width: -260, height: -60 })).toEqual(["big", "square", 3]);
    expect(areasInRect(index, { x: 300, y: 300, width: 10, height: 10 })).toEqual([]);
    expect(areasInRect(buildAreaIndex([]), { x: 0, y: 0, width: 10, height: 10 })).toEqual([]);
  });
});
