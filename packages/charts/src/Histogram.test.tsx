import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ScoreHistogram } from "./Histogram";

describe("ScoreHistogram", () => {
  it("bins both classes on one axis and marks the threshold", () => {
    const { container } = render(
      <ScoreHistogram
        label="Scores"
        normal={[0.1, 0.2, 0.15]}
        defect={[0.8, 0.9]}
        threshold={0.5}
        bins={4}
      />,
    );

    expect(container.querySelectorAll("rect").length).toBeGreaterThan(0);
    expect(container.querySelectorAll("line[stroke-dasharray]")).toHaveLength(1);
    expect(screen.getByText("normal (3)")).toBeTruthy();
    expect(screen.getByText("defect (2)")).toBeTruthy();
  });

  it("renders a subset with no defects without throwing", () => {
    render(<ScoreHistogram label="Normals only" normal={[0.1, 0.2]} defect={[]} />);
    expect(screen.getByText("defect (0)")).toBeTruthy();
  });

  it("renders nothing scored at all without throwing", () => {
    const { container } = render(<ScoreHistogram label="Empty" normal={[]} defect={[]} />);
    expect(container.querySelector("svg")).toBeTruthy();
  });
});
