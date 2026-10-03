import { cleanup, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SegmentedControl } from "./SegmentedControl";

const OPTIONS = [
  { value: "small", label: "Small" },
  { value: "large", label: "Large" },
];

function renderStrip(size?: "sm" | "md") {
  render(<SegmentedControl value="small" options={OPTIONS} onValueChange={() => {}} aria-label="Size" size={size} />);
  return {
    strip: screen.getByRole("radiogroup", { name: "Size" }),
    segment: screen.getByRole("radio", { name: "Small" }).closest("label") as HTMLElement,
  };
}

describe("SegmentedControl size", () => {
  it("md is 32px outside, with text-sm labels filling the strip's content box", () => {
    const { strip, segment } = renderStrip("md");
    expect(strip.classList.contains("h-8")).toBe(true);
    expect(segment.classList.contains("h-full")).toBe(true);
    expect(segment.classList.contains("text-sm")).toBe(true);
    expect(segment.classList.contains("text-xs")).toBe(false);
  });

  it("sm is the toolbar size: no explicit height, text-xs labels", () => {
    const { strip, segment } = renderStrip("sm");
    expect(strip.classList.contains("h-8")).toBe(false);
    expect(segment.classList.contains("text-xs")).toBe(true);
    expect(segment.classList.contains("py-1")).toBe(true);
  });

  it("renders the same classes with `size` omitted as with size=\"sm\"", () => {
    const omitted = renderStrip();
    const omittedClasses = [omitted.strip.className, omitted.segment.className];
    cleanup();
    const sm = renderStrip("sm");
    expect([sm.strip.className, sm.segment.className]).toEqual(omittedClasses);
  });
});
