import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DraftShape, type DraftShapeSpec } from "./DraftShape";
import { ImageStage } from "./stage/ImageStage";

const image = { width: 100, height: 80 };

function draw(shape: DraftShapeSpec | null, scale = 1, extra: { stroke?: string } = {}) {
  return render(
    <ImageStage image={image} view={{ scale, tx: 0, ty: 0 }} onView={() => {}}>
      <DraftShape shape={shape} {...extra} />
    </ImageStage>,
  ).container;
}

describe("DraftShape closing cue", () => {
  const points = [10, 10, 50, 10, 50, 40];

  it("draws the closing edge dashed and faint, with no first-vertex ring, until the cursor is on the first vertex", () => {
    const c = draw({ kind: "polygon", points, cursor: { x: 30, y: 30 } });
    const closing = c.querySelector("path[data-draft-closing]")!;
    expect(closing.getAttribute("stroke-dasharray")).toBe("6 4");
    expect(closing.getAttribute("opacity")).toBe("0.5");
    expect(c.querySelector("path[data-draft-first]")).toBeNull();
  });

  it("highlights the first vertex and draws the closing edge solid, from the last vertex, when closing", () => {
    const c = draw({ kind: "polygon", points, cursor: { x: 10, y: 10 }, closing: true });
    const closing = c.querySelector("path[data-draft-closing]")!;
    expect(closing.getAttribute("d")).toBe("M50 40L10 10");
    expect(closing.getAttribute("stroke-dasharray")).toBeNull();
    expect(closing.getAttribute("opacity")).toBe("1");
    expect(c.querySelector("path[data-draft-first]")?.getAttribute("d")).toMatch(/^M15 10a5 5/);
  });
});

describe("DraftShape stroke", () => {
  const trail: DraftShapeSpec = { kind: "stroke", points: [10, 10, 20, 15], width: 12 };

  it("is as wide as the brush in image pixels at any zoom", () => {
    for (const scale of [1, 4]) {
      const el = draw(trail, scale).querySelector("path[data-draft-stroke]")!;
      expect(el.getAttribute("stroke-width")).toBe("12");
      expect(el.getAttribute("stroke-dasharray")).toBeNull();
      expect(el.getAttribute("d")).toBe("M10 10L20 15");
    }
  });

  it("is never thinner than one screen pixel", () => {
    const thin: DraftShapeSpec = { kind: "stroke", points: [10, 10, 20, 15], width: 0.1 };
    expect(Number(draw(thin, 1).querySelector("path[data-draft-stroke]")!.getAttribute("stroke-width"))).toBeCloseTo(1);
    expect(Number(draw(thin, 4).querySelector("path[data-draft-stroke]")!.getAttribute("stroke-width"))).toBeCloseTo(0.25);
  });

  it("takes a typed-array view, a single point as a dot, and a colour override", () => {
    const buffer = new Float64Array(8);
    buffer.set([5, 6, 7, 8]);
    const c = draw({ kind: "stroke", points: buffer.subarray(0, 4), width: 3 }, 1, { stroke: "var(--defect)" });
    const el = c.querySelector("path[data-draft-stroke]")!;
    expect(el.getAttribute("d")).toBe("M5 6L7 8");
    expect(el.getAttribute("stroke")).toBe("var(--defect)");
    expect(draw({ kind: "stroke", points: [5, 6], width: 3 }).querySelector("path[data-draft-stroke]")?.getAttribute("d")).toBe("M5 6h0");
    expect(draw({ kind: "stroke", points: [], width: 3 }).querySelector("path")).toBeNull();
  });
});

describe("DraftShape brush", () => {
  it("is a circle of the given diameter in image pixels, under a dark halo ring", () => {
    const c = draw({ kind: "brush", x: 30, y: 20, diameter: 10 });
    expect(c.querySelector("path[data-draft-brush]")?.getAttribute("d")).toBe("M35 20a5 5 0 1 0 -10 0a5 5 0 1 0 10 0Z");
    const paths = [...c.querySelectorAll("svg[data-draft=brush] path")];
    expect(paths).toHaveLength(2);
    expect(paths[0]!.getAttribute("stroke")).toBe("var(--stage-halo)");
    expect(paths[1]!.hasAttribute("data-draft-brush")).toBe(true);
  });

  it("keeps a screen-pixel floor so a tiny brush is still visible when zoomed out", () => {
    const d = draw({ kind: "brush", x: 30, y: 20, diameter: 0.1 }, 0.5).querySelector("path[data-draft-brush]")!.getAttribute("d")!;
    expect(d).toMatch(/^M32 20a2 2 /);
  });
});
