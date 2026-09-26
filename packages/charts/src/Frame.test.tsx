import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StackedBars } from "./BarChart";
import { DEFECT_COLOUR, Legend, NORMAL_COLOUR, SERIES_COLOURS, seriesColour } from "./Frame";
import { ScoreHistogram } from "./Histogram";
import { LineChart } from "./LineChart";
import { LineProfile } from "./LineProfile";

describe("palette", () => {
  it("is design tokens, never literals, so it follows the theme", () => {
    for (const colour of [...SERIES_COLOURS, NORMAL_COLOUR, DEFECT_COLOUR]) {
      expect(colour).toMatch(/^var\(--[a-z0-9-]+\)$/);
    }
    expect(NORMAL_COLOUR).toEqual("var(--normal)");
    expect(DEFECT_COLOUR).toEqual("var(--defect)");
  });

  it("never paints a series in a verdict colour", () => {
    expect(SERIES_COLOURS).not.toContain(NORMAL_COLOUR);
    expect(SERIES_COLOURS).not.toContain(DEFECT_COLOUR);
  });

  it("cycles through the series tokens, and falls back to a neutral", () => {
    expect(seriesColour(0)).toEqual("var(--series-1)");
    expect(seriesColour(SERIES_COLOURS.length)).toEqual("var(--series-1)");
    expect(seriesColour(-1)).toEqual("var(--fg-muted)");
  });
});

describe("className", () => {
  const point = [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
  ];

  it("is merged onto the outer element of every chart", () => {
    const { container } = render(
      <>
        <LineChart label="a" className="chart-a" series={[{ name: "s", points: point }]} />
        <LineProfile label="b" className="chart-b" series={[{ name: "s", points: point }]} />
        <ScoreHistogram label="c" className="chart-c" normal={[0.1]} defect={[0.9]} />
        <StackedBars label="d" className="chart-d" rows={[]} />
        <Legend className="chart-e" items={[{ label: "s", colour: seriesColour(0) }]} />
      </>,
    );
    for (const name of ["a", "b", "c"]) {
      const figure = screen.getByRole("img", { name }).closest("figure");
      expect(figure?.classList.contains(`chart-${name}`)).toBe(true);
      expect(figure?.classList.contains("flex")).toBe(true);
    }
    expect(screen.getByRole("table", { name: "d" }).className).toContain("chart-d");
    expect(container.querySelector("ul.chart-e")).not.toBeNull();
  });
});
