import { describe, expect, it } from "vitest";

import { TAP_MS, TAP_SLOP, centroid, isTap, panButtonCodes, pinchView } from "./gesture";
import { toImage } from "./view";

describe("panButtonCodes", () => {
  it("defaults to left and middle, the stage's long-standing behaviour", () => {
    expect([...panButtonCodes(undefined)].sort()).toEqual([0, 1]);
  });

  it("names one button or a list", () => {
    expect([...panButtonCodes("right")]).toEqual([2]);
    expect([...panButtonCodes(["middle", "right"])].sort()).toEqual([1, 2]);
    expect(panButtonCodes([]).size).toBe(0);
  });
});

describe("centroid", () => {
  it("is the midpoint", () => {
    expect(centroid({ x: 0, y: 10 }, { x: 20, y: 30 })).toEqual({ x: 10, y: 20 });
  });
});

describe("pinchView", () => {
  const start = { scale: 1, tx: 10, ty: 20 };
  const range = [0.1, 8] as const;

  it("scales by the spread of the fingers", () => {
    const view = pinchView(start, 100, { x: 200, y: 150 }, 200, { x: 200, y: 150 }, range);
    expect(view.scale).toBe(2);
  });

  it("keeps the image point under the first midpoint under the current one", () => {
    const c0 = { x: 200, y: 150 };
    const c = { x: 260, y: 120 };
    const view = pinchView(start, 80, c0, 200, c, range);
    const held = toImage(start, c0);
    const now = toImage(view, c);
    expect(now.x).toBeCloseTo(held.x, 9);
    expect(now.y).toBeCloseTo(held.y, 9);
    expect(view.scale).toBeCloseTo(2.5, 9);
  });

  it("only pans when the fingers keep their distance", () => {
    const view = pinchView(start, 100, { x: 0, y: 0 }, 100, { x: 30, y: -5 }, range);
    expect(view).toEqual({ scale: 1, tx: 40, ty: 15 });
  });

  it("stays inside the scale range, still anchored", () => {
    const c0 = { x: 100, y: 100 };
    const view = pinchView(start, 10, c0, 1000, c0, range);
    expect(view.scale).toBe(8);
    const held = toImage(start, c0);
    expect(toImage(view, c0).x).toBeCloseTo(held.x, 9);
    expect(pinchView(start, 1000, c0, 1, c0, range).scale).toBe(0.1);
  });

  it("holds the scale when the fingers started on top of each other", () => {
    expect(pinchView(start, 0, { x: 0, y: 0 }, 50, { x: 0, y: 0 }, range).scale).toBe(1);
  });
});

describe("isTap", () => {
  it("is a short touch that stayed put", () => {
    expect(isTap(0, 120)).toBe(true);
    expect(isTap(TAP_SLOP, TAP_MS)).toBe(true);
  });

  it("is not a touch that travelled or lingered", () => {
    expect(isTap(TAP_SLOP + 0.1, 100)).toBe(false);
    expect(isTap(0, TAP_MS + 1)).toBe(false);
  });
});
