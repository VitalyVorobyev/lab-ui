import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusBar } from "./StatusBar";

describe("StatusBar", () => {
  it("is a group named Status by default, with each end a list of the facts that have a value", () => {
    render(
      <StatusBar
        start={[
          { label: "frame", value: "f3" },
          { label: "model", value: null },
        ]}
        end={[{ label: "last run", value: undefined }, { value: "1920×1080" }]}
      />,
    );
    const bar = screen.getByRole("group", { name: "Status" });
    expect(bar.hasAttribute("aria-live")).toBe(false);
    expect(bar.hasAttribute("data-live")).toBe(false);
    const [start, end] = within(bar).getAllByRole("list");
    expect(within(start!).getAllByRole("listitem")).toHaveLength(1);
    expect(start!.textContent).toBe("framef3");
    expect(within(end!).getAllByRole("listitem")).toHaveLength(1);
    expect(end!.textContent).toBe("1920×1080");
  });

  it("draws no list for an end whose facts all lack a value, or that is absent", () => {
    render(<StatusBar start={[{ label: "model", value: undefined }]} aria-label="Run status" />);
    const bar = screen.getByRole("group", { name: "Run status" });
    expect(within(bar).queryByRole("list")).toBeNull();
  });

  it("is a polite status region when live", () => {
    render(<StatusBar live start={[{ value: "ready" }]} />);
    const bar = screen.getByRole("status", { name: "Status" });
    expect(bar.getAttribute("aria-live")).toBe("polite");
    expect(bar.hasAttribute("data-live")).toBe(true);
    expect(screen.queryByRole("group")).toBeNull();
  });

  it("draws children between the two ends and merges className", () => {
    render(
      <StatusBar start={[{ value: "left" }]} end={[{ value: "right" }]} className="px-1">
        <span data-testid="middle">42 %</span>
      </StatusBar>,
    );
    const bar = screen.getByRole("group", { name: "Status" });
    expect(bar.className).toContain("px-1");
    expect(bar.className).not.toContain("px-3");
    const [start, middle, end] = [...bar.children];
    expect(start!.textContent).toBe("left");
    expect(middle!.contains(screen.getByTestId("middle"))).toBe(true);
    expect(end!.textContent).toBe("right");
  });
});
