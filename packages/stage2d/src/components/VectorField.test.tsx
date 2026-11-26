/**
 * The batching, colouring, scale and picking of `VectorField`, and its key, pinned down without
 * a browser.
 */

import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ImageStage } from "./stage/ImageStage";
import type { StageView } from "./stage/view";
import { VectorField, type VectorFieldProps } from "./VectorField";
import { VectorFieldKey } from "./VectorFieldKey";

const IMAGE = { width: 400, height: 300 };
const VIEW: StageView = { scale: 1, tx: 0, ty: 0 };

/** Four vectors of length 1, 2, 3 and 4 along +x, plus one absent. */
const ANCHORS = [50, 50, 100, 100, 150, 150, 200, 200, 250, 250];
const VECTORS = [1, 0, 2, 0, 3, 0, 4, 0, Number.NaN, 1];

function field(props: Partial<VectorFieldProps> = {}, view: StageView = VIEW) {
  return render(
    <ImageStage image={IMAGE} view={view} onView={() => {}}>
      <VectorField anchors={ANCHORS} vectors={VECTORS} scale={10} {...props} />
    </ImageStage>,
  );
}

describe("VectorField", () => {
  it("draws every present vector in one path under one halo, and names the count", () => {
    const { container } = field();
    const svg = container.querySelector("svg[data-count]")!;
    expect(svg.getAttribute("data-count")).toBe("4");
    expect(svg.getAttribute("aria-label")).toBe("Vectors: 4 vectors");
    expect(container.querySelectorAll("path[data-batch]")).toHaveLength(1);
    expect(container.querySelector("path[data-halo]")?.getAttribute("stroke")).toBe("var(--stage-halo)");
    expect(container.querySelector("path[data-batch]")?.getAttribute("stroke")).toBe("var(--stage-feature)");
    // Four shafts and four heads.
    expect(container.querySelector("path[data-batch]")?.getAttribute("d")?.match(/M/g)).toHaveLength(8);
  });

  it("takes a colour or a role, and drops the halo on request", () => {
    const tone = field({ color: "var(--x)", halo: false });
    expect(tone.container.querySelector("path[data-batch]")?.getAttribute("fill")).toBe("var(--x)");
    expect(tone.container.querySelector("path[data-halo]")).toBeNull();
    tone.unmount();
    const model = field({ role: "model" });
    expect(model.container.querySelector("path[data-batch]")?.getAttribute("stroke")).toBe("var(--stage-model)");
  });

  it("scales the arrows: image pixels per data unit, or the reference vector at a screen length", () => {
    const numeric = field({ scale: 10 });
    // The 4-unit vector at (200, 200) ends at (240, 200).
    expect(numeric.container.querySelector("path[data-batch]")?.getAttribute("d")).toContain("M240 200L");
    numeric.unmount();
    // The longest (4) spans 80 screen px = 80 image px at 1:1: 20 image px per unit.
    const auto = field({ scale: { length: 80 } });
    expect(auto.container.querySelector("path[data-batch]")?.getAttribute("d")).toContain("M280 200L");
    auto.unmount();
    // The same field at 4x zoom keeps its screen length: 80 screen px = 20 image px.
    const zoomed = field({ scale: { length: 80 } }, { scale: 4, tx: 0, ty: 0 });
    expect(zoomed.container.querySelector("path[data-batch]")?.getAttribute("d")).toContain("M220 200L");
  });

  it("colours by magnitude through a colormap, one path per step used", () => {
    const colormap = vi.fn((t: number): [number, number, number] => [Math.round(255 * t), 0, 0]);
    const { container } = field({ colormap });
    const batches = [...container.querySelectorAll("path[data-batch]")];
    expect(batches).toHaveLength(4);
    // The longest is in the map's last step, the shortest a quarter of the way up.
    const strokes = batches.map((b) => b.getAttribute("stroke"));
    expect(strokes[0]).toBe("rgb(69 0 0)");
    expect(strokes.at(-1)).toBe("rgb(250 0 0)");
    expect(new Set(strokes).size).toBe(4);
  });

  it("honours a fixed range: values beyond it share the end colour", () => {
    const colormap = (t: number): [number, number, number] => [Math.round(255 * t), 0, 0];
    const { container } = field({ colormap, range: { low: 0, high: 2 } });
    // Magnitudes 2, 3 and 4 all clamp to the top bin.
    expect(container.querySelectorAll("path[data-batch]")).toHaveLength(2);
  });

  it("skips non-finite anchors and sub-pixel vectors", () => {
    const { container } = field({ anchors: [Number.NaN, 5, 100, 100], vectors: [5, 5, 0.01, 0] });
    expect(container.querySelector("svg[data-count]")?.getAttribute("data-count")).toBe("0");
    expect(container.querySelector("path[data-batch]")).toBeNull();
  });

  it("picks a vector by its anchor and redraws the hovered one in the selection colour", () => {
    const onHoverChange = vi.fn();
    const { container } = field({ onHoverChange, scale: 10 });
    const viewport = container.querySelector("[role=application]")!;
    // At 1:1 with the viewport at the origin (happy-dom lays nothing out), client = image + 0.5.
    fireEvent.pointerMove(viewport, { clientX: 150.5, clientY: 150.5, pointerId: 1 });
    expect(onHoverChange).toHaveBeenLastCalledWith(2);
    expect(container.querySelector("svg[data-hovered]")?.getAttribute("data-hovered")).toBe("2");
    expect(container.querySelector("path[data-hovered-vector]")?.getAttribute("stroke")).toBe("var(--stage-selection)");
    fireEvent.pointerMove(viewport, { clientX: 20.5, clientY: 280.5, pointerId: 1 });
    expect(onHoverChange).toHaveBeenLastCalledWith(null);
    expect(container.querySelector("path[data-hovered-vector]")).toBeNull();
  });

  it("reports the ids it is given and takes hover as controlled", () => {
    const { container } = field({ ids: ["a", "b", "c", "d", "e"], hoveredId: "d" });
    expect(container.querySelector("svg[data-hovered]")?.getAttribute("data-hovered")).toBe("d");
    expect(container.querySelector("path[data-hovered-vector]")).not.toBeNull();
  });

  it("is not picked when pickable is off", () => {
    const onHoverChange = vi.fn();
    const { container } = field({ onHoverChange, pickable: false });
    fireEvent.pointerMove(container.querySelector("[role=application]")!, { clientX: 150.5, clientY: 150.5, pointerId: 1 });
    expect(onHoverChange).not.toHaveBeenCalled();
  });

  it("draws a big field as a few paths", () => {
    const n = 5000;
    const anchors = new Float64Array(2 * n);
    const vectors = new Float64Array(2 * n).fill(1);
    for (let i = 0; i < n; i++) {
      anchors[2 * i] = 20_000 * (i / n);
      anchors[2 * i + 1] = 50;
    }
    const { container } = render(
      <ImageStage image={{ width: 20_000, height: 100 }} view={{ scale: 1, tx: 0, ty: 0 }} onView={() => {}}>
        <VectorField anchors={anchors} vectors={vectors} scale={5} />
      </ImageStage>,
    );
    // Happy-dom has no layout, so the stage is unmeasured and nothing is culled; the story checks the cull in Chromium.
    expect(container.querySelector("svg[data-count]")?.getAttribute("data-count")).toBe(String(n));
  });
});

describe("VectorFieldKey", () => {
  const key = (props: Partial<React.ComponentProps<typeof VectorFieldKey>> = {}, view: StageView = VIEW) =>
    render(
      <ImageStage image={IMAGE} view={view} onView={() => {}}>
        <VectorFieldKey vectors={VECTORS} scale={10} unit="px" {...props} />
      </ImageStage>,
    );

  it("shows a round length at the field's scale", () => {
    const { container } = key();
    const el = container.querySelector("[data-vector-key]")!;
    // The reference (longest, 4) gives a key of 2; at 10 image px per unit and 1:1 it is 20 screen px.
    expect(el.textContent).toBe("2 px");
    expect(el.querySelector("svg")?.getAttribute("width")).toBe("22");
  });

  it("follows the zoom, and takes a length and a format", () => {
    const { container } = key({ length: 0.5, format: (v) => v.toFixed(2) }, { scale: 2, tx: 0, ty: 0 });
    const el = container.querySelector("[data-vector-key]")!;
    expect(el.textContent).toBe("0.50 px");
    expect(el.querySelector("svg")?.getAttribute("width")).toBe("12");
  });

  it("draws nothing when the arrow would be absurdly wide or the field has no scale", () => {
    expect(key({ scale: 1000 }).container.querySelector("[data-vector-key]")).toBeNull();
    expect(key({ vectors: [], scale: { length: 40 } }).container.querySelector("[data-vector-key]")).toBeNull();
  });

  it("drops its chip when bare", () => {
    const { container } = key({ bare: true });
    expect(container.querySelector("[data-vector-key]")?.className).not.toContain("bg-black");
  });
});
