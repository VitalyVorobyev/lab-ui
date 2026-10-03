import { describe, expect, it } from "vitest";

import { stepIndex } from "./sequence";

describe("stepIndex", () => {
  it("steps and stops at the ends", () => {
    expect(stepIndex(5, 2, 1)).toBe(3);
    expect(stepIndex(5, 2, -1)).toBe(1);
    expect(stepIndex(5, 4, 1)).toBe(4);
    expect(stepIndex(5, 0, -1)).toBe(0);
  });

  it("wraps when asked", () => {
    expect(stepIndex(5, 4, 1, true)).toBe(0);
    expect(stepIndex(5, 0, -1, true)).toBe(4);
  });

  it("starts at an end with no current item, and has nowhere to go in an empty set", () => {
    expect(stepIndex(5, -1, 1)).toBe(0);
    expect(stepIndex(5, -1, -1)).toBe(4);
    expect(stepIndex(5, 9, 1)).toBe(0);
    expect(stepIndex(0, -1, 1)).toBeNull();
  });
});
