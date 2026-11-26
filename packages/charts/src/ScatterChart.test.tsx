import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ScatterChart, type ScatterSeries } from "./ScatterChart";

const A: ScatterSeries = {
  name: "left",
  points: [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
    { x: 2, y: 4 },
    { x: Number.NaN, y: 3 },
  ],
};
const B: ScatterSeries = { name: "right", points: [{ x: 3, y: 2 }] };

const markers = (container: HTMLElement) => [...container.querySelectorAll("path[data-batch]")];

describe("ScatterChart", () => {
  it("draws one path per series, skips a non-finite point and names each series in the legend", () => {
    const { container } = render(<ScatterChart label="Residuals" series={[A, B]} />);
    expect(screen.getByLabelText("Residuals")).toBeTruthy();
    const paths = markers(container);
    expect(paths).toHaveLength(2);
    expect(paths[0]!.getAttribute("d")!.match(/h0/g)).toHaveLength(3);
    expect(paths[1]!.getAttribute("d")!.match(/h0/g)).toHaveLength(1);
    expect(screen.getByText("left")).toBeTruthy();
    expect(screen.getByText("right")).toBeTruthy();
  });

  it("takes a series colour, else the palette", () => {
    const { container } = render(<ScatterChart label="c" series={[{ ...A, colour: "var(--normal)" }, B]} />);
    const [first, second] = markers(container);
    expect(first!.getAttribute("stroke")).toBe("var(--normal)");
    expect(second!.getAttribute("stroke")).toBe("var(--series-2)");
  });

  it("hides the legend on request and renders an empty chart", () => {
    const { container, queryByText } = render(<ScatterChart label="e" series={[{ name: "none", points: [] }]} showLegend={false} />);
    expect(queryByText("none")).toBeNull();
    expect(markers(container)).toHaveLength(0);
  });

  it("colours by value through the map, one path per step, with a labelled scale", () => {
    const series: ScatterSeries[] = [
      {
        name: "s",
        points: [
          { x: 0, y: 0, value: -2 },
          { x: 1, y: 1, value: 0 },
          { x: 2, y: 2, value: 2 },
          { x: 3, y: 3 },
        ],
      },
    ];
    const { container } = render(
      <ScatterChart label="v" series={series} colourBy={{ map: "blueOrange", label: "Signed error", unit: "px" }} />,
    );
    const strokes = markers(container).map((m) => m.getAttribute("stroke"));
    // Three steps and the point with no value.
    expect(strokes).toHaveLength(4);
    expect(strokes).toContain("var(--fg-subtle)");
    // A diverging map is centred on zero by default: the scale is -2 .. 0 .. 2.
    const legend = container.querySelector("[data-colormap='blueOrange']")!;
    expect([...legend.querySelectorAll("[data-tick]")].map((t) => t.textContent)).toEqual(["-2", "0", "2"]);
    expect(screen.getByText("Signed error")).toBeTruthy();
    // The series legend gives way to the colour scale.
    expect(screen.queryByText("s")).toBeNull();
  });

  it("draws reference lines inside the domain and leaves out those outside", () => {
    const { container } = render(
      <ScatterChart
        label="r"
        series={[A]}
        xDomain={[0, 4]}
        yDomain={[0, 4]}
        referenceLines={[
          { axis: "y", value: 2, label: "limit", tone: "defect" },
          { axis: "x", value: 1 },
          { axis: "y", value: 9, label: "far" },
        ]}
      />,
    );
    expect(container.querySelectorAll("[data-reference-line='y']")).toHaveLength(1);
    expect(container.querySelectorAll("[data-reference-line='x']")).toHaveLength(1);
    expect(screen.getByText("limit")).toBeTruthy();
    expect(screen.queryByText("far")).toBeNull();
  });

  it("rings a highlighted point and ignores one that does not exist", () => {
    const withRing = render(<ScatterChart label="h" series={[A]} highlighted={{ series: "left", index: 1 }} />);
    expect(withRing.container.querySelector("[data-highlight]")).not.toBeNull();
    withRing.unmount();
    const none = render(<ScatterChart label="h" series={[A]} highlighted={{ series: "left", index: 3 }} />);
    expect(none.container.querySelector("[data-highlight]")).toBeNull();
    none.unmount();
    const missing = render(<ScatterChart label="h" series={[A]} highlighted={{ series: "nope", index: 0 }} />);
    expect(missing.container.querySelector("[data-highlight]")).toBeNull();
  });

  it("is a pointer target only with onHover or onPick", () => {
    expect(render(<ScatterChart label="p" series={[A]} />).container.querySelector("[data-plot-target]")).toBeNull();
    expect(render(<ScatterChart label="p" series={[A]} onHover={() => {}} />).container.querySelector("[data-plot-target]")).not.toBeNull();
  });
});
