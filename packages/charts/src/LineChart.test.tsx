import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LineChart } from "./LineChart";

function paths(container: HTMLElement): SVGPathElement[] {
  return Array.from(container.querySelectorAll("path"));
}

describe("LineChart", () => {
  it("draws one path per series and names each in the legend", () => {
    const { container } = render(
      <LineChart
        label="Training losses"
        series={[
          {
            name: "loss_st",
            points: [
              { x: 0, y: 1 },
              { x: 1, y: 0.5 },
            ],
          },
          {
            name: "loss_ae",
            points: [
              { x: 0, y: 2 },
              { x: 1, y: 1.5 },
            ],
          },
        ]}
      />,
    );

    expect(paths(container)).toHaveLength(2);
    expect(screen.getByLabelText("Training losses")).toBeTruthy();
    expect(screen.getByText("loss_st")).toBeTruthy();
    expect(screen.getByText("loss_ae")).toBeTruthy();
  });

  it("renders an empty series without throwing, so a pending term is visible", () => {
    const { container } = render(<LineChart label="Empty" series={[{ name: "loss_st", points: [] }]} />);

    expect(paths(container)).toHaveLength(1);
    expect(paths(container)[0]?.getAttribute("d")).toEqual("");
    expect(screen.getByText("loss_st")).toBeTruthy();
  });

  it("draws a single point as a dot rather than as nothing", () => {
    const { container } = render(<LineChart label="One point" series={[{ name: "lr", points: [{ x: 0, y: 0.0001 }] }]} />);

    expect(paths(container)).toHaveLength(0);
    expect(container.querySelectorAll("circle")).toHaveLength(1);
  });

  it("survives a series that is constant, which a learning rate often is", () => {
    const { container } = render(
      <LineChart
        label="Flat"
        series={[
          {
            name: "lr",
            points: [
              { x: 0, y: 0.001 },
              { x: 100, y: 0.001 },
            ],
          },
        ]}
      />,
    );

    expect(paths(container)[0]?.getAttribute("d")).not.toContain("NaN");
  });

  it("puts every coordinate on a log axis at a finite pixel, including a zero", () => {
    const { container } = render(
      <LineChart
        label="Log"
        logY
        series={[
          {
            name: "loss",
            points: [
              { x: 0, y: 1 },
              { x: 1, y: 0 },
            ],
          },
        ]}
      />,
    );

    expect(paths(container)[0]?.getAttribute("d")).not.toContain("NaN");
  });

  describe("band", () => {
    const base = [0, 1, 2].map((x) => ({ x, y: x }));
    const band = { lower: [-1, 0, 1], upper: [1, 2, 3] };

    it("draws a translucent area in the series colour behind the line and adds a legend note", () => {
      const { container } = render(<LineChart label="Trend" series={[{ name: "k1", points: base, colour: "var(--series-2)", band }]} />);
      const area = container.querySelector<SVGPathElement>("[data-series-band]")!;
      expect(area.getAttribute("fill")).toBe("var(--series-2)");
      expect(area.getAttribute("d")).toMatch(/Z$/);
      expect(area.getAttribute("aria-hidden")).toBe("true");
      expect(screen.getByText("± band")).toBeTruthy();
      expect(container.querySelector("[data-band-swatch]")).not.toBeNull();
      // The band paints before the line.
      const all = [...container.querySelectorAll("path")];
      expect(all.indexOf(area)).toBeLessThan(all.length - 1);
    });

    it("names the band in the legend with its label", () => {
      render(<LineChart label="Trend" series={[{ name: "k1", points: base, band: { ...band, label: "±1σ" } }]} />);
      expect(screen.getByText("±1σ")).toBeTruthy();
    });

    it("grows the y domain to hold the band", () => {
      const { container } = render(
        <LineChart label="Trend" series={[{ name: "k1", points: base, band: { lower: [-10, 0, 1], upper: [1, 2, 30] } }]} />,
      );
      const labels = [...container.querySelectorAll("text")].map((t) => t.textContent);
      expect(labels).toContain("30");
    });

    it("changes nothing for a series without one", () => {
      const { container } = render(<LineChart label="Trend" series={[{ name: "k1", points: base }]} />);
      expect(container.querySelector("[data-series-band]")).toBeNull();
      expect(container.querySelector("[data-band-swatch]")).toBeNull();
    });
  });

  describe("xFormat", () => {
    it("writes the x tick labels", () => {
      const { container } = render(
        <LineChart
          label="Dates"
          xFormat={(x) => `d${x}`}
          series={[
            {
              name: "a",
              points: [
                { x: 0, y: 1 },
                { x: 10, y: 2 },
              ],
            },
          ]}
        />,
      );
      const labels = [...container.querySelectorAll("text")].map((t) => t.textContent);
      expect(labels).toContain("d0");
      expect(labels).toContain("d10");
    });
  });
});
