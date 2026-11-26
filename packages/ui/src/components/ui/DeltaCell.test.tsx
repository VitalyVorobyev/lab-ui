import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DeltaCell, deltaStrength } from "./DeltaCell";

describe("deltaStrength", () => {
  it("steps a normalised magnitude into four strengths", () => {
    expect(deltaStrength(0)).toBe("none");
    expect(deltaStrength(0.09)).toBe("none");
    expect(deltaStrength(0.1)).toBe("low");
    expect(deltaStrength(0.39)).toBe("low");
    expect(deltaStrength(0.4)).toBe("medium");
    expect(deltaStrength(0.69)).toBe("medium");
    expect(deltaStrength(0.7)).toBe("high");
    expect(deltaStrength(1)).toBe("high");
  });
  it("clamps, and gives none for a missing or non-numeric magnitude", () => {
    expect(deltaStrength(7)).toBe("high");
    expect(deltaStrength(-3)).toBe("none");
    expect(deltaStrength(undefined)).toBe("none");
    expect(deltaStrength(null)).toBe("none");
    expect(deltaStrength(Number.NaN)).toBe("none");
  });
});

describe("DeltaCell", () => {
  it("shows the value, and the difference with its sign and a spoken label", () => {
    const { container } = render(<DeltaCell value={0.5} delta={0.0125} />);
    const cell = container.querySelector("[data-delta-cell]")!;
    expect(cell.textContent).toBe("0.5change +0.0125");
    expect(screen.getByText("change")).toBeTruthy();
    expect(cell.getAttribute("data-strength")).toBe("none");
  });

  it("writes a negative difference with a true minus and a zero without a sign", () => {
    expect(render(<DeltaCell value={1} delta={-0.4} />).container.textContent).toBe("1change −0.4");
    expect(render(<DeltaCell value={1} delta={0} />).container.textContent).toBe("1change 0");
  });

  it("leaves the difference out when it is missing or not a number", () => {
    for (const delta of [undefined, null, Number.NaN, Infinity]) {
      expect(render(<DeltaCell value={2} delta={delta} />).container.textContent).toBe("2");
    }
  });

  it("shows a dash for a missing value", () => {
    expect(render(<DeltaCell value={null} delta={1} />).container.textContent).toBe("—change +1");
    expect(render(<DeltaCell value={Number.NaN} />).container.textContent).toBe("—");
  });

  it("tints by the magnitude, in the accent or a neutral", () => {
    const high = render(<DeltaCell value={1} delta={1} magnitude={0.9} />).container.querySelector("[data-delta-cell]")!;
    expect(high.getAttribute("data-strength")).toBe("high");
    expect(high.className).toContain("bg-signal/26");
    const neutral = render(<DeltaCell value={1} delta={1} magnitude={0.5} tone="neutral" />).container.querySelector("[data-delta-cell]")!;
    expect(neutral.getAttribute("data-strength")).toBe("medium");
    expect(neutral.className).toContain("bg-fg/12");
    const none = render(<DeltaCell value={1} delta={1} magnitude={0.02} />).container.querySelector("[data-delta-cell]")!;
    expect(none.className).not.toContain("bg-signal");
  });

  it("formats the value and the difference, with a unit and a label", () => {
    const { container } = render(
      <DeltaCell
        value={12.3456}
        delta={-0.25}
        format={(v) => v.toFixed(2)}
        deltaFormat={(v) => v.toFixed(1)}
        unit="px"
        deltaLabel="from default"
      />,
    );
    expect(container.textContent).toBe("12.35pxfrom default −0.3");
  });

  it("takes a class", () => {
    const { container } = render(<DeltaCell value={1} className="custom" />);
    expect(container.querySelector("[data-delta-cell]")!.className).toContain("custom");
  });
});
