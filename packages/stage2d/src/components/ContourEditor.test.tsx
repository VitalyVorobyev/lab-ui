import { render, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ContourEditor, nearestContourSegment } from "./ContourEditor";
import { ImageStage } from "./stage/ImageStage";
import type { Point } from "./measureGeometry";

const points = [{ x: 2, y: 2 }, { x: 8, y: 2 }, { x: 8, y: 8 }, { x: 2, y: 8 }];

describe("ContourEditor", () => {
  it("chooses the closest segment for a new point", () => {
    expect(nearestContourSegment(points, { x: 5, y: 2.4 })).toBe(0);
    expect(nearestContourSegment(points, { x: 7.8, y: 5 })).toBe(1);
  });

  it("registers pixel-center geometry and keyboard editing", () => {
    const onChange = vi.fn<(points: Point[]) => void>();
    const { container, getByRole } = render(<ImageStage image={{ width: 100, height: 80 }} view={{ scale: 1, tx: 0, ty: 0 }} onView={() => {}}><ContourEditor points={points} onChange={onChange} editable /></ImageStage>);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("viewBox")).toBe("-0.5 -0.5 100 80");
    fireEvent.keyDown(getByRole("button", { name: "Contour point 1" }), { key: "ArrowRight" });
    expect(onChange.mock.calls[0]?.[0][0]).toEqual({ x: 3, y: 2 });
    fireEvent.keyDown(getByRole("button", { name: "Contour point 1" }), { key: "Delete" });
    expect(onChange.mock.calls[1]?.[0]).toHaveLength(3);
  });
});
