import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MeasureOverlay, type MeasurePrimitive } from "./MeasureOverlay";

describe("MeasureOverlay", () => {
  it("sets the viewBox to the native image size, so primitives are drawn in image pixels", () => {
    const { container } = render(
      <MeasureOverlay nativeWidth={640} nativeHeight={480} primitives={[]} strokeScale={1} />,
    );

    // Shifted by half a pixel, not `0 0 640 480`: image results name pixel *centres* while
    // SVG names a pixel's leading edge, and drawing a measured point at the raw coordinate
    // put it on the boundary of the pixel it was measured in. Same extent, so nothing about
    // sizing changes with it. See `stage/view.ts`'s `imageViewBox`.
    expect(container.querySelector("svg")?.getAttribute("viewBox")).toBe("-0.5 -0.5 640 480");
  });

  it("draws one shape per primitive, in the tone's colour", () => {
    const primitives: MeasurePrimitive[] = [
      { kind: "segment", x1: 0, y1: 0, x2: 10, y2: 10, tone: "defect" },
      { kind: "circle", cx: 5, cy: 5, r: 3, tone: "normal" },
    ];
    const { container } = render(
      <MeasureOverlay nativeWidth={100} nativeHeight={100} primitives={primitives} strokeScale={1} />,
    );

    const line = container.querySelector("line");
    const circle = container.querySelector("circle");
    expect(line?.getAttribute("stroke")).toBe("var(--defect)");
    expect(circle?.getAttribute("stroke")).toBe("var(--normal)");
  });

  it("shrinks stroke width as the screen scale grows, so a 1px line stays 1px", () => {
    const primitive: MeasurePrimitive = { kind: "segment", x1: 0, y1: 0, x2: 10, y2: 0 };
    const { container: at1 } = render(
      <MeasureOverlay nativeWidth={100} nativeHeight={100} primitives={[primitive]} strokeScale={1} />,
    );
    const { container: at4 } = render(
      <MeasureOverlay nativeWidth={100} nativeHeight={100} primitives={[primitive]} strokeScale={4} />,
    );

    const widthAt1 = Number(at1.querySelector("line")?.getAttribute("stroke-width"));
    const widthAt4 = Number(at4.querySelector("line")?.getAttribute("stroke-width"));
    expect(widthAt4).toBeCloseTo(widthAt1 / 4, 6);
  });

  it("draws a caliper as a closed box with a direction arrow", () => {
    const primitive: MeasurePrimitive = {
      kind: "caliper",
      cx: 50,
      cy: 50,
      width: 20,
      height: 8,
      angle: 0,
    };
    const { container } = render(
      <MeasureOverlay nativeWidth={100} nativeHeight={100} primitives={[primitive]} strokeScale={1} />,
    );

    const box = container.querySelector("path");
    expect(box?.getAttribute("d")).toContain("Z");
    expect(container.querySelector("polyline")).not.toBeNull();
  });

  it("labels a dimension at the midpoint of its offset line", () => {
    const primitive: MeasurePrimitive = {
      kind: "dimension",
      x1: 0,
      y1: 0,
      x2: 20,
      y2: 0,
      label: "12.4 mm",
    };
    const { container, getByText } = render(
      <MeasureOverlay nativeWidth={100} nativeHeight={100} primitives={[primitive]} strokeScale={1} />,
    );

    expect(getByText("12.4 mm")).toBeTruthy();
    // Three lines: two extension lines and the dimension line itself.
    expect(container.querySelectorAll("line")).toHaveLength(3);
  });

  it("marks a cross point with two segments rather than a dot", () => {
    const primitive: MeasurePrimitive = { kind: "point", x: 10, y: 10, cross: true };
    const { container } = render(
      <MeasureOverlay nativeWidth={100} nativeHeight={100} primitives={[primitive]} strokeScale={1} />,
    );

    expect(container.querySelectorAll("line")).toHaveLength(2);
    expect(container.querySelector("circle")).toBeNull();
  });

  it("renders nothing for an empty primitive list without throwing", () => {
    const { container } = render(
      <MeasureOverlay nativeWidth={100} nativeHeight={100} primitives={[]} strokeScale={1} />,
    );

    expect(container.querySelector("svg")).toBeTruthy();
  });
});
