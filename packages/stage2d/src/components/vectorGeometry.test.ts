import { describe, expect, it } from "vitest";

import {
  arrowPath,
  colorBin,
  imagePerUnit,
  magnitudePercentile,
  niceLength,
  VECTOR_COLOR_BINS,
  vectorMagnitude,
  vectorMagnitudes,
  type ArrowStyle,
} from "./vectorGeometry";

const STYLE: ArrowStyle = { head: 6, headWidth: 0.5, minLength: 1 };

describe("vectorMagnitudes", () => {
  it("measures each vector and marks an absent one NaN", () => {
    const m = vectorMagnitudes([3, 4, Number.NaN, 1, 0, 0, Infinity, 2]);
    expect([m[0], m[2]]).toEqual([5, 0]);
    expect(Number.isNaN(m[1]!)).toBe(true);
    expect(Number.isNaN(m[3]!)).toBe(true);
    expect(Number.isNaN(vectorMagnitude([1, 2], 5))).toBe(true);
  });
});

describe("magnitudePercentile", () => {
  it("is the nearest rank over the present vectors", () => {
    const m = [1, 2, 3, 4, Number.NaN, 5, 6, 7, 8, 9, 10];
    expect(magnitudePercentile(m, 1)).toBe(10);
    expect(magnitudePercentile(m, 0.5)).toBe(5);
    expect(magnitudePercentile(m, 0)).toBe(1);
    expect(magnitudePercentile(m, 7)).toBe(10);
    expect(magnitudePercentile([], 0.5)).toBe(0);
    expect(magnitudePercentile([Number.NaN], 0.5)).toBe(0);
  });
});

describe("imagePerUnit", () => {
  it("passes a number through and sizes an automatic scale in screen pixels", () => {
    expect(imagePerUnit(40, 123, 9)).toBe(40);
    expect(imagePerUnit(-1, 1, 1)).toBe(0);
    // The reference vector (0.5 data units) spans 30 screen px; one screen px is 0.25 image px.
    expect(imagePerUnit({ length: 30 }, 0.5, 0.25)).toBeCloseTo(15, 12);
    expect(imagePerUnit({ length: 30 }, 0, 0.25)).toBe(0);
    expect(imagePerUnit({ length: 0 }, 1, 1)).toBe(0);
  });
});

describe("niceLength", () => {
  it("is the largest 1, 2 or 5 times a power of ten within the bound", () => {
    expect(niceLength(0.137)).toBe(0.1);
    expect(niceLength(0.27)).toBe(0.2);
    expect(niceLength(0.9)).toBe(0.5);
    expect(niceLength(5)).toBe(5);
    expect(niceLength(1999)).toBe(1000);
    expect(niceLength(0)).toBe(0);
    expect(niceLength(Number.NaN)).toBe(0);
  });
});

describe("arrowPath", () => {
  it("draws a shaft to the head's base and a closed head ending at the tip", () => {
    const d = arrowPath(10, 20, 30, 0, 1, STYLE);
    expect(d).toBe("M10 20L34 20M40 20L34 21.5L34 18.5Z");
  });
  it("caps the head at 45 % of a short arrow and scales it with the unit", () => {
    // 4 long: head = 1.8; the base sits 1.8 back from the tip.
    expect(arrowPath(0, 0, 4, 0, 1, STYLE).startsWith("M0 0L2.2 0M4 0")).toBe(true);
    // At 0.5 image px per screen px the head is 3 image px long.
    expect(arrowPath(0, 0, 30, 0, 0.5, STYLE).startsWith("M0 0L27 0M30 0")).toBe(true);
  });
  it("draws nothing for an absent, zero or sub-pixel vector", () => {
    expect(arrowPath(0, 0, Number.NaN, 1, 1, STYLE)).toBe("");
    expect(arrowPath(0, 0, 0, 0, 1, STYLE)).toBe("");
    expect(arrowPath(0, 0, 0.9, 0, 1, STYLE)).toBe("");
    expect(arrowPath(0, 0, 0.9, 0, 0.5, STYLE)).not.toBe("");
  });
  it("points along the displacement in any direction", () => {
    const d = arrowPath(0, 0, 0, -20, 1, STYLE);
    expect(d.startsWith("M0 0L0 -14M0 -20")).toBe(true);
  });
});

describe("colorBin", () => {
  it("quantises over the range, clamped, and degrades on an empty range", () => {
    expect(colorBin(0, 0, 1)).toBe(0);
    expect(colorBin(1, 0, 1)).toBe(VECTOR_COLOR_BINS - 1);
    expect(colorBin(0.5, 0, 1)).toBe(VECTOR_COLOR_BINS / 2);
    expect(colorBin(-5, 0, 1)).toBe(0);
    expect(colorBin(9, 0, 1)).toBe(VECTOR_COLOR_BINS - 1);
    expect(colorBin(3, 2, 2)).toBe(0);
  });
});
