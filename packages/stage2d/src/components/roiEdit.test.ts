import { describe, expect, it } from "vitest";

import {
  ROI_HANDLES,
  clampRect,
  moveRect,
  rectFromCorners,
  resizeRect,
  roiHandlePoint,
  sameRect,
} from "./roiEdit";
import type { Rect } from "./stage/view";

const IMAGE: Rect = { x: 0, y: 0, width: 200, height: 100 };
const BOX: Rect = { x: 40, y: 20, width: 60, height: 30 };

describe("roiHandlePoint", () => {
  it("puts corners on corners and edges at their middles", () => {
    expect(roiHandlePoint(BOX, "nw")).toEqual({ x: 40, y: 20 });
    expect(roiHandlePoint(BOX, "n")).toEqual({ x: 70, y: 20 });
    expect(roiHandlePoint(BOX, "ne")).toEqual({ x: 100, y: 20 });
    expect(roiHandlePoint(BOX, "e")).toEqual({ x: 100, y: 35 });
    expect(roiHandlePoint(BOX, "se")).toEqual({ x: 100, y: 50 });
    expect(roiHandlePoint(BOX, "s")).toEqual({ x: 70, y: 50 });
    expect(roiHandlePoint(BOX, "sw")).toEqual({ x: 40, y: 50 });
    expect(roiHandlePoint(BOX, "w")).toEqual({ x: 40, y: 35 });
  });
});

describe("rectFromCorners", () => {
  it("normalises a box dragged in any direction", () => {
    const expected = { x: 10, y: 5, width: 20, height: 15 };
    expect(rectFromCorners({ x: 10, y: 5 }, { x: 30, y: 20 })).toEqual(expected);
    expect(rectFromCorners({ x: 30, y: 20 }, { x: 10, y: 5 })).toEqual(expected);
    expect(rectFromCorners({ x: 30, y: 5 }, { x: 10, y: 20 })).toEqual(expected);
  });
});

describe("clampRect", () => {
  it("keeps the box inside and at least minSize", () => {
    expect(clampRect({ x: -10, y: 90, width: 30, height: 30 }, IMAGE, 4)).toEqual({ x: 0, y: 70, width: 30, height: 30 });
    expect(clampRect({ x: 50, y: 50, width: 1, height: 0 }, IMAGE, 4)).toEqual({ x: 50, y: 50, width: 4, height: 4 });
    // Larger than the bounds: the bounds.
    expect(clampRect({ x: 0, y: 0, width: 500, height: 500 }, IMAGE, 4)).toEqual(IMAGE);
  });
});

describe("resizeRect", () => {
  it("moves only the dragged edges", () => {
    expect(resizeRect(BOX, "e", { x: 150, y: 999 }, IMAGE, 4)).toEqual({ x: 40, y: 20, width: 110, height: 30 });
    expect(resizeRect(BOX, "n", { x: 0, y: 10 }, IMAGE, 4)).toEqual({ x: 40, y: 10, width: 60, height: 40 });
    expect(resizeRect(BOX, "nw", { x: 30, y: 15 }, IMAGE, 4)).toEqual({ x: 30, y: 15, width: 70, height: 35 });
  });

  it("flips the box when an edge is dragged through its opposite", () => {
    // The west edge dragged past the east edge at 100: the box now spans 100..120.
    expect(resizeRect(BOX, "w", { x: 120, y: 0 }, IMAGE, 4)).toEqual({ x: 100, y: 20, width: 20, height: 30 });
  });

  it("stops at the bounds and at minSize", () => {
    expect(resizeRect(BOX, "se", { x: 999, y: 999 }, IMAGE, 4)).toEqual({ x: 40, y: 20, width: 160, height: 80 });
    expect(resizeRect(BOX, "e", { x: 41, y: 0 }, IMAGE, 4)).toEqual({ x: 40, y: 20, width: 4, height: 30 });
  });
});

describe("moveRect", () => {
  it("moves the whole box and stops at the bounds without resizing", () => {
    expect(moveRect(BOX, 10, 5, IMAGE)).toEqual({ x: 50, y: 25, width: 60, height: 30 });
    expect(moveRect(BOX, -500, 500, IMAGE)).toEqual({ x: 0, y: 70, width: 60, height: 30 });
  });
});

describe("sameRect", () => {
  it("compares within a tolerance, and nulls only with nulls", () => {
    expect(sameRect(BOX, { ...BOX, x: BOX.x + 1e-9 })).toBe(true);
    expect(sameRect(BOX, { ...BOX, width: 61 })).toBe(false);
    expect(sameRect(null, null)).toBe(true);
    expect(sameRect(BOX, null)).toBe(false);
  });
});

describe("invariants (seeded sweep)", () => {
  it("every resize and move stays inside the bounds and at least minSize", () => {
    let seed = 7;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed / 2 ** 31;
    };
    const within = (r: Rect) =>
      r.x >= IMAGE.x - 1e-9 &&
      r.y >= IMAGE.y - 1e-9 &&
      r.x + r.width <= IMAGE.x + IMAGE.width + 1e-9 &&
      r.y + r.height <= IMAGE.y + IMAGE.height + 1e-9 &&
      r.width >= 4 - 1e-9 &&
      r.height >= 4 - 1e-9;
    let box: Rect = BOX;
    for (let i = 0; i < 2000; i += 1) {
      const to = { x: random() * 400 - 100, y: random() * 300 - 100 };
      box =
        random() < 0.5
          ? resizeRect(box, ROI_HANDLES[Math.floor(random() * 8)]!, to, IMAGE, 4)
          : moveRect(box, to.x - 100, to.y - 50, IMAGE);
      expect(within(box)).toBe(true);
    }
  });
});
