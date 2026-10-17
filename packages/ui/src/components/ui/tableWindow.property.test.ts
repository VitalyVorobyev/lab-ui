/**
 * Property tests for the windowing arithmetic: laws that hold for any table size, row height,
 * viewport and scroll position, not just the examples in `tableWindow.test.ts`.
 *
 * Inputs come from a seeded PRNG, so a failure reproduces exactly; the failing input is in the
 * assertion message.
 */

import { describe, expect, it } from "vitest";

import { navigate, rowWindow, scrollTopFor, type WindowInput } from "./tableWindow";

const RUNS = 2000;

/** mulberry32 — small, fast, and good enough to spread test inputs. */
function prng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const int = (random: () => number, max: number) => Math.floor(random() * (max + 1));

/** A table of up to 10,000 rows, scrolled anywhere in its range (and a little past it). */
function anyInput(random: () => number): WindowInput {
  const rowCount = int(random, random() < 0.2 ? 5 : 10_000);
  const rowHeight = 12 + int(random, 60);
  const headerHeight = int(random, 48);
  const viewportHeight = headerHeight + int(random, 900);
  const total = rowCount * rowHeight;
  const scrollTop = Math.max(0, int(random, total + 100) - 50 + random());
  return { rowCount, rowHeight, headerHeight, viewportHeight, scrollTop, overscan: int(random, 8) };
}

/** The positions of the rows any pixel of which is in the visible body. */
function visibleRows({ rowCount, rowHeight, headerHeight, viewportHeight, scrollTop }: WindowInput): number[] {
  const top = Math.max(0, scrollTop);
  const bottom = top + viewportHeight - headerHeight;
  const rows: number[] = [];
  for (let p = Math.floor(top / rowHeight); p < rowCount && p * rowHeight < bottom; p++) rows.push(p);
  return rows;
}

describe("rowWindow laws", () => {
  it("renders every row any pixel of which is visible", () => {
    const random = prng(1);
    for (let run = 0; run < RUNS; run++) {
      const input = anyInput(random);
      const { start, end } = rowWindow(input);
      for (const p of visibleRows(input)) expect(p >= start && p < end, JSON.stringify({ input, p, start, end })).toBe(true);
    }
  });

  it("is a range within the rows that keeps the table's full height", () => {
    const random = prng(2);
    for (let run = 0; run < RUNS; run++) {
      const input = anyInput(random);
      const w = rowWindow(input);
      const msg = JSON.stringify({ input, w });
      expect(0 <= w.start && w.start <= w.end && w.end <= input.rowCount, msg).toBe(true);
      expect(w.before, msg).toBe(w.start * input.rowHeight);
      expect(w.before + (w.end - w.start) * input.rowHeight + w.after, msg).toBe(input.rowCount * input.rowHeight);
    }
  });

  it("renders no more than a screen of rows plus the overscan", () => {
    const random = prng(3);
    for (let run = 0; run < RUNS; run++) {
      const input = anyInput(random);
      const w = rowWindow(input);
      const screen = Math.ceil((input.viewportHeight - input.headerHeight) / input.rowHeight) + 1;
      expect(w.end - w.start, JSON.stringify({ input, w })).toBeLessThanOrEqual(Math.max(1, screen) + 2 * input.overscan);
    }
  });

  it("renders something whenever there are rows and the scroll is within them", () => {
    const random = prng(4);
    for (let run = 0; run < RUNS; run++) {
      const input = anyInput(random);
      if (input.rowCount === 0 || input.scrollTop >= input.rowCount * input.rowHeight) continue;
      const w = rowWindow(input);
      expect(w.end - w.start, JSON.stringify({ input, w })).toBeGreaterThan(0);
    }
  });
});

describe("scrollTopFor laws", () => {
  it("brings the row fully into the visible body when it fits", () => {
    const random = prng(5);
    for (let run = 0; run < RUNS; run++) {
      const input = anyInput(random);
      if (input.rowCount === 0) continue;
      const position = int(random, input.rowCount - 1);
      const scrollTop = scrollTopFor(position, input);
      const msg = JSON.stringify({ input, position, scrollTop });
      const visible = input.viewportHeight - input.headerHeight;
      const rowTop = position * input.rowHeight;
      expect(rowTop, msg).toBeGreaterThanOrEqual(scrollTop);
      if (visible >= input.rowHeight) expect(rowTop + input.rowHeight, msg).toBeLessThanOrEqual(scrollTop + visible);
      // And the window at that scroll renders it.
      const w = rowWindow({ ...input, scrollTop });
      expect(position >= w.start && position < w.end, msg).toBe(true);
    }
  });

  it("is idempotent: a row already brought into view stays put", () => {
    const random = prng(6);
    for (let run = 0; run < RUNS; run++) {
      const input = anyInput(random);
      if (input.rowCount === 0) continue;
      const position = int(random, input.rowCount - 1);
      const once = scrollTopFor(position, input);
      expect(scrollTopFor(position, { ...input, scrollTop: once }), JSON.stringify({ input, position })).toBe(once);
    }
  });
});

describe("navigate laws", () => {
  it("always lands on a row, and only moves for navigation keys", () => {
    const random = prng(7);
    const keys = ["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", "Enter", "a"];
    for (let run = 0; run < RUNS; run++) {
      const rowCount = int(random, 50);
      const position = rowCount === 0 ? 0 : int(random, rowCount - 1);
      const key = keys[int(random, keys.length - 1)]!;
      const next = navigate(key, position, rowCount, int(random, 20));
      const msg = JSON.stringify({ key, position, rowCount, next });
      if (key === "Enter" || key === "a" || rowCount === 0) expect(next, msg).toBeNull();
      else expect(next !== null && next >= 0 && next < rowCount, msg).toBe(true);
    }
  });
});
