import { describe, expect, it } from "vitest";

import { translatePoints } from "./useShapeDrag";

describe("translatePoints", () => {
  it("shifts x by dx and y by dy, leaving the input alone", () => {
    const points = [0, 0, 10, 5, -3, 4];
    expect(translatePoints(points, { x: 2, y: -1 })).toEqual([2, -1, 12, 4, -1, 3]);
    expect(points).toEqual([0, 0, 10, 5, -3, 4]);
  });

  it("accepts typed arrays and an empty ring", () => {
    expect(translatePoints(new Float32Array([1, 2]), { x: 1, y: 1 })).toEqual([2, 3]);
    expect(translatePoints([], { x: 5, y: 5 })).toEqual([]);
  });
});
