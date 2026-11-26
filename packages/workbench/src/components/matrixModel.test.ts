import { describe, expect, it } from "vitest";

import { inRect, moveFocus, rectBetween, revealScroll, windowRange } from "./matrixModel";

const size = { rows: 5, cols: 4 };

describe("moveFocus", () => {
  it("moves one cell with the arrows and stops at the edges", () => {
    expect(moveFocus({ row: 2, col: 2 }, "ArrowUp", size, 3)).toEqual({ row: 1, col: 2 });
    expect(moveFocus({ row: 2, col: 2 }, "ArrowDown", size, 3)).toEqual({ row: 3, col: 2 });
    expect(moveFocus({ row: 2, col: 2 }, "ArrowLeft", size, 3)).toEqual({ row: 2, col: 1 });
    expect(moveFocus({ row: 2, col: 2 }, "ArrowRight", size, 3)).toEqual({ row: 2, col: 3 });
    expect(moveFocus({ row: 0, col: 0 }, "ArrowUp", size, 3)).toEqual({ row: 0, col: 0 });
    expect(moveFocus({ row: 0, col: 0 }, "ArrowLeft", size, 3)).toEqual({ row: 0, col: 0 });
    expect(moveFocus({ row: 4, col: 3 }, "ArrowDown", size, 3)).toEqual({ row: 4, col: 3 });
    expect(moveFocus({ row: 4, col: 3 }, "ArrowRight", size, 3)).toEqual({ row: 4, col: 3 });
  });

  it("goes to the ends of the row with Home and End, and of the grid with Ctrl", () => {
    expect(moveFocus({ row: 2, col: 2 }, "Home", size, 3)).toEqual({ row: 2, col: 0 });
    expect(moveFocus({ row: 2, col: 2 }, "End", size, 3)).toEqual({ row: 2, col: 3 });
    expect(moveFocus({ row: 2, col: 2 }, "Home", size, 3, true)).toEqual({ row: 0, col: 0 });
    expect(moveFocus({ row: 2, col: 2 }, "End", size, 3, true)).toEqual({ row: 4, col: 3 });
  });

  it("pages by rows, clamped, and at least one row", () => {
    expect(moveFocus({ row: 1, col: 1 }, "PageDown", size, 3)).toEqual({ row: 4, col: 1 });
    expect(moveFocus({ row: 4, col: 1 }, "PageDown", size, 3)).toEqual({ row: 4, col: 1 });
    expect(moveFocus({ row: 3, col: 1 }, "PageUp", size, 3)).toEqual({ row: 0, col: 1 });
    expect(moveFocus({ row: 3, col: 1 }, "PageUp", size, 0)).toEqual({ row: 2, col: 1 });
    expect(moveFocus({ row: 3, col: 1 }, "PageUp", size, 1.9)).toEqual({ row: 2, col: 1 });
  });

  it("ignores other keys and an empty grid", () => {
    expect(moveFocus({ row: 0, col: 0 }, "a", size, 3)).toBeNull();
    expect(moveFocus({ row: 0, col: 0 }, "ArrowDown", { rows: 0, cols: 3 }, 3)).toBeNull();
    expect(moveFocus({ row: 0, col: 0 }, "ArrowDown", { rows: 3, cols: 0 }, 3)).toBeNull();
  });

  it("brings a stale cursor back into the grid", () => {
    expect(moveFocus({ row: 40, col: 40 }, "ArrowLeft", size, 3)).toEqual({ row: 4, col: 3 });
  });
});

describe("windowRange", () => {
  it("covers the viewport plus the overscan, clamped to the count", () => {
    expect(windowRange(0, 100, 10, 1000, 2)).toEqual([0, 12]);
    expect(windowRange(500, 100, 10, 1000, 2)).toEqual([48, 62]);
    expect(windowRange(9_950, 100, 10, 1000, 2)).toEqual([993, 1000]);
  });

  it("includes a partly visible item at each end", () => {
    // Items 3 (30..40) and 12 (120..130) are cut by the viewport [35, 125].
    expect(windowRange(35, 90, 10, 100, 0)).toEqual([3, 13]);
  });

  it("is empty for nothing to show, and keeps the end when the scroll is past it", () => {
    expect(windowRange(0, 100, 10, 0, 2)).toEqual([0, 0]);
    expect(windowRange(0, 100, 0, 10, 2)).toEqual([0, 0]);
    expect(windowRange(0, 0, 10, 10, 0)).toEqual([0, 0]);
    expect(windowRange(1_000_000, 100, 10, 50, 0)).toEqual([49, 50]);
    expect(windowRange(-50, 100, 10, 50, 1)).toEqual([0, 11]);
  });

  it("never asks for more than the count, however large the viewport", () => {
    expect(windowRange(0, 1e9, 10, 7, 3)).toEqual([0, 7]);
  });
});

describe("revealScroll", () => {
  it("leaves the scroll where it is when the item is in view", () => {
    expect(revealScroll(100, 100, 12, 10)).toBe(100);
  });

  it("moves up to an item above and down to one below, by the least", () => {
    expect(revealScroll(100, 100, 5, 10)).toBe(50);
    expect(revealScroll(100, 100, 25, 10)).toBe(160);
    expect(revealScroll(0, 100, 0, 10)).toBe(0);
  });

  it("never goes negative, and fits an item larger than the viewport at its start", () => {
    expect(revealScroll(10, 5, 0, 10)).toBe(0);
    expect(revealScroll(0, 5, 3, 10)).toBe(35);
  });
});

describe("rectBetween / inRect", () => {
  it("orders the corners", () => {
    expect(rectBetween({ row: 4, col: 1 }, { row: 2, col: 3 })).toEqual({ row0: 2, row1: 4, col0: 1, col1: 3 });
  });

  it("tests a cell inclusively, and null contains nothing", () => {
    const rect = rectBetween({ row: 1, col: 1 }, { row: 2, col: 2 });
    expect(inRect(rect, 1, 1)).toBe(true);
    expect(inRect(rect, 2, 2)).toBe(true);
    expect(inRect(rect, 3, 2)).toBe(false);
    expect(inRect(rect, 1, 0)).toBe(false);
    expect(inRect(null, 0, 0)).toBe(false);
  });
});
