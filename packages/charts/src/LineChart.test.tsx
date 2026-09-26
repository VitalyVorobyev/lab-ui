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
    const { container } = render(
      <LineChart label="Empty" series={[{ name: "loss_st", points: [] }]} />,
    );

    expect(paths(container)).toHaveLength(1);
    expect(paths(container)[0]?.getAttribute("d")).toEqual("");
    expect(screen.getByText("loss_st")).toBeTruthy();
  });

  it("draws a single point as a dot rather than as nothing", () => {
    const { container } = render(
      <LineChart label="One point" series={[{ name: "lr", points: [{ x: 0, y: 0.0001 }] }]} />,
    );

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
});
