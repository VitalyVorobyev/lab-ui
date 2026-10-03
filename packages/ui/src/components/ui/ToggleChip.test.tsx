import { cleanup, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ToggleChip } from "./ToggleChip";

function renderChip(size?: "sm" | "md") {
  render(
    <ToggleChip checked onCheckedChange={() => {}} swatch="#f59e0b" size={size}>
      Caliper boxes
    </ToggleChip>,
  );
  const chip = screen.getByRole("switch", { name: "Caliper boxes" });
  return { chip, swatch: chip.querySelector("span") as HTMLElement };
}

describe("ToggleChip size", () => {
  it("md is 32px outside, with text-sm text and a larger swatch", () => {
    const { chip, swatch } = renderChip("md");
    expect(chip.classList.contains("h-8")).toBe(true);
    expect(chip.classList.contains("text-sm")).toBe(true);
    expect(chip.classList.contains("text-xs")).toBe(false);
    expect(swatch.classList.contains("size-2.5")).toBe(true);
  });

  it("sm is the toolbar size: no explicit height, text-xs text", () => {
    const { chip, swatch } = renderChip("sm");
    expect(chip.classList.contains("h-8")).toBe(false);
    expect(chip.classList.contains("text-xs")).toBe(true);
    expect(swatch.classList.contains("size-2")).toBe(true);
  });

  it("renders the same classes with `size` omitted as with size=\"sm\"", () => {
    const omitted = renderChip();
    const omittedClasses = [omitted.chip.className, omitted.swatch.className];
    cleanup();
    const sm = renderChip("sm");
    expect([sm.chip.className, sm.swatch.className]).toEqual(omittedClasses);
  });
});
