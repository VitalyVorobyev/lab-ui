import { describe, expect, it } from "vitest";

import { moveActive, nearestEnabled, type ListboxKey } from "./listboxModel";

const none = [false, false, false, false, false];
//               0      1     2      3     4
const holes = [true, false, true, false, true];

describe("moveActive", () => {
  it("moves by one and stops at the ends", () => {
    expect(moveActive(none, 2, "ArrowDown")).toBe(3);
    expect(moveActive(none, 2, "ArrowUp")).toBe(1);
    expect(moveActive(none, 4, "ArrowDown")).toBe(4);
    expect(moveActive(none, 0, "ArrowUp")).toBe(0);
  });

  it("skips disabled options", () => {
    expect(moveActive(holes, 1, "ArrowDown")).toBe(3);
    expect(moveActive(holes, 3, "ArrowUp")).toBe(1);
    // Nothing enabled beyond: stay.
    expect(moveActive(holes, 3, "ArrowDown")).toBe(3);
    expect(moveActive(holes, 1, "ArrowUp")).toBe(1);
  });

  it("goes to the first and last enabled option on Home and End", () => {
    expect(moveActive(holes, 3, "Home")).toBe(1);
    expect(moveActive(holes, 1, "End")).toBe(3);
  });

  it("starts from the first (down) or last (up) enabled option when nothing is active", () => {
    expect(moveActive(holes, -1, "ArrowDown")).toBe(1);
    expect(moveActive(holes, -1, "PageDown")).toBe(1);
    expect(moveActive(holes, -1, "ArrowUp")).toBe(3);
    expect(moveActive(holes, -1, "PageUp")).toBe(3);
  });

  it("moves a page of enabled options, stopping at the end", () => {
    const many = Array.from({ length: 30 }, (_, i) => i % 3 === 0);
    // From 1, ten enabled options later is index 16 (indices 2,4,5,7,8,10,11,13,14,16).
    expect(moveActive(many, 1, "PageDown")).toBe(16);
    expect(moveActive(many, 16, "PageUp")).toBe(1);
    expect(moveActive(many, 25, "PageDown", 100)).toBe(29);
    // A page of zero still moves one.
    expect(moveActive(none, 0, "PageDown", 0)).toBe(1);
  });

  it("returns -1 when every option is disabled", () => {
    expect(moveActive([true, true], 0, "ArrowDown")).toBe(-1);
    expect(moveActive([], -1, "Home")).toBe(-1);
  });

  it("never lands on a disabled option and stays in range (seeded sweep)", () => {
    let seed = 12345;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed / 2 ** 31;
    };
    const keys: ListboxKey[] = ["ArrowDown", "ArrowUp", "Home", "End", "PageDown", "PageUp"];
    for (let run = 0; run < 500; run += 1) {
      const length = 1 + Math.floor(random() * 20);
      const disabled = Array.from({ length }, () => random() < 0.3);
      let active = nearestEnabled(disabled, Math.floor(random() * length));
      for (let step = 0; step < 10; step += 1) {
        const key = keys[Math.floor(random() * keys.length)]!;
        active = moveActive(disabled, active, key, 1 + Math.floor(random() * 5));
        if (disabled.every(Boolean)) {
          expect(active).toBe(-1);
        } else {
          expect(active).toBeGreaterThanOrEqual(0);
          expect(active).toBeLessThan(length);
          expect(disabled[active]).toBe(false);
        }
      }
    }
  });
});

describe("nearestEnabled", () => {
  it("prefers the index, then later, then earlier options", () => {
    expect(nearestEnabled(holes, 1)).toBe(1);
    expect(nearestEnabled(holes, 2)).toBe(3);
    expect(nearestEnabled(holes, 4)).toBe(3);
    expect(nearestEnabled(holes, -5)).toBe(1);
    expect(nearestEnabled(holes, 99)).toBe(3);
    expect(nearestEnabled([true, true], 0)).toBe(-1);
  });
});
