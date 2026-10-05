import { describe, expect, it } from "vitest";

import { clampSplit, compareStyles, knobPosition, splitForKey, splitText, wipeClip } from "./compareStyle";

const OPTIONS = { split: 0.4, orientation: "vertical" as const, cell: 32, gain: 1 };

describe("clampSplit", () => {
  it("keeps a split in [0, 1], and puts a non-finite one in the middle", () => {
    expect(clampSplit(0.3)).toBe(0.3);
    expect(clampSplit(-1)).toBe(0);
    expect(clampSplit(7)).toBe(1);
    expect(clampSplit(Number.NaN)).toBe(0.5);
    expect(clampSplit(Infinity)).toBe(0.5);
  });
});

describe("compareStyles", () => {
  it("masks B with a checkerboard of two cells per repeat, A at the top-left", () => {
    const { wrapper, b } = compareStyles("checker", OPTIONS);
    expect(wrapper).toEqual({});
    expect(b.maskImage).toBe("conic-gradient(black 0 25%, transparent 0 50%, black 0 75%, transparent 0)");
    expect(b.WebkitMaskImage).toBe(b.maskImage);
    expect(b.maskSize).toBe("64px 64px");
    expect(b.maskRepeat).toBe("repeat");
    expect(b.maskPosition).toBe("0 0");
  });

  it("never makes a checker cell smaller than one pixel", () => {
    expect(compareStyles("checker", { ...OPTIONS, cell: 0 }).b.maskSize).toBe("2px 2px");
  });

  it("clips B to the far side of the wipe's divider", () => {
    expect(compareStyles("wipe", OPTIONS).b).toEqual({ clipPath: "inset(0 0 0 40%)" });
    expect(compareStyles("wipe", { ...OPTIONS, orientation: "horizontal" }).b).toEqual({ clipPath: "inset(40% 0 0 0)" });
  });

  it("blends B by difference in an isolated group, brightened by the gain", () => {
    const plain = compareStyles("difference", OPTIONS);
    expect(plain.b).toEqual({ mixBlendMode: "difference" });
    expect(plain.wrapper).toEqual({ isolation: "isolate", filter: undefined });
    expect(compareStyles("difference", { ...OPTIONS, gain: 4 }).wrapper.filter).toBe("brightness(4)");
    expect(compareStyles("difference", { ...OPTIONS, gain: -2 }).wrapper.filter).toBe("brightness(0)");
  });
});

describe("wipeClip", () => {
  it("clamps the split and rounds the percentage", () => {
    expect(wipeClip(2, "vertical")).toBe("inset(0 0 0 100%)");
    expect(wipeClip(-1, "horizontal")).toBe("inset(0% 0 0 0)");
    expect(wipeClip(1 / 3, "vertical")).toBe("inset(0 0 0 33.333%)");
  });
});

describe("splitForKey", () => {
  it("moves 1 % per arrow, 10 % with Shift or a page key", () => {
    expect(splitForKey(0.5, "ArrowRight", false, "vertical")).toBeCloseTo(0.51, 9);
    expect(splitForKey(0.5, "ArrowLeft", true, "vertical")).toBeCloseTo(0.4, 9);
    expect(splitForKey(0.5, "PageUp", false, "vertical")).toBeCloseTo(0.6, 9);
    expect(splitForKey(0.5, "PageDown", false, "vertical")).toBeCloseTo(0.4, 9);
  });

  it("raises the value with Up on a vertical divider, and moves a horizontal one the way the key points", () => {
    expect(splitForKey(0.5, "ArrowUp", false, "vertical")).toBeCloseTo(0.51, 9);
    expect(splitForKey(0.5, "ArrowDown", false, "vertical")).toBeCloseTo(0.49, 9);
    expect(splitForKey(0.5, "ArrowUp", false, "horizontal")).toBeCloseTo(0.49, 9);
    expect(splitForKey(0.5, "ArrowDown", false, "horizontal")).toBeCloseTo(0.51, 9);
  });

  it("goes to the edges with Home and End, and clamps there", () => {
    expect(splitForKey(0.5, "Home", false, "vertical")).toBe(0);
    expect(splitForKey(0.5, "End", false, "vertical")).toBe(1);
    expect(splitForKey(0.995, "ArrowRight", false, "vertical")).toBe(1);
    expect(splitForKey(0.05, "ArrowLeft", true, "vertical")).toBe(0);
  });

  it("ignores other keys", () => {
    expect(splitForKey(0.5, "a", false, "vertical")).toBeNull();
    expect(splitForKey(0.5, "Enter", true, "horizontal")).toBeNull();
  });
});

describe("splitText", () => {
  it("says how much of A shows", () => {
    expect(splitText(0.4, "A")).toBe("40 % A");
    expect(splitText(0.996, "Reference")).toBe("100 % Reference");
  });
});

describe("knobPosition", () => {
  it("is the middle of the visible part of the divider", () => {
    expect(knobPosition([100, 300], 1000)).toBe(200);
    expect(knobPosition([-200, 400], 1000)).toBe(200);
    expect(knobPosition([800, 1400], 1000)).toBe(900);
  });

  it("is the middle of the image before the viewport is measured", () => {
    expect(knobPosition(null, 1000)).toBe(500);
  });

  it("stays at the nearer end when the divider is off screen", () => {
    expect(knobPosition([1200, 1400], 1000)).toBe(1000);
    expect(knobPosition([-400, -100], 1000)).toBe(0);
  });
});
