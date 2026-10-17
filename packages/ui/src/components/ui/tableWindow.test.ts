import { describe, expect, it } from "vitest";

import { navigate, rowWindow, scrollTopFor } from "./tableWindow";

const base = { rowCount: 5000, rowHeight: 32, headerHeight: 30, viewportHeight: 350, overscan: 0 };

describe("rowWindow", () => {
  it("renders the rows under the header at the top", () => {
    // 320 px of body: rows 0..9 exactly.
    expect(rowWindow({ ...base, scrollTop: 0 })).toEqual({ start: 0, end: 10, before: 0, after: 4990 * 32 });
  });

  it("includes partly visible rows at both edges", () => {
    // Body [16, 336): row 0 is half hidden under the header, row 10 half shown.
    expect(rowWindow({ ...base, scrollTop: 16 })).toMatchObject({ start: 0, end: 11 });
  });

  it("adds the overscan on each side, clamped to the rows", () => {
    expect(rowWindow({ ...base, scrollTop: 3200, overscan: 4 })).toMatchObject({ start: 96, end: 114 });
    expect(rowWindow({ ...base, scrollTop: 0, overscan: 4 })).toMatchObject({ start: 0, end: 14 });
    const end = rowWindow({ ...base, scrollTop: 5000 * 32 - 320, overscan: 4 });
    expect(end).toMatchObject({ start: 4986, end: 5000, after: 0 });
  });

  it("keeps the total height whatever the window", () => {
    const w = rowWindow({ ...base, scrollTop: 12345, overscan: 3 });
    expect(w.before + (w.end - w.start) * 32 + w.after).toBe(5000 * 32);
  });

  it("is empty for no rows or a degenerate row height", () => {
    expect(rowWindow({ ...base, rowCount: 0, scrollTop: 0 })).toEqual({ start: 0, end: 0, before: 0, after: 0 });
    expect(rowWindow({ ...base, rowHeight: 0, scrollTop: 0 })).toEqual({ start: 0, end: 0, before: 0, after: 0 });
    expect(rowWindow({ ...base, rowCount: Number.NaN, scrollTop: 0 })).toEqual({ start: 0, end: 0, before: 0, after: 0 });
  });

  it("renders one row when the viewport is no taller than the header", () => {
    expect(rowWindow({ ...base, viewportHeight: 20, scrollTop: 64 })).toMatchObject({ start: 2, end: 3 });
  });

  it("treats a negative scroll (overscroll bounce) as the top", () => {
    expect(rowWindow({ ...base, scrollTop: -40 })).toMatchObject({ start: 0, end: 10 });
  });
});

describe("scrollTopFor", () => {
  const view = { rowHeight: 32, headerHeight: 30, viewportHeight: 350 };
  it("leaves a visible row where it is", () => {
    expect(scrollTopFor(5, { ...view, scrollTop: 0 })).toBe(0);
  });
  it("aligns a row above the view to the top, below the header", () => {
    expect(scrollTopFor(3, { ...view, scrollTop: 320 })).toBe(96);
  });
  it("aligns a row below the view to the bottom", () => {
    // Row 20 ends at 672; 320 px of body show [352, 672).
    expect(scrollTopFor(20, { ...view, scrollTop: 0 })).toBe(352);
  });
  it("aligns the top when the view is shorter than a row", () => {
    expect(scrollTopFor(4, { ...view, viewportHeight: 50, scrollTop: 0 })).toBe(128);
  });
});

describe("navigate", () => {
  it("moves by one, a page, or to either end, clamped", () => {
    expect(navigate("ArrowDown", 3, 10, 4)).toBe(4);
    expect(navigate("ArrowUp", 0, 10, 4)).toBe(0);
    expect(navigate("ArrowDown", 9, 10, 4)).toBe(9);
    expect(navigate("PageDown", 3, 10, 4)).toBe(7);
    expect(navigate("PageDown", 8, 10, 4)).toBe(9);
    expect(navigate("PageUp", 2, 10, 4)).toBe(0);
    expect(navigate("Home", 5, 10, 4)).toBe(0);
    expect(navigate("End", 5, 10, 4)).toBe(9);
  });
  it("ignores other keys and empty tables", () => {
    expect(navigate("Enter", 3, 10, 4)).toBeNull();
    expect(navigate("ArrowDown", 0, 0, 4)).toBeNull();
  });
  it("moves at least one row a page", () => {
    expect(navigate("PageDown", 3, 10, 0)).toBe(4);
  });
});
