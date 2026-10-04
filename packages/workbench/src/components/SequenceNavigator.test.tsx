import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SequenceNavigator, type SequenceItem } from "./SequenceNavigator";

const ITEMS: SequenceItem[] = [
  { id: "a", label: "a.bmp", status: { tone: "normal", label: "found" } },
  { id: "b", label: "b.bmp", status: { tone: "defect", label: "not found" } },
  { id: "c", label: "c.bmp" },
];

describe("SequenceNavigator status", () => {
  it("names and titles an item with its status, and exposes the tone", () => {
    render(<SequenceNavigator items={ITEMS} value="a" onValueChange={() => undefined} aria-label="Frames" />);
    const missing = screen.getByRole("button", { name: "b.bmp, not found" });
    expect(missing.getAttribute("title")).toBe("b.bmp, not found");
    expect(missing.dataset["status"]).toBe("defect");
    expect(missing.querySelector('[data-tone="defect"]')).not.toBeNull();
    const plain = screen.getByRole("button", { name: "c.bmp" });
    expect(plain.hasAttribute("data-status")).toBe(false);
    expect(plain.querySelector("[data-tone]")).toBeNull();
  });

  it("draws the dot over a custom thumbnail, and a click still picks the item", () => {
    const change = vi.fn();
    render(
      <SequenceNavigator
        items={ITEMS}
        value="a"
        onValueChange={change}
        renderThumbnail={(item) => <span data-testid={`thumb-${item.id}`}>{item.id}</span>}
        keys={false}
        aria-label="Frames"
      />,
    );
    const missing = screen.getByRole("button", { name: "b.bmp, not found" });
    expect(missing.contains(screen.getByTestId("thumb-b"))).toBe(true);
    expect(missing.querySelector('[data-tone="defect"]')).not.toBeNull();
    fireEvent.click(missing);
    expect(change).toHaveBeenCalledWith("b");
  });
});
