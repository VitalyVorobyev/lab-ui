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

  describe("halo", () => {
    const roleCross: MeasurePrimitive = { kind: "point", x: 10, y: 10, cross: true, role: "model", label: "m1" };
    const toneDot: MeasurePrimitive = { kind: "point", x: 30, y: 30, tone: "normal", label: "t1" };

    function draw(primitives: MeasurePrimitive[], halo?: "role" | "all" | "none", strokeScale = 1) {
      return render(
        <MeasureOverlay nativeWidth={100} nativeHeight={100} primitives={primitives} strokeScale={strokeScale} halo={halo} />,
      ).container;
    }

    it("draws one under a primitive with a role and not under a tone, by default", () => {
      const container = draw([roleCross, toneDot]);
      const halos = container.querySelectorAll("[data-halo]");
      expect(halos).toHaveLength(1);
      expect(halos[0]!.closest("g[data-kind]")?.querySelector("text")?.textContent).toBe("m1");
    });

    it("draws one under every primitive with \"all\" and under none with \"none\"", () => {
      expect(draw([roleCross, toneDot], "all").querySelectorAll("[data-halo]")).toHaveLength(2);
      expect(draw([roleCross, toneDot], "none").querySelectorAll("[data-halo]")).toHaveLength(0);
    });

    it("is the same geometry in the halo colour, 2 screen px wider, at 60 %, beneath the mark", () => {
      const container = draw([{ kind: "segment", x1: 0, y1: 0, x2: 10, y2: 0, role: "feature" }], "role", 2);
      const group = container.querySelector("g[data-kind='segment']")!;
      const [halo, mark] = [...group.querySelectorAll("line")];
      expect(halo!.closest("[data-halo]")?.getAttribute("opacity")).toBe("0.6");
      expect(halo?.getAttribute("stroke")).toBe("var(--stage-halo)");
      expect(mark?.getAttribute("stroke")).toBe("var(--stage-feature)");
      // At scale 2, 1 screen px is 0.5 image px: the mark is 0.5 wide, its halo 0.5 + 1.
      expect(Number(mark!.getAttribute("stroke-width"))).toBeCloseTo(0.5, 6);
      expect(Number(halo!.getAttribute("stroke-width"))).toBeCloseTo(1.5, 6);
    });

    it("puts a 3 px halo behind a label's glyphs, and leaves an unhaloed label as it was", () => {
      const container = draw([roleCross, toneDot]);
      const [model, tone] = [...container.querySelectorAll("text")];
      expect(model?.getAttribute("stroke")).toBe("var(--stage-halo)");
      expect(model?.getAttribute("stroke-width")).toBe("3");
      expect(model?.getAttribute("paint-order")).toBe("stroke");
      expect(tone?.hasAttribute("stroke")).toBe(false);
      expect(tone?.hasAttribute("paint-order")).toBe(false);
    });

    it("draws no label in the halo pass", () => {
      const container = draw(
        [
          roleCross,
          { kind: "dimension", x1: 0, y1: 50, x2: 40, y2: 50, label: "40 px", role: "model" },
          { kind: "caliper", cx: 50, cy: 50, width: 20, height: 8, angle: 0, label: "c", role: "feature" },
        ],
        "role",
      );
      expect(container.querySelectorAll("[data-halo] text")).toHaveLength(0);
      expect(container.querySelectorAll("text")).toHaveLength(3);
      const dimension = container.querySelector("g[data-kind='dimension'] text");
      expect(dimension?.getAttribute("paint-order")).toBe("stroke");
    });

    it("grows a dot by 1 screen px and outlines a filled circle", () => {
      const container = draw(
        [
          { kind: "point", x: 10, y: 10, radius: 4, role: "feature" },
          { kind: "circle", cx: 50, cy: 50, r: 6, filled: true, role: "model" },
        ],
        "role",
      );
      const dots = container.querySelectorAll("g[data-kind='point'] circle");
      expect(dots[0]?.getAttribute("r")).toBe("5");
      expect(dots[1]?.getAttribute("r")).toBe("4");
      const discs = container.querySelectorAll("g[data-kind='circle'] circle");
      expect(discs[0]?.getAttribute("fill")).toBe("none");
      expect(discs[1]?.getAttribute("fill")).toBe("var(--stage-model)");
    });

    it("sits under a selected mark's ring and outgrows it", () => {
      const container = draw([{ kind: "segment", x1: 0, y1: 0, x2: 10, y2: 0, role: "feature", state: "selected" }]);
      const [halo, ring, mark] = [...container.querySelectorAll("line")].map((line) => Number(line.getAttribute("stroke-width")));
      expect(container.querySelectorAll("line")[1]?.getAttribute("stroke")).toBe("var(--stage-selection)");
      expect(mark).toBeCloseTo(2.5 / 1.5, 6);
      expect(ring).toBeCloseTo(mark! + 3, 6);
      expect(halo).toBeCloseTo(ring! + 2, 6);
    });

    it("breaks where a dashed mark does", () => {
      const container = draw([{ kind: "polyline", points: [0, 0, 50, 0], dashed: true, role: "model", state: "selected" }]);
      const dashes = new Set([...container.querySelectorAll("path")].map((path) => path.getAttribute("stroke-dasharray")));
      expect(dashes.size).toBe(1);
    });
  });

  describe("segments", () => {
    it("draws every segment as one path, labelled above the first", () => {
      const points = Array.from({ length: 2000 }, (_, i) => [i % 100, Math.floor(i / 100), (i % 100) + 0.5, Math.floor(i / 100)]).flat();
      const { container } = render(
        <MeasureOverlay
          nativeWidth={100}
          nativeHeight={100}
          primitives={[{ kind: "segments", points, role: "model", label: "ticks", dashed: true }]}
          strokeScale={1}
          halo="none"
        />,
      );
      const paths = container.querySelectorAll("g[data-kind='segments'] path");
      expect(paths).toHaveLength(1);
      expect(paths[0]!.getAttribute("d")!.match(/M/g)).toHaveLength(2000);
      expect(paths[0]?.getAttribute("fill")).toBe("none");
      expect(paths[0]?.hasAttribute("stroke-dasharray")).toBe(true);
      const label = container.querySelector("text")!;
      expect(label.textContent).toBe("ticks");
      expect(Number(label.getAttribute("y"))).toBeLessThan(0);
    });

    it("draws no label without a whole segment", () => {
      const { container } = render(
        <MeasureOverlay nativeWidth={100} nativeHeight={100} primitives={[{ kind: "segments", points: [1, 2], label: "x" }]} strokeScale={1} />,
      );
      expect(container.querySelector("text")).toBeNull();
      expect(container.querySelector("path")?.getAttribute("d")).toBe("");
    });
  });
});
