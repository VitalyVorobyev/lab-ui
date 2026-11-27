/**
 * What `ContourLayer` draws, batched and placed, pinned down without a browser.
 */

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ValuePlane } from "../api/mapValues";
import { ContourLayer, type ContourLayerProps } from "./ContourLayer";
import { ImageStage } from "./stage/ImageStage";
import type { StageView } from "./stage/view";

const IMAGE = { width: 400, height: 300 };
const VIEW: StageView = { scale: 1, tx: 0, ty: 0 };

/** 5 x 5 nodes, the value is the column index. */
const RAMP: ValuePlane = { width: 5, height: 5, stride: 1, channels: 1, values: Float32Array.from({ length: 25 }, (_, k) => k % 5) };

function layer(props: Partial<ContourLayerProps> = {}, view: StageView = VIEW) {
  return render(
    <ImageStage image={IMAGE} view={view} onView={() => {}}>
      <ContourLayer plane={RAMP} levels={[1.5, 2.5]} {...props} />
    </ImageStage>,
  );
}

describe("ContourLayer", () => {
  it("draws every solid level in one path under one halo, and names the lines and levels", () => {
    const { container } = layer();
    const svg = container.querySelector("svg[data-count]")!;
    expect(svg.getAttribute("data-count")).toBe("2");
    expect(svg.getAttribute("aria-label")).toBe("Contours: 2 lines at 1.5, 2.5");
    expect(container.querySelectorAll("path[data-contours]")).toHaveLength(1);
    expect(container.querySelector("path[data-contours]")?.getAttribute("stroke")).toBe("var(--stage-structure)");
    expect(container.querySelector("path[data-halo]")?.getAttribute("stroke")).toBe("var(--stage-halo)");
  });

  it("places a node at the centre of its pixel's share of the image, as the heatmap does", () => {
    // Level 2.5 is between columns 2 and 3: node 2.5 -> 3 pixel-widths of 80 in, from -0.5.
    const d = layer({ levels: [2.5] })
      .container.querySelector("path[data-contours]")!
      .getAttribute("d")!;
    expect(d.startsWith("M239.50 ")).toBe(true);
    expect(d).toContain("L239.50 ");
    const ys = [...d.matchAll(/ (-?[\d.]+)(?=[LM]|$)/g)].map((m) => Number(m[1]));
    expect(Math.min(...ys)).toBeCloseTo(29.5);
    expect(Math.max(...ys)).toBeCloseTo(269.5);
  });

  it("follows a placement rectangle", () => {
    const d = layer({ levels: [2.5], rect: { x: 100, y: 100, width: 50, height: 50 } })
      .container.querySelector("path[data-contours]")!
      .getAttribute("d")!;
    expect(d.startsWith("M")).toBe(true);
    const xs = [...d.matchAll(/[ML](-?[\d.]+) /g)].map((m) => Number(m[1]));
    expect(xs.every((x) => Math.abs(x - 130) < 1e-6)).toBe(true);
  });

  it("draws dashed levels in their own path, also when they are not among the levels", () => {
    const { container } = layer({ levels: [1.5], dashedLevels: [3.5] });
    expect(container.querySelector("svg")?.getAttribute("data-levels")).toBe("1.5,3.5");
    const dashed = container.querySelector("path[data-contours='dashed']")!;
    expect(dashed.getAttribute("stroke-dasharray")).toMatch(/^[\d.]+ [\d.]+$/);
    expect(container.querySelector("path[data-contours='solid']")).not.toBeNull();
    expect(container.querySelectorAll("path[data-halo]")).toHaveLength(2);
  });

  it("dashes a level that is in both lists", () => {
    const { container } = layer({ levels: [1.5, 2.5], dashedLevels: [2.5] });
    expect(container.querySelectorAll("path[data-contours]")).toHaveLength(2);
    expect(container.querySelector("svg")?.getAttribute("data-count")).toBe("2");
  });

  it("takes levels as a step over the finite range of the channel", () => {
    // 0..4: multiples of 1 are 0..4; the lines at 0 and 4 lie on the plane's edge nodes and are found where cells mix.
    const { container } = layer({ levels: { step: 1.5 } });
    expect(container.querySelector("svg")?.getAttribute("data-levels")).toBe("0,1.5,3");
  });

  it("labels long lines with their level, and not when labels are off or the lines are short", () => {
    const off = layer();
    expect(off.container.querySelector("[data-labels]")).toBeNull();
    off.unmount();
    const on = layer({ labels: true, levels: [2.5] });
    expect([...on.container.querySelectorAll("[data-labels] text")].map((t) => t.textContent)).toEqual(["2.5"]);
    on.unmount();
    const formatted = layer({ labels: (v) => `${v} px`, levels: [2.5] });
    expect(formatted.container.querySelector("[data-labels] text")?.textContent).toBe("2.5 px");
    formatted.unmount();
    // Zoomed far out the line is under 90 screen pixels: no label.
    const far = layer({ labels: true, levels: [2.5] }, { scale: 0.1, tx: 0, ty: 0 });
    expect(far.container.querySelector("[data-labels]")).toBeNull();
  });

  it("stops a line at a hole in the data", () => {
    const values = Float32Array.from(RAMP.values);
    values[2 * 5 + 2] = Number.NaN;
    const { container } = layer({ plane: { ...RAMP, values }, levels: [2.5] });
    expect(container.querySelector("svg")?.getAttribute("data-count")).toBe("2");
  });

  it("draws nothing for an empty level list, and no element while hidden", () => {
    const empty = layer({ levels: [] });
    expect(empty.container.querySelector("path")).toBeNull();
    expect(empty.container.querySelector("svg")?.getAttribute("aria-label")).toBe("Contours: 0 lines");
    empty.unmount();
    const hidden = layer({ visible: false });
    expect(hidden.container.querySelector("svg[data-count]")).toBeNull();
  });

  it("takes a colour or a role, and drops the halo on request", () => {
    const tone = layer({ color: "var(--x)", halo: false });
    expect(tone.container.querySelector("path[data-contours]")?.getAttribute("stroke")).toBe("var(--x)");
    expect(tone.container.querySelector("path[data-halo]")).toBeNull();
    tone.unmount();
    expect(layer({ role: "model" }).container.querySelector("path[data-contours]")?.getAttribute("stroke")).toBe("var(--stage-model)");
  });

  it("takes no pointer events", () => {
    expect(layer().container.querySelector("svg[data-count]")?.getAttribute("class")).toContain("pointer-events-none");
  });
});
