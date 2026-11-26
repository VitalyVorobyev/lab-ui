import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ColormapLegend } from "./ColormapLegend";

const ticks = (container: HTMLElement) => [...container.querySelectorAll("[data-tick]")].map((t) => t.textContent);

describe("ColormapLegend", () => {
  it("is one line with the ends and unit by default", () => {
    const { container, getByText } = render(<ColormapLegend map="magma" domain={[0, 2.5]} unit="px" label="Edge error" />);
    expect(getByText("0 px")).toBeTruthy();
    expect(getByText("2.5 px")).toBeTruthy();
    expect(container.querySelector("[data-colormap='magma']")).not.toBeNull();
    expect(ticks(container)).toEqual([]);
  });

  it("stands the bar up with the high end at the top, the unit on the label and the ends beside it", () => {
    const { container } = render(<ColormapLegend map="viridis" domain={[0, 4]} unit="px" label="Residual" orientation="vertical" />);
    const legend = container.querySelector("[data-orientation='vertical']")!;
    expect(legend.textContent).toContain("Residualpx");
    expect(ticks(container)).toEqual(["0", "4"]);
    const [low, high] = [...container.querySelectorAll<HTMLElement>("[data-tick]")];
    expect(low!.style.bottom).toBe("0.00%");
    expect(high!.style.bottom).toBe("100.00%");
    expect(legend.querySelector<HTMLElement>("[aria-hidden]")!.style.backgroundImage).toContain("to top");
  });

  it("centres a symmetric scale on zero and says so", () => {
    const { container } = render(<ColormapLegend map="blueOrange" domain={[-0.2, 0.5]} label="Shift" orientation="vertical" symmetric />);
    expect(ticks(container)).toEqual(["-0.5", "0", "0.5"]);
    const zero = [...container.querySelectorAll<HTMLElement>("[data-tick]")][1]!;
    expect(zero.style.bottom).toBe("50.00%");
  });

  it("labels given tick values at their position, leaving out those outside the domain", () => {
    const { container } = render(
      <ColormapLegend map="viridis" domain={[0, 10]} label="x" orientation="vertical" ticks={[0, 2.5, 10, 12]} />,
    );
    expect(ticks(container)).toEqual(["0", "2.5", "10"]);
    expect([...container.querySelectorAll<HTMLElement>("[data-tick]")][1]!.style.bottom).toBe("25.00%");
  });

  it("asks for round ticks by count, and puts a horizontal scale's values under the bar", () => {
    const { container } = render(<ColormapLegend map="viridis" domain={[0, 1]} label="Validity" unit="%" ticks={5} />);
    // The round values, and the two ends.
    expect(ticks(container)).toEqual(["0", "0.2", "0.4", "0.6", "0.8", "1"]);
    expect(container.textContent).toContain("%");
  });

  it("formats values with the given function", () => {
    const { container } = render(
      <ColormapLegend map="inferno" domain={[0, 1]} label="p" orientation="vertical" format={(v) => `${v * 100}%`} />,
    );
    expect(ticks(container)).toEqual(["0%", "100%"]);
  });

  it("does not divide by zero on an empty domain", () => {
    const { container } = render(<ColormapLegend map="viridis" domain={[3, 3]} label="p" orientation="vertical" />);
    expect(ticks(container)).toEqual(["3", "3"]);
  });
});
