import { describe, expect, it } from "vitest";

import { MARKER_SHAPES, circlePath, type BuiltinMarkerKind } from "./markerShapes";

/** Every number in a path, in order. */
const numbers = (d: string) => (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

describe("circlePath", () => {
  it("is two arcs of the given radius around the centre", () => {
    expect(circlePath(10, 20, 4)).toBe("M14 20a4 4 0 1 0 -8 0a4 4 0 1 0 8 0");
  });
});

describe("built-in markers", () => {
  const kinds = Object.keys(MARKER_SHAPES) as BuiltinMarkerKind[];

  it("covers the overlay grammar's kinds", () => {
    expect(kinds.sort()).toEqual(["cross", "directed", "dot", "hollow", "plus", "square"]);
  });

  it("draws a dot as a zero-length segment whose stroke is its size, independent of zoom", () => {
    expect(MARKER_SHAPES.dot.paint).toBe("disc");
    expect(MARKER_SHAPES.dot.size).toBe(2.5);
    expect(MARKER_SHAPES.dot.path(5, 6, 1, 0)).toBe("M5 6h0");
    expect(MARKER_SHAPES.dot.path(5, 6, 99, 1)).toBe("M5 6h0");
  });

  it("draws a plus with 5 screen-px arms", () => {
    // At 4 image px per screen px the arms are 20 image px.
    expect(MARKER_SHAPES.plus.path(100, 50, 4, 0)).toBe("M80 50h40M100 30v40");
    expect(MARKER_SHAPES.plus.path(100, 50, 0.5, 0)).toBe("M97.5 50h5M100 47.5v5");
  });

  it("draws a hollow circle of radius 4 px in the model role", () => {
    expect(MARKER_SHAPES.hollow.role).toBe("model");
    expect(MARKER_SHAPES.hollow.path(10, 10, 2, 0)).toBe(circlePath(10, 10, 8));
  });

  it("draws a cross and a square about the centre", () => {
    expect(MARKER_SHAPES.cross.path(10, 10, 1, 0)).toBe("M6 6l8 8M6 14l8 -8");
    expect(MARKER_SHAPES.square.path(10, 10, 2, 0)).toBe("M3 3h14v14h-14Z");
  });

  it("points a directed marker's tick along its angle", () => {
    const along = (angle: number) => numbers(MARKER_SHAPES.directed.path(0, 0, 1, angle)).slice(-2);
    expect(along(0)[0]).toBeCloseTo(8, 3);
    expect(along(0)[1]).toBeCloseTo(0, 3);
    expect(along(Math.PI / 2)[0]).toBeCloseTo(0, 3);
    expect(along(Math.PI / 2)[1]).toBeCloseTo(8, 3);
  });

  it("scales every outline with the unit, so it stays the same size on screen", () => {
    const extent = (d: string) => Math.max(...numbers(d).map(Math.abs));
    for (const kind of kinds) {
      const shape = MARKER_SHAPES[kind];
      if (shape.paint === "disc") continue;
      expect(extent(shape.path(0, 0, 3, 0.4)) / extent(shape.path(0, 0, 1, 0.4))).toBeCloseTo(3, 2);
    }
  });
});
