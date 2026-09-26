import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LineProfile } from "./LineProfile";
import { areaFor } from "./Frame";
import { extent, linearScale } from "./scale";

describe("LineProfile", () => {
  it("draws one path per profile series and names each in the legend", () => {
    const { container } = render(
      <LineProfile
        label="Edge profile"
        series={[
          { name: "row 40", points: [{ x: 0, y: 10 }, { x: 5, y: 200 }, { x: 10, y: 205 }] },
          { name: "row 41", points: [{ x: 0, y: 12 }, { x: 5, y: 198 }, { x: 10, y: 202 }] },
        ]}
      />,
    );

    expect(container.querySelectorAll("path")).toHaveLength(2);
    expect(screen.getByLabelText("Edge profile")).toBeTruthy();
    expect(screen.getByText("row 40")).toBeTruthy();
    expect(screen.getByText("row 41")).toBeTruthy();
  });

  it("omits the legend for a single series, which has nothing to distinguish", () => {
    render(<LineProfile label="One row" series={[{ name: "row 40", points: [{ x: 0, y: 1 }, { x: 1, y: 2 }] }]} />);

    expect(screen.queryByText("row 40")).toBeNull();
  });

  it("places a detected-edge rule at exactly the scale's projected pixel", () => {
    // The same arithmetic `scale.ts`'s own tests exercise, here checked end to end through
    // the component: a rendered rule at arc length 6 must land where `linearScale` says
    // arc length 6 belongs, in the "wide" variant's own plot area.
    const { container } = render(
      <LineProfile
        label="Profile"
        variant="wide"
        series={[{ name: "s", points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] }]}
        edges={[{ position: 6, label: "edge" }]}
      />,
    );

    const plotArea = areaFor("wide");
    const xScale = linearScale(extent([0, 10, 6]), plotArea.x0, plotArea.x1);
    const expectedX = xScale.project(6);

    const rule = container.querySelector('line[stroke-dasharray]');
    expect(rule).not.toBeNull();
    expect(Number(rule?.getAttribute("x1"))).toBeCloseTo(expectedX, 1);
    expect(rule?.getAttribute("x1")).toBe(rule?.getAttribute("x2"));
    expect(screen.getByText("edge")).toBeTruthy();
  });

  it("draws an edge mark with no label as a bare rule", () => {
    const { container } = render(
      <LineProfile
        label="Profile"
        series={[{ name: "s", points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] }]}
        edges={[{ position: 3 }]}
      />,
    );

    expect(container.querySelectorAll('line[stroke-dasharray]')).toHaveLength(1);
    expect(container.querySelectorAll("text")).not.toHaveLength(0); // axis ticks still render
  });

  it("draws a single-point series as a dot rather than nothing", () => {
    const { container } = render(
      <LineProfile label="One sample" series={[{ name: "s", points: [{ x: 0, y: 5 }] }]} />,
    );

    expect(container.querySelectorAll("path")).toHaveLength(0);
    expect(container.querySelectorAll("circle")).toHaveLength(1);
  });

  it("renders an empty profile without throwing", () => {
    const { container } = render(<LineProfile label="Empty" series={[]} />);

    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("labels the axes with arc length and value by default", () => {
    render(<LineProfile label="Defaults" series={[{ name: "s", points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }]} />);

    expect(screen.getByText("arc length (px)")).toBeTruthy();
    expect(screen.getByText("value")).toBeTruthy();
  });
});
