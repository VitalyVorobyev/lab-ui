import { describe, expect, it } from "vitest";

import { MAX_FORCED_LABELS, MAX_LABELS, pickLabelIndices, visibleRect } from "./labelLod";

describe("visibleRect", () => {
  it("is the part of the image on screen", () => {
    expect(visibleRect({ scale: 2, tx: -100, ty: -40 }, { width: 400, height: 300 })).toEqual({ x: 50, y: 20, width: 200, height: 150 });
  });

  it("is null before the viewport is measured or for a degenerate scale", () => {
    expect(visibleRect({ scale: 1, tx: 0, ty: 0 }, { width: 0, height: 0 })).toBeNull();
    expect(visibleRect({ scale: 0, tx: 0, ty: 0 }, { width: 10, height: 10 })).toBeNull();
  });
});

describe("pickLabelIndices", () => {
  const all = () => true;

  it("puts the forced labels first, then the spaced ones, without repeats", () => {
    expect(pickLabelIndices([1, 2, 3], [3, 7], all)).toEqual([3, 7, 1, 2]);
  });

  it("keeps only what is in view, forced or not", () => {
    expect(pickLabelIndices([1, 2, 3], [4], (i) => i % 2 === 0)).toEqual([4, 2]);
    expect(pickLabelIndices([], [-1], all)).toEqual([]);
  });

  it("caps the labels at 200, and the forced ones at 50", () => {
    const many = Array.from({ length: 500 }, (_, i) => i);
    expect(pickLabelIndices(many, [], all)).toHaveLength(MAX_LABELS);
    const forced = pickLabelIndices(many, many.slice(0, 100).map((i) => i + 1000), all);
    expect(forced.filter((i) => i >= 1000)).toHaveLength(MAX_FORCED_LABELS);
    expect(forced).toHaveLength(MAX_LABELS);
  });
});
