import { fireEvent, render } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { CompareLayer, type CompareLayerProps } from "./CompareLayer";
import { ImageStage } from "./ImageStage";
import type { StageView } from "./view";

const IMAGE = { width: 200, height: 100 };

function Stage(props: Partial<CompareLayerProps> & { onView?: (view: StageView) => void }) {
  const { onView, ...layer } = props;
  return (
    <ImageStage image={IMAGE} view={{ scale: 1, tx: 0, ty: 0 }} onView={(view) => onView?.(view)}>
      <CompareLayer a="a.png" b="b.png" mode="wipe" alt="Compared" {...layer} />
    </ImageStage>
  );
}

const slider = (container: HTMLElement) => container.querySelector<SVGElement>("[role=slider]")!;
const imageB = (container: HTMLElement) => container.querySelector<HTMLImageElement>("img[data-image=b]")!;

describe("CompareLayer", () => {
  it("draws both images as one named picture, with B over A", () => {
    const { container, getByRole } = render(<Stage mode="checker" />);
    const picture = getByRole("img", { name: "Compared" });
    const images = picture.querySelectorAll("img");
    expect([...images].map((image) => image.getAttribute("src"))).toEqual(["a.png", "b.png"]);
    for (const image of images) expect(image.getAttribute("alt")).toBe("");
    expect(container.querySelector("[data-mode=checker]")).not.toBeNull();
  });

  it("clamps the split it is given", () => {
    const { container, rerender } = render(<Stage defaultSplit={2} />);
    expect(slider(container).getAttribute("aria-valuenow")).toBe("100");
    rerender(<Stage split={-1} />);
    expect(slider(container).getAttribute("aria-valuenow")).toBe("0");
    expect(imageB(container).style.clipPath).toBe("inset(0 0 0 0%)");
    rerender(<Stage split={Number.NaN} />);
    expect(slider(container).getAttribute("aria-valuenow")).toBe("50");
  });

  it("moves the divider by key, reports it, and keeps the keys from the stage", () => {
    const onSplitChange = vi.fn();
    const onView = vi.fn();
    const { container } = render(<Stage defaultSplit={0.5} onSplitChange={onSplitChange} onView={onView} />);
    onView.mockClear();
    const knob = slider(container);
    fireEvent.keyDown(knob, { key: "ArrowRight" });
    expect(onSplitChange).toHaveBeenLastCalledWith(0.51);
    expect(knob.getAttribute("aria-valuenow")).toBe("51");
    fireEvent.keyDown(knob, { key: "ArrowLeft", shiftKey: true });
    expect(knob.getAttribute("aria-valuenow")).toBe("41");
    fireEvent.keyDown(knob, { key: "End" });
    expect(knob.getAttribute("aria-valuetext")).toBe("100 % A");
    fireEvent.keyDown(knob, { key: "ArrowRight" });
    expect(knob.getAttribute("aria-valuenow")).toBe("100");
    fireEvent.keyDown(knob, { key: "Home" });
    expect(onSplitChange).toHaveBeenLastCalledWith(0);
    // The stage pans on arrow keys; none reached it.
    expect(onView).not.toHaveBeenCalled();
    // A key the slider does not use is left alone.
    onSplitChange.mockClear();
    fireEvent.keyDown(knob, { key: "x" });
    expect(onSplitChange).not.toHaveBeenCalled();
  });

  it("follows a controlled split and only reports a change", () => {
    function Controlled() {
      const [split, setSplit] = useState(0.3);
      return <Stage split={split} onSplitChange={(next) => setSplit(Math.round(next * 10) / 10)} />;
    }
    const { container } = render(<Controlled />);
    const knob = slider(container);
    expect(knob.getAttribute("aria-valuenow")).toBe("30");
    fireEvent.keyDown(knob, { key: "PageUp" });
    expect(knob.getAttribute("aria-valuenow")).toBe("40");
    fireEvent.keyDown(knob, { key: "ArrowRight" });
    // The app rounded 0.41 back to 0.4: the divider stays where the app put it.
    expect(knob.getAttribute("aria-valuenow")).toBe("40");
  });

  it("names the images for the slider and puts their tags beside the knob", () => {
    const { container, rerender } = render(<Stage labels={["Model", "Match"]} />);
    expect(slider(container).getAttribute("aria-label")).toBe("Split between Model and Match");
    expect(container.querySelector("[data-tag=a]")?.textContent).toBe("Model");
    expect(container.querySelector("[data-tag=b]")?.textContent).toBe("Match");
    rerender(<Stage labels={["Model", "Match"]} orientation="horizontal" />);
    expect(slider(container).getAttribute("aria-orientation")).toBe("vertical");
    expect(container.querySelector("[data-tag=a]")?.getAttribute("text-anchor")).toBe("middle");
  });

  it("drags the divider from the band along it, and ignores a secondary button", () => {
    const onSplitChange = vi.fn();
    const { container } = render(<Stage onSplitChange={onSplitChange} />);
    const band = container.querySelector("[data-divider-band]")!;
    fireEvent.pointerDown(band, { button: 2, pointerType: "mouse", clientX: 100, clientY: 50 });
    fireEvent.pointerMove(window, { clientX: 150, clientY: 50 });
    expect(onSplitChange).not.toHaveBeenCalled();
    fireEvent.pointerDown(band, { button: 0, pointerType: "mouse", clientX: 100, clientY: 50 });
    expect(slider(container).hasAttribute("data-dragging")).toBe(true);
    fireEvent.pointerMove(window, { clientX: 150, clientY: 50 });
    fireEvent.pointerUp(window, { clientX: 150, clientY: 50 });
    expect(slider(container).hasAttribute("data-dragging")).toBe(false);
    expect(onSplitChange).toHaveBeenCalled();
  });

  it("draws pixels as blocks past pixelatedAbove", () => {
    const { container } = render(
      <ImageStage image={IMAGE} view={{ scale: 3, tx: 0, ty: 0 }} onView={() => {}}>
        <CompareLayer a="a.png" b="b.png" mode="difference" alt="Compared" pixelatedAbove={2} gain={2} className="extra" />
      </ImageStage>,
    );
    const wrapper = container.querySelector("[data-mode=difference]")!;
    expect(wrapper.hasAttribute("data-pixelated")).toBe(true);
    expect(wrapper.classList.contains("extra")).toBe(true);
    expect(imageB(container).style.imageRendering).toBe("pixelated");
    expect(container.querySelector<HTMLElement>("[role=img]")!.style.filter).toBe("brightness(2)");
  });
});
