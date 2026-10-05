import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@vitavision/ui";

import { Stepper } from "./Stepper";

const STEPS = [
  { id: "teach", label: "Teach", complete: true },
  { id: "find", label: "Find" },
  { id: "verify", label: "Verify", blockedBy: "Run Find first." },
];

function renderStepper(props: Partial<Parameters<typeof Stepper>[0]> = {}) {
  return render(
    <TooltipProvider>
      <Stepper steps={STEPS} aria-label="Steps" {...props} />
    </TooltipProvider>,
  );
}

describe("Stepper", () => {
  it("ignores a click on a blocked step, which stays focusable and says why", () => {
    const change = vi.fn();
    renderStepper({ value: "find", onValueChange: change });
    const verify = screen.getByRole("button", { name: "Verify" });
    expect(verify.getAttribute("aria-disabled")).toBe("true");
    expect(verify).toHaveProperty("disabled", false);
    expect(verify.dataset["state"]).toBe("blocked");
    const reason = document.getElementById(verify.getAttribute("aria-describedby") ?? "");
    expect(reason?.textContent).toBe("Run Find first.");

    fireEvent.click(verify);
    expect(change).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Find" }).getAttribute("aria-current")).toBe("step");
  });

  it("starts on the first step when uncontrolled without a default, and keeps the choice", () => {
    const change = vi.fn();
    renderStepper({ onValueChange: change });
    const teach = screen.getByRole("button", { name: "Teach" });
    expect(teach.getAttribute("aria-current")).toBe("step");
    expect(teach.dataset["state"]).toBe("current");

    fireEvent.click(screen.getByRole("button", { name: "Find" }));
    expect(change).toHaveBeenCalledWith("find");
    expect(screen.getByRole("button", { name: "Find" }).getAttribute("aria-current")).toBe("step");
    // Teach is complete, so it shows as such once it is not current.
    expect(teach.dataset["state"]).toBe("complete");
  });

  it("waits for value when controlled, and lays out by orientation", () => {
    const change = vi.fn();
    renderStepper({ value: null, onValueChange: change, orientation: "vertical", className: "gap-2" });
    const list = screen.getByRole("list", { name: "Steps" });
    expect(list.dataset["orientation"]).toBe("vertical");
    expect(list.classList.contains("gap-2")).toBe(true);
    expect(screen.queryByRole("button", { current: "step" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Find" }));
    expect(change).toHaveBeenCalledWith("find");
    expect(screen.queryByRole("button", { current: "step" })).toBeNull();
  });
});
