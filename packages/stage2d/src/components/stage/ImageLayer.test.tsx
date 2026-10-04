/**
 * When each tier is on screen: the preview until the stage would magnify it, then the full
 * image (asked for through `onFullNeeded` when its URL is not known up front), kept once
 * loaded.
 */

import { fireEvent, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ImageLayer, type ImageLayerProps } from "./ImageLayer";
import { ImageStage } from "./ImageStage";
import type { Box, StageView } from "./view";

const IMAGE = { width: 1000, height: 800 };
const BOX = { width: 500, height: 400 };
/** 600 px wide: enough at fit (0.5 × 1000 = 500 screen px), magnified at 100%. */
const PREVIEW = { src: "preview.png", width: 600 };
const FIT: StageView = { scale: 0.5, tx: 0, ty: 0 };
const ACTUAL: StageView = { scale: 1, tx: 0, ty: 0 };

/** happy-dom lays nothing out: report a fixed viewport, as the browser would measure it. */
function withLayout(box: Box = BOX) {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => ({
    left: 0,
    top: 0,
    right: box.width,
    bottom: box.height,
    ...box,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private readonly callback: ResizeObserverCallback) {}
      observe(element: Element) {
        this.callback([{ target: element, contentRect: box } as unknown as ResizeObserverEntry], this);
      }
      unobserve() {}
      disconnect() {}
    },
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function stage(view: StageView, layer: ReactNode) {
  return (
    <ImageStage image={IMAGE} view={view} onView={() => {}}>
      {layer}
    </ImageStage>
  );
}

function tiers(container: HTMLElement) {
  return {
    preview: container.querySelector<HTMLImageElement>("img[data-tier=preview]"),
    full: container.querySelector<HTMLImageElement>("img[data-tier=full]"),
  };
}

describe("ImageLayer", () => {
  it("shows the full image from the start without a preview, and reports its load and failure", () => {
    withLayout();
    const onLoad = vi.fn();
    const onError = vi.fn();
    const onFullNeeded = vi.fn();
    const { container } = render(
      stage(FIT, <ImageLayer src="full.png" alt="Frame" onLoad={onLoad} onError={onError} onFullNeeded={onFullNeeded} />),
    );
    const { preview, full } = tiers(container);
    expect(preview).toBeNull();
    expect(full?.getAttribute("alt")).toBe("Frame");
    expect(full?.hasAttribute("data-loaded")).toBe(false);
    fireEvent.load(full!);
    expect(onLoad).toHaveBeenCalledOnce();
    expect(full?.hasAttribute("data-loaded")).toBe(true);
    fireEvent.error(full!);
    expect(onError).toHaveBeenCalledOnce();
    // Nothing to ask for without a preview.
    expect(onFullNeeded).not.toHaveBeenCalled();
  });

  it("keeps the preview until the stage would magnify it, then requests the full image and keeps it", () => {
    withLayout();
    const onFullNeeded = vi.fn();
    const layer = (view: StageView) =>
      stage(view, <ImageLayer src="full.png" preview={PREVIEW} alt="Frame" onFullNeeded={onFullNeeded} />);
    const { container, rerender } = render(layer(FIT));
    expect(tiers(container).full).toBeNull();
    expect(tiers(container).preview?.getAttribute("alt")).toBe("Frame");
    expect(tiers(container).preview?.hasAttribute("data-wants-full")).toBe(false);
    expect(onFullNeeded).not.toHaveBeenCalled();

    rerender(layer(ACTUAL));
    const { preview, full } = tiers(container);
    // Both on screen while the full image loads: the preview is announced no more.
    expect(full?.getAttribute("src")).toBe("full.png");
    expect(full?.className).toContain("opacity-0");
    expect(preview?.getAttribute("alt")).toBe("");
    expect(preview?.getAttribute("aria-hidden")).toBe("true");
    expect(preview?.hasAttribute("data-wants-full")).toBe(true);
    expect(onFullNeeded).toHaveBeenCalledOnce();

    fireEvent.load(full!);
    expect(tiers(container).preview).toBeNull();
    expect(tiers(container).full?.className).not.toContain("opacity-0");

    // Back at fit, the full image stays and nothing is asked again.
    rerender(layer(FIT));
    expect(tiers(container).full).not.toBeNull();
    expect(tiers(container).preview).toBeNull();
    expect(onFullNeeded).toHaveBeenCalledOnce();
  });

  it("asks for the full image when its URL is not known yet, and shows it once it arrives", () => {
    withLayout();
    const onFullNeeded = vi.fn();
    const onLoad = vi.fn();
    const layer = (view: StageView, src?: string) => {
      const props: ImageLayerProps = { preview: PREVIEW, alt: "Frame", onFullNeeded, onLoad, ...(src ? { src } : {}) };
      return stage(view, <ImageLayer {...props} />);
    };
    const { container, rerender } = render(layer(FIT));
    expect(tiers(container).preview?.hasAttribute("data-wants-full")).toBe(false);

    rerender(layer(ACTUAL));
    expect(onFullNeeded).toHaveBeenCalledOnce();
    // Wanted, but there is nothing to show yet: the preview stands in, still announced.
    expect(tiers(container).full).toBeNull();
    expect(tiers(container).preview?.hasAttribute("data-wants-full")).toBe(true);
    expect(tiers(container).preview?.getAttribute("alt")).toBe("Frame");

    // A new callback does not ask again for the same preview.
    rerender(layer({ scale: 1.5, tx: 0, ty: 0 }));
    expect(onFullNeeded).toHaveBeenCalledOnce();

    // The URL arrives, even after zooming back out: it was wanted, so it is shown.
    rerender(layer(FIT, "full.png"));
    const { full } = tiers(container);
    expect(full?.getAttribute("src")).toBe("full.png");
    fireEvent.load(full!);
    expect(onLoad).toHaveBeenCalledOnce();
    expect(tiers(container).preview).toBeNull();
  });

  it("asks again for a new preview, once the stage would magnify that one", () => {
    withLayout();
    const onFullNeeded = vi.fn();
    const layer = (view: StageView, preview: typeof PREVIEW) =>
      stage(view, <ImageLayer preview={preview} alt="" onFullNeeded={onFullNeeded} />);
    const { container, rerender } = render(layer(ACTUAL, PREVIEW));
    expect(onFullNeeded).toHaveBeenCalledOnce();

    // The next frame: its preview is enough at fit, so it is not wanted yet.
    const next = { src: "next-preview.png", width: 600 };
    rerender(layer(FIT, next));
    expect(tiers(container).preview?.hasAttribute("data-wants-full")).toBe(false);
    expect(onFullNeeded).toHaveBeenCalledOnce();
    rerender(layer(ACTUAL, next));
    expect(onFullNeeded).toHaveBeenCalledTimes(2);
    expect(tiers(container).preview?.hasAttribute("data-wants-full")).toBe(true);
  });

  it("does not want the full image before the viewport is measured", () => {
    // No layout: the stage's placeholder view is 1:1, which would otherwise magnify the preview.
    const onFullNeeded = vi.fn();
    const { container } = render(
      <ImageStage image={IMAGE} view={null} onView={() => {}}>
        <ImageLayer src="full.png" preview={PREVIEW} alt="Frame" onFullNeeded={onFullNeeded} />
      </ImageStage>,
    );
    expect(tiers(container).full).toBeNull();
    expect(onFullNeeded).not.toHaveBeenCalled();
  });

  it("draws pixels as blocks from pixelatedAbove", () => {
    withLayout();
    const layer = (view: StageView) =>
      stage(view, <ImageLayer src="full.png" preview={PREVIEW} alt="Frame" pixelatedAbove={2} className="extra" />);
    const { container, rerender } = render(layer(ACTUAL));
    expect(tiers(container).full?.hasAttribute("data-pixelated")).toBe(false);
    expect(tiers(container).full?.className).toContain("extra");
    rerender(layer({ scale: 2, tx: 0, ty: 0 }));
    const { preview, full } = tiers(container);
    for (const image of [preview, full]) {
      expect(image?.hasAttribute("data-pixelated")).toBe(true);
      expect(image?.style.imageRendering).toBe("pixelated");
    }
  });
});
