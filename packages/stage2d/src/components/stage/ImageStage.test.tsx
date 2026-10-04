/**
 * What the pure view math cannot prove: that the DOM the stage builds is the one the math
 * describes, and that a press reaching the viewport is read as a pan while a press a layer
 * claims is not.
 */

import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ImageStage,
  useStage,
  type ImageStageProps,
  type StageContext,
  type StageHandle,
  type StageViewChange,
} from "./ImageStage";
import type { StagePointerEvent } from "./hitContext";
import type { HitId } from "./hitTest";
import { useStageHitLayer } from "./useStageHitTest";
import { MAX_SCALE, PIXEL_CENTRE, clampView, fitView, initialView, toImage, type Box, type StageView } from "./view";

const IMAGE = { width: 1280, height: 1024 };
const BOX = { width: 800, height: 600 };

/** Every live observer's callback, so a test can report a resize. */
let observers: { callback: ResizeObserverCallback; element: Element }[] = [];

/**
 * happy-dom lays nothing out, so `getBoundingClientRect` is 0×0 and `ResizeObserver` never
 * fires. Both are stubbed to a fixed box: the component's contract is "whatever the
 * viewport measures", and the measurement itself is the browser's job, not this test's.
 *
 * `rect` is the border box `getBoundingClientRect` reports; `box` the content box the
 * observer reports. They differ only in the border-box test.
 */
function withLayout(box: Box = BOX, rect: Box = box) {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => ({
    left: 0,
    top: 0,
    right: rect.width,
    bottom: rect.height,
    ...rect,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private readonly callback: ResizeObserverCallback) {}
      observe(element: Element) {
        observers.push({ callback: this.callback, element });
        this.callback([{ target: element, contentRect: box } as unknown as ResizeObserverEntry], this);
      }
      unobserve() {}
      disconnect() {
        observers = observers.filter((o) => o.callback !== this.callback);
      }
    },
  );
}

/** Report a new content box to every live observer, as a window resize would. */
function resize(box: Box) {
  act(() => {
    for (const { callback, element } of observers) {
      callback([{ target: element, contentRect: box } as unknown as ResizeObserverEntry], {} as ResizeObserver);
    }
  });
}

afterEach(() => {
  observers = [];
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function Harness({
  onViewChange,
  layer,
  initial = null,
  onStage,
  ...props
}: {
  onViewChange?: (view: StageView) => void;
  layer?: ReactNode;
  initial?: StageView | null;
  onStage?: (stage: StageContext) => void;
} & Partial<Omit<ImageStageProps, "view" | "onView" | "children">>) {
  const [view, setView] = useState<StageView | null>(initial);
  return (
    <ImageStage
      image={IMAGE}
      {...props}
      view={view}
      onView={(next) => {
        setView(next);
        onViewChange?.(next);
      }}
      toolbar={<Probe {...(onStage ? { onStage } : {})} />}
    >
      <div data-testid="layer">{layer}</div>
    </ImageStage>
  );
}

/** Reads the context back out, which is how every real layer sees the transform. */
function Probe({ onStage }: { onStage?: (stage: StageContext) => void }) {
  const stage = useStage();
  useEffect(() => onStage?.(stage), [onStage, stage]);
  // The image's own edges: in the pixel-centre convention those are half a pixel outside
  // the first and last pixel centres (see `view.ts`).
  const corner = stage.toViewport({ x: -PIXEL_CENTRE, y: -PIXEL_CENTRE });
  const far = stage.toViewport({
    x: IMAGE.width - PIXEL_CENTRE,
    y: IMAGE.height - PIXEL_CENTRE,
  });
  return (
    <span data-testid="probe">
      {`${stage.view.scale.toFixed(9)} ${corner.x.toFixed(6)},${corner.y.toFixed(6)} ` +
        `${far.x.toFixed(6)},${far.y.toFixed(6)} ${stage.isFit} ${stage.imageLength(10).toFixed(9)}`}
    </span>
  );
}

function probe() {
  const parts = screen.getByTestId("probe").textContent.split(" ");
  return {
    scale: Number(parts[0]),
    corner: parts[1]!,
    far: parts[2]!,
    fit: parts[3] === "true",
    ten: Number(parts[4]),
  };
}

describe("ImageStage", () => {
  it("lays the stage out at the image's own pixel size, so a layer needs no scaling of its own", () => {
    withLayout();
    const { container } = render(<Harness />);
    const stage = container.querySelector("[data-stage]") as HTMLElement;
    expect(stage.style.width).toBe("1280px");
    expect(stage.style.height).toBe("1024px");
    expect(stage.style.transform).toMatch(/^translate\(-?[\d.]+px, -?[\d.]+px\) scale\([\d.]+\)$/);
  });

  it("opens at 1:1 when the image fits, and at fit when it does not", () => {
    withLayout({ width: 800, height: 600 });
    render(<Harness />);
    // 1280x1024 does not fit in 800x600.
    expect(probe().scale).toBeCloseTo(600 / 1024, 6);
    expect(probe().fit).toBe(true);
  });

  it("puts the whole image on screen at fit and reports it as fit", () => {
    withLayout();
    render(<Harness />);
    const { corner, far } = probe();
    const expected = fitView(BOX, IMAGE);
    expect(corner).toBe(`${expected.tx.toFixed(6)},${expected.ty.toFixed(6)}`);
    expect(far).toBe(
      `${(expected.tx + IMAGE.width * expected.scale).toFixed(6)},` +
        `${(expected.ty + IMAGE.height * expected.scale).toFixed(6)}`,
    );
  });

  it("reports the image length that covers a fixed screen length, for screen-constant handles", () => {
    withLayout();
    render(<Harness />);
    const { scale, ten } = probe();
    expect(ten).toBeCloseTo(10 / scale, 3);
  });

  it("pans on a drag that reaches the viewport", () => {
    withLayout();
    const { container } = render(<Harness />);
    const viewport = container.firstElementChild as HTMLElement;

    // At fit the image exactly fills one axis and under-fills the other, so `clampView`
    // legitimately absorbs the whole drag. Zoom in first, where a pan has somewhere to go.
    fireEvent.keyDown(viewport, { key: "1" });
    const before = probe();

    fireEvent.pointerDown(viewport, { button: 0, clientX: 400, clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(viewport, { clientX: 340, clientY: 260, pointerId: 1 });
    fireEvent.pointerUp(viewport, { button: 0, clientX: 340, clientY: 260, pointerId: 1 });

    const after = probe();
    expect(after.scale).toBeCloseTo(before.scale, 9);
    const [bx, by] = before.corner.split(",").map(Number);
    const [ax, ay] = after.corner.split(",").map(Number);
    expect(ax).toBeCloseTo(bx! - 60, 6);
    expect(ay).toBeCloseTo(by! - 40, 6);
  });

  it("does not pan when a layer claims the press", () => {
    withLayout();
    const { container } = render(
      <Harness
        layer={
          <button
            type="button"
            data-testid="claimer"
            onPointerDown={(event) => event.stopPropagation()}
          />
        }
      />,
    );
    const before = probe();

    const claimer = screen.getByTestId("claimer");
    fireEvent.pointerDown(claimer, { button: 0, clientX: 400, clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(container.firstElementChild!, { clientX: 460, clientY: 400, pointerId: 1 });
    fireEvent.pointerUp(container.firstElementChild!, { button: 0, clientX: 460, clientY: 400, pointerId: 1 });

    expect(probe().corner).toBe(before.corner);
  });

  it("reports a click on the background that never became a drag", () => {
    withLayout();
    const clicked = vi.fn();
    function Fixture() {
      const [view, setView] = useState<StageView | null>(null);
      return (
        <ImageStage image={IMAGE} view={view} onView={setView} onBackgroundClick={clicked}>
          <div />
        </ImageStage>
      );
    }
    const { container } = render(<Fixture />);
    const viewport = container.firstElementChild as HTMLElement;

    fireEvent.pointerDown(viewport, { button: 0, clientX: 400, clientY: 300, pointerId: 1 });
    fireEvent.pointerUp(viewport, { button: 0, clientX: 401, clientY: 300, pointerId: 1 });
    expect(clicked).toHaveBeenCalledTimes(1);

    // A press that travelled is a pan, not a click.
    fireEvent.pointerDown(viewport, { button: 0, clientX: 400, clientY: 300, pointerId: 2 });
    fireEvent.pointerMove(viewport, { clientX: 460, clientY: 340, pointerId: 2 });
    fireEvent.pointerUp(viewport, { button: 0, clientX: 460, clientY: 340, pointerId: 2 });
    expect(clicked).toHaveBeenCalledTimes(1);
  });

  it("toggles fit against the view you were just at, not against 1:1", () => {
    withLayout();
    const { container } = render(<Harness />);
    const viewport = container.firstElementChild as HTMLElement;

    // Leave fit by zooming in through the context's own control.
    fireEvent.keyDown(viewport, { key: "1" });
    const zoomed = probe();
    expect(zoomed.fit).toBe(false);
    expect(zoomed.scale).toBeCloseTo(1, 6);

    fireEvent.doubleClick(viewport, { clientX: 400, clientY: 300 });
    expect(probe().fit).toBe(true);

    fireEvent.doubleClick(viewport, { clientX: 400, clientY: 300 });
    const restored = probe();
    expect(restored.fit).toBe(false);
    expect(restored.scale).toBeCloseTo(zoomed.scale, 6);
    expect(restored.corner).toBe(zoomed.corner);
  });

  it("has keyboard fit and 100%", () => {
    withLayout();
    const { container } = render(<Harness />);
    const viewport = container.firstElementChild as HTMLElement;

    fireEvent.keyDown(viewport, { key: "1" });
    expect(probe().scale).toBeCloseTo(1, 6);
    fireEvent.keyDown(viewport, { key: "0" });
    expect(probe().fit).toBe(true);
  });
});

/**
 * A wheel event at a client position. happy-dom's `WheelEvent` drops the mouse-event
 * coordinates from its init dictionary, so they are set on the instance.
 */
function wheel(element: HTMLElement, { deltaY, clientX = 0, clientY = 0 }: { deltaY: number; clientX?: number; clientY?: number }) {
  const event = new WheelEvent("wheel", { deltaY, bubbles: true, cancelable: true });
  Object.defineProperties(event, { clientX: { value: clientX }, clientY: { value: clientY } });
  act(() => {
    element.dispatchEvent(event);
  });
  return event;
}

/** The viewport element — the stage's own root. */
function viewportOf(container: HTMLElement): HTMLElement {
  return container.firstElementChild as HTMLElement;
}

/** The context a layer sees, captured through the probe. */
function renderWithStage(props: Parameters<typeof Harness>[0] = {}) {
  const captured: { current: StageContext | null } = { current: null };
  const result = render(
    <Harness
      {...props}
      onStage={(stage) => {
        captured.current = stage;
      }}
    />,
  );
  const stage = () => {
    if (!captured.current) throw new Error("the probe has not rendered");
    return captured.current;
  };
  return { ...result, stage, viewport: viewportOf(result.container) };
}

describe("ImageStage — the first measurement", () => {
  it("keeps a controlled initial view instead of replacing it with fit", () => {
    withLayout();
    const initial = { scale: 1, tx: -100, ty: -50 };
    const onView = vi.fn();
    render(<Harness initial={initial} onViewChange={onView} />);
    expect(onView).toHaveBeenCalledTimes(1);
    expect(onView).toHaveBeenLastCalledWith(initial);
    expect(probe().scale).toBe(1);
    expect(probe().corner).toBe(`${(-100).toFixed(6)},${(-50).toFixed(6)}`);
  });

  it("clamps an initial view that is not legal for the measured viewport", () => {
    withLayout();
    const onView = vi.fn();
    render(<Harness initial={{ scale: 100, tx: 5000, ty: 0 }} onViewChange={onView} />);
    const reported = onView.mock.lastCall?.[0] as StageView;
    expect(reported.scale).toBe(MAX_SCALE);
    expect(reported).toEqual(clampView({ scale: 100, tx: 5000, ty: 0 }, BOX, IMAGE));
  });

  it("measures the content box, as the observer does, so mounting does not re-anchor the view", () => {
    // A 1px border: the border box is 802×602, the content box the observer reports 800×600.
    withLayout(BOX, { width: BOX.width + 2, height: BOX.height + 2 });
    const onView = vi.fn();
    render(<Harness onViewChange={onView} style={{ border: "1px solid" }} />);
    expect(onView).toHaveBeenCalledTimes(1);
    expect(onView).toHaveBeenLastCalledWith(initialView(BOX, IMAGE));
  });

  it("re-anchors the view on a later resize, and re-fits a fit view", () => {
    withLayout();
    const { viewport } = renderWithStage();
    expect(probe().fit).toBe(true);
    resize({ width: 1000, height: 400 });
    expect(probe().fit).toBe(true);
    expect(probe().scale).toBeCloseTo(400 / 1024, 9);

    // Zoomed in, the image point at the centre stays at the centre.
    fireEvent.keyDown(viewport, { key: "1" });
    const before = probe();
    resize({ width: 900, height: 500 });
    const after = probe();
    expect(after.scale).toBe(before.scale);
    const [bx, by] = before.corner.split(",").map(Number);
    const [ax, ay] = after.corner.split(",").map(Number);
    expect(ax! - bx!).toBeCloseTo((900 - 1000) / 2, 6);
    expect(ay! - by!).toBeCloseTo((500 - 400) / 2, 6);
  });

  it("ignores an unmeasurable (zero) size", () => {
    withLayout();
    const onView = vi.fn();
    render(<Harness onViewChange={onView} />);
    resize({ width: 0, height: 0 });
    expect(onView).toHaveBeenCalledTimes(1);
  });
});

describe("ImageStage — state as data attributes", () => {
  it("marks fit, panning and pan mode on the viewport", () => {
    withLayout();
    const { viewport } = renderWithStage();
    expect(viewport.hasAttribute("data-fit")).toBe(true);
    expect(viewport.hasAttribute("data-panning")).toBe(false);
    expect(viewport.hasAttribute("data-pan-mode")).toBe(false);

    fireEvent.keyDown(viewport, { key: "1" });
    expect(viewport.hasAttribute("data-fit")).toBe(false);

    fireEvent.pointerDown(viewport, { button: 0, clientX: 10, clientY: 10, pointerId: 1 });
    expect(viewport.hasAttribute("data-panning")).toBe(true);
    fireEvent.lostPointerCapture(viewport, { pointerId: 1 });
    expect(viewport.hasAttribute("data-panning")).toBe(false);
  });

  it("is in pan mode with the hand tool, or while space is held", () => {
    withLayout();
    const { container, rerender } = render(<Harness panTool />);
    const viewport = viewportOf(container);
    expect(viewport.hasAttribute("data-pan-mode")).toBe(true);
    expect(viewport.classList.contains("cursor-grab")).toBe(true);

    rerender(<Harness />);
    expect(viewport.hasAttribute("data-pan-mode")).toBe(false);
    fireEvent.keyDown(window, { code: "Space" });
    expect(viewport.hasAttribute("data-pan-mode")).toBe(true);
    fireEvent.keyUp(window, { code: "Space" });
    expect(viewport.hasAttribute("data-pan-mode")).toBe(false);

    fireEvent.keyDown(window, { code: "Space" });
    fireEvent.blur(window);
    expect(viewport.hasAttribute("data-pan-mode")).toBe(false);
  });

  it("does not treat space typed into a field as the pan modifier", () => {
    withLayout();
    const { container } = render(<Harness layer={<input aria-label="note" />} />);
    fireEvent.keyDown(screen.getByRole("textbox"), { code: "Space" });
    expect(viewportOf(container).hasAttribute("data-pan-mode")).toBe(false);
  });

  it("merges className and passes style to the viewport", () => {
    withLayout();
    const { container } = render(<Harness className="h-96 custom" style={{ opacity: 0.5 }} />);
    const viewport = viewportOf(container);
    for (const name of ["custom", "h-96", "overflow-hidden"]) expect(viewport.classList.contains(name)).toBe(true);
    expect(viewport.style.opacity).toBe("0.5");
  });
});

describe("ImageStage — gestures and keys", () => {
  it("zooms with the wheel about the pointer, clamped to the range", () => {
    withLayout();
    const { viewport, stage } = renderWithStage();
    const before = stage().view;
    const anchor = { x: 200, y: 150 };
    const under = toImage(before, anchor);

    // The default is prevented — the page must not scroll behind the zoom.
    expect(wheel(viewport, { deltaY: -200, clientX: anchor.x, clientY: anchor.y }).defaultPrevented).toBe(true);
    const after = stage().view;
    expect(after.scale).toBeGreaterThan(before.scale);
    const still = toImage(after, anchor);
    expect(still.x).toBeCloseTo(under.x, 6);
    expect(still.y).toBeCloseTo(under.y, 6);

    for (let i = 0; i < 40; i += 1) {
      wheel(viewport, { deltaY: -2000, clientX: 400, clientY: 300 });
    }
    expect(stage().view.scale).toBe(MAX_SCALE);
  });

  it("steps the zoom with + and -, and pans with the arrow keys", () => {
    withLayout();
    const { viewport, stage } = renderWithStage();
    fireEvent.keyDown(viewport, { key: "1" });
    expect(stage().view.scale).toBeCloseTo(1, 9);
    fireEvent.keyDown(viewport, { key: "+" });
    expect(stage().view.scale).toBeCloseTo(1.5, 9);
    fireEvent.keyDown(viewport, { key: "-" });
    expect(stage().view.scale).toBeCloseTo(1, 9);

    const start = stage().view;
    fireEvent.keyDown(viewport, { key: "ArrowLeft" });
    expect(stage().view.tx).toBeCloseTo(start.tx + 60, 9);
    fireEvent.keyDown(viewport, { key: "ArrowRight" });
    expect(stage().view.tx).toBeCloseTo(start.tx, 9);
    fireEvent.keyDown(viewport, { key: "ArrowUp" });
    expect(stage().view.ty).toBeCloseTo(start.ty + 60, 9);
    fireEvent.keyDown(viewport, { key: "ArrowDown" });
    expect(stage().view.ty).toBeCloseTo(start.ty, 9);

    // Unbound keys are left to the page.
    const other = fireEvent.keyDown(viewport, { key: "x" });
    expect(other).toBe(true);
  });

  it("leaves the arrows alone with panKeys off, and every key alone with shortcuts off", () => {
    withLayout();
    const { viewport, stage, unmount } = renderWithStage({ panKeys: false });
    fireEvent.keyDown(viewport, { key: "1" });
    const zoomed = stage().view;
    for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]) {
      expect(fireEvent.keyDown(viewport, { key })).toBe(true);
    }
    expect(stage().view).toEqual(zoomed);
    unmount();

    const off = renderWithStage({ shortcuts: false });
    const fit = off.stage().view;
    fireEvent.keyDown(off.viewport, { key: "1" });
    expect(off.stage().view).toEqual(fit);
  });

  it("ignores keys typed into a field inside the stage", () => {
    withLayout();
    const { stage } = renderWithStage({ layer: <input aria-label="note" /> });
    const fit = stage().view;
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "1" });
    expect(stage().view).toEqual(fit);
  });

  it("does not start a pan on the secondary button", () => {
    withLayout();
    const { viewport } = renderWithStage();
    fireEvent.pointerDown(viewport, { button: 2, clientX: 10, clientY: 10, pointerId: 1 });
    expect(viewport.hasAttribute("data-panning")).toBe(false);
  });

  it("reports hover in image pixels, and null outside the image, while panning and on leave", () => {
    withLayout();
    const onHover = vi.fn();
    const { viewport, stage } = renderWithStage({ onHover });
    const view = stage().view;

    fireEvent.pointerMove(viewport, { clientX: 400, clientY: 300 });
    const inside = onHover.mock.lastCall?.[0] as { x: number; y: number };
    const expected = toImage(view, { x: 400, y: 300 });
    expect(inside.x).toBeCloseTo(expected.x, 9);
    expect(inside.y).toBeCloseTo(expected.y, 9);

    // At fit the 5:4 image leaves bars at the sides of a 4:3 viewport.
    fireEvent.pointerMove(viewport, { clientX: 2, clientY: 300 });
    expect(onHover).toHaveBeenLastCalledWith(null);

    fireEvent.pointerMove(viewport, { clientX: 400, clientY: 300 });
    fireEvent.pointerLeave(viewport);
    expect(onHover).toHaveBeenLastCalledWith(null);

    fireEvent.keyDown(viewport, { key: "1" });
    fireEvent.pointerDown(viewport, { button: 0, clientX: 400, clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(viewport, { clientX: 450, clientY: 300, pointerId: 1 });
    expect(onHover).toHaveBeenLastCalledWith(null);
    fireEvent.pointerCancel(viewport, { pointerId: 1 });
    expect(viewport.hasAttribute("data-panning")).toBe(false);
  });

  it("goes to 100% under the pointer on a double-click at fit with no view to return to", () => {
    withLayout();
    const { viewport, stage } = renderWithStage();
    fireEvent.doubleClick(viewport, { clientX: 400, clientY: 300 });
    expect(stage().view.scale).toBeCloseTo(1, 9);
    expect(stage().isFit).toBe(false);
  });
});

describe("ImageStage — will-change while the view moves", () => {
  it("sets will-change: transform and data-moving on a view change, and clears them once it settles", () => {
    vi.useFakeTimers();
    try {
      withLayout();
      const { container, viewport } = renderWithStage();
      const box = container.querySelector("[data-stage]") as HTMLElement;
      expect(box.style.willChange).toBe("transform");
      expect(box.hasAttribute("data-moving")).toBe(true);
      act(() => {
        vi.advanceTimersByTime(149);
      });
      expect(box.style.willChange).toBe("transform");
      act(() => {
        vi.advanceTimersByTime(2);
      });
      expect(box.style.willChange).toBe("");
      expect(box.hasAttribute("data-moving")).toBe(false);

      fireEvent.keyDown(viewport, { key: "1" });
      expect(box.style.willChange).toBe("transform");
      // Another change before it settles restarts the wait.
      act(() => {
        vi.advanceTimersByTime(100);
      });
      fireEvent.keyDown(viewport, { key: "0" });
      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(box.style.willChange).toBe("transform");
      act(() => {
        vi.advanceTimersByTime(60);
      });
      expect(box.style.willChange).toBe("");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("ImageStage — the fit option", () => {
  const FIT = { padding: 24, upscale: false } as const;

  it("opens at the padded fit with initialView=\"fit\", and reports it as fit", () => {
    withLayout();
    const onViewChange = vi.fn();
    render(<Harness initialView="fit" fit={FIT} onViewChange={onViewChange} />);
    expect(onViewChange).toHaveBeenLastCalledWith(fitView(BOX, IMAGE, FIT));
    expect(probe().fit).toBe(true);
    expect(probe().scale).toBeCloseTo((BOX.height - 48) / IMAGE.height, 9);
  });

  it("caps a small image at 1:1 and centres it", () => {
    withLayout();
    const small = { width: 200, height: 100 };
    const onViewChange = vi.fn();
    render(<Harness image={small} initialView="fit" fit={FIT} onViewChange={onViewChange} />);
    expect(onViewChange).toHaveBeenLastCalledWith({ scale: 1, tx: 300, ty: 250 });
  });

  it("applies it to the handle's fit(), the 0 key, the toolbar-facing context and the double-click toggle", () => {
    withLayout();
    const { viewport, stage } = renderWithStage({ fit: FIT });
    const fitted = fitView(BOX, IMAGE, FIT);
    fireEvent.keyDown(viewport, { key: "1" });
    expect(stage().isFit).toBe(false);
    fireEvent.keyDown(viewport, { key: "0" });
    expect(stage().view).toEqual(fitted);
    expect(stage().isFit).toBe(true);
    expect(viewport.hasAttribute("data-fit")).toBe(true);

    fireEvent.keyDown(viewport, { key: "1" });
    act(() => stage().fit());
    expect(stage().view).toEqual(fitted);

    // Double-click leaves fit for the view it came from, then returns to the padded fit.
    fireEvent.keyDown(viewport, { key: "1" });
    fireEvent.doubleClick(viewport, { clientX: 400, clientY: 300 });
    expect(stage().view).toEqual(fitted);
    fireEvent.doubleClick(viewport, { clientX: 400, clientY: 300 });
    expect(stage().view.scale).toBe(1);
  });

  it("re-fits with the margin when the viewport resizes while fit", () => {
    withLayout();
    const { stage } = renderWithStage({ fit: FIT, initialView: "fit" });
    resize({ width: 500, height: 700 });
    expect(stage().view).toEqual(fitView({ width: 500, height: 700 }, IMAGE, FIT));
    expect(stage().isFit).toBe(true);
  });

  it("does not re-fit on a new but equal options object", () => {
    withLayout();
    const onViewChange = vi.fn();
    const { rerender } = render(<Harness fit={{ padding: 24 }} initialView="fit" onViewChange={onViewChange} />);
    const calls = onViewChange.mock.calls.length;
    rerender(<Harness fit={{ padding: 24 }} initialView="fit" onViewChange={onViewChange} />);
    expect(onViewChange.mock.calls.length).toBe(calls);
  });
});

describe("ImageStage — the layer context", () => {
  it("converts between client and image coordinates, both ways", () => {
    withLayout();
    const { stage, viewport } = renderWithStage();
    fireEvent.keyDown(viewport, { key: "1" });
    const p = { x: 321.25, y: 87.5 };
    const client = stage().toClient(p);
    const back = stage().toImage(client);
    expect(back.x).toBeCloseTo(p.x, 9);
    expect(back.y).toBeCloseTo(p.y, 9);
    expect(stage().toViewport(p)).toEqual(client);
  });

  it("frames a rect, fits, zooms about an anchor, and clamps what a layer sets", () => {
    withLayout();
    const { stage } = renderWithStage();

    act(() => stage().frame({ x: 600, y: 400, width: 80, height: 60 }));
    const framed = stage().view;
    expect(framed.scale).toBeGreaterThan(1);
    const centre = stage().toImage({ x: BOX.width / 2, y: BOX.height / 2 });
    expect(centre.x).toBeCloseTo(640, 6);
    expect(centre.y).toBeCloseTo(430, 6);

    act(() => stage().fit());
    expect(stage().isFit).toBe(true);
    expect(stage().view).toEqual(fitView(BOX, IMAGE));

    const anchor = { x: 100, y: 100 };
    const under = stage().toImage(anchor);
    act(() => stage().zoomTo(2, anchor));
    expect(stage().view.scale).toBe(2);
    const still = stage().toImage(anchor);
    expect(still.x).toBeCloseTo(under.x, 6);
    expect(still.y).toBeCloseTo(under.y, 6);

    act(() => stage().setView({ scale: 1000, tx: 0, ty: 0 }));
    expect(stage().view.scale).toBe(MAX_SCALE);
  });

  it("double-click returns to the view that fit() left", () => {
    withLayout();
    const { stage, viewport } = renderWithStage();
    act(() => stage().zoomTo(3));
    const zoomed = stage().view;
    act(() => stage().fit());
    fireEvent.doubleClick(viewport, { clientX: 10, clientY: 10 });
    expect(stage().view).toEqual(zoomed);
  });

  it("throws outside a stage", () => {
    function Orphan() {
      useStage();
      return null;
    }
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Orphan />)).toThrow("useStage must be used inside <ImageStage>.");
  });
});

describe("ImageStage — before the viewport is measured", () => {
  it("renders at an identity view, and its controls are no-ops", () => {
    // No layout stubs: happy-dom measures 0×0 and no observer ever reports.
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    const onView = vi.fn();
    const { stage, viewport } = renderWithStage({ onViewChange: onView });
    expect(stage().view).toEqual({ scale: 1, tx: 0, ty: 0 });
    expect(stage().box).toEqual({ width: 0, height: 0 });
    expect(stage().isFit).toBe(false);

    act(() => {
      stage().fit();
      stage().zoomTo(2);
      stage().frame({ x: 0, y: 0, width: 10, height: 10 });
    });
    fireEvent.doubleClick(viewport);
    wheel(viewport, { deltaY: -100 });
    expect(onView).not.toHaveBeenCalled();
    expect(stage().toImage({ x: 5, y: 5 })).toEqual({ x: 0, y: 0 });
    expect(stage().toClient({ x: 5, y: 5 })).toEqual({ x: 0, y: 0 });

    // A layer may still set a view; unclamped, since there is no range yet.
    act(() => stage().setView({ scale: 2, tx: 3, ty: 4 }));
    expect(onView).toHaveBeenLastCalledWith({ scale: 2, tx: 3, ty: 4 });
  });
});

describe("ImageStage — pan buttons and double-click", () => {
  /** Zoom to 1:1 first: at fit the clamp absorbs a drag, and a pan has nowhere to go. */
  function zoomed(props: Parameters<typeof Harness>[0] = {}) {
    const rendered = renderWithStage(props);
    fireEvent.keyDown(rendered.viewport, { key: "1" });
    return rendered;
  }
  const drag = (viewport: HTMLElement, button: number, id = 1) => {
    fireEvent.pointerDown(viewport, { button, clientX: 400, clientY: 300, pointerId: id });
    fireEvent.pointerMove(viewport, { clientX: 340, clientY: 260, pointerId: id });
    fireEvent.pointerUp(viewport, { button, clientX: 340, clientY: 260, pointerId: id });
  };

  it("pans with the right button only, when asked, and suppresses the context menu", () => {
    withLayout();
    const { viewport, stage } = zoomed({ panButton: "right" });
    const before = stage().view;

    drag(viewport, 0);
    expect(stage().view).toEqual(before);
    drag(viewport, 1, 2);
    expect(stage().view).toEqual(before);

    drag(viewport, 2, 3);
    expect(stage().view.tx).toBeCloseTo(before.tx - 60, 6);
    expect(stage().view.ty).toBeCloseTo(before.ty - 40, 6);
    expect(fireEvent.contextMenu(viewport)).toBe(false);
  });

  it("leaves the context menu alone when the right button does not pan", () => {
    withLayout();
    const { viewport } = zoomed();
    expect(fireEvent.contextMenu(viewport)).toBe(true);
  });

  it("takes a list of buttons", () => {
    withLayout();
    const { viewport, stage } = zoomed({ panButton: ["middle", "right"] });
    const before = stage().view;
    drag(viewport, 0);
    expect(stage().view).toEqual(before);
    drag(viewport, 1, 2);
    expect(stage().view.tx).toBeCloseTo(before.tx - 60, 6);
  });

  it("still reports a left click on the background when the left button does not pan", () => {
    withLayout();
    const onBackgroundClick = vi.fn();
    const { viewport, stage } = zoomed({ panButton: "right", onBackgroundClick });
    const before = stage().view;
    fireEvent.pointerDown(viewport, { button: 0, clientX: 400, clientY: 300, pointerId: 1 });
    expect(viewport.hasAttribute("data-panning")).toBe(false);
    fireEvent.pointerUp(viewport, { button: 0, clientX: 400, clientY: 300, pointerId: 1 });
    expect(onBackgroundClick).toHaveBeenCalledTimes(1);

    // A left drag is not a click, and not a pan either.
    fireEvent.pointerDown(viewport, { button: 0, clientX: 400, clientY: 300, pointerId: 2 });
    fireEvent.pointerMove(viewport, { clientX: 460, clientY: 340, pointerId: 2 });
    fireEvent.pointerUp(viewport, { button: 0, clientX: 460, clientY: 340, pointerId: 2 });
    expect(onBackgroundClick).toHaveBeenCalledTimes(1);
    expect(stage().view).toEqual(before);
  });

  it("lets the hand tool pan with the left button whatever panButton says", () => {
    withLayout();
    const { viewport, stage } = zoomed({ panButton: "right", panTool: true });
    const before = stage().view;
    drag(viewport, 0);
    expect(stage().view.tx).toBeCloseTo(before.tx - 60, 6);
  });

  it("keeps the fit toggle unless doubleClickFit is off", () => {
    withLayout();
    const on = zoomed();
    fireEvent.doubleClick(on.viewport, { clientX: 400, clientY: 300 });
    expect(on.stage().isFit).toBe(true);
    on.unmount();

    const off = zoomed({ doubleClickFit: false });
    const before = off.stage().view;
    fireEvent.doubleClick(off.viewport, { clientX: 400, clientY: 300 });
    expect(off.stage().view).toEqual(before);
  });
});

/** Registers one pickable point at image `(x, y)` and reports what the stage routes to it. */
function PointLayer({
  x,
  y,
  priority = 300,
  onHover,
  onPress,
}: {
  x: number;
  y: number;
  priority?: number;
  onHover?: (id: HitId | null) => void;
  onPress?: (id: HitId, event: StagePointerEvent) => boolean | void;
}) {
  useStageHitLayer({
    layerId: "pt",
    priority,
    pick: (p, radius) => {
      const dist = Math.hypot(p.x - x, p.y - y);
      return dist <= radius ? { id: "p", dist } : null;
    },
    onHover,
    onPress,
  });
  return null;
}

describe("ImageStage — routing hover and presses to registered layers", () => {
  /** A zoomed-in stage with a point at the image position under client (400, 300). */
  function withPoint(layerProps: Partial<Parameters<typeof PointLayer>[0]>, stageProps: Parameters<typeof Harness>[0] = {}) {
    const rendered = renderWithStage({ ...stageProps, layer: <Probe2 layerProps={layerProps} /> });
    fireEvent.keyDown(rendered.viewport, { key: "1" });
    return rendered;
  }
  function Probe2({ layerProps }: { layerProps: Partial<Parameters<typeof PointLayer>[0]> }) {
    const { toImage: toImg } = useStage();
    const p = toImg({ x: 400, y: 300 });
    return <PointLayer x={p.x} y={p.y} {...layerProps} />;
  }

  it("tells a layer which item is hovered, and when the pointer leaves it", () => {
    withLayout();
    const onHover = vi.fn();
    const { viewport } = withPoint({ onHover });
    fireEvent.pointerMove(viewport, { clientX: 403, clientY: 300 });
    expect(onHover).toHaveBeenLastCalledWith("p");
    fireEvent.pointerMove(viewport, { clientX: 500, clientY: 300 });
    expect(onHover).toHaveBeenLastCalledWith(null);
    fireEvent.pointerMove(viewport, { clientX: 400, clientY: 300 });
    fireEvent.pointerLeave(viewport);
    expect(onHover).toHaveBeenLastCalledWith(null);
  });

  it("clears hover when a pan begins, and does not route hover from a touch", () => {
    withLayout();
    const onHover = vi.fn();
    const { viewport } = withPoint({ onHover }, { panButton: ["middle"] });
    fireEvent.pointerMove(viewport, { clientX: 400, clientY: 300 });
    expect(onHover).toHaveBeenLastCalledWith("p");
    fireEvent.pointerDown(viewport, { button: 1, clientX: 600, clientY: 500, pointerId: 1 });
    fireEvent.pointerMove(viewport, { clientX: 640, clientY: 500, pointerId: 1 });
    expect(onHover).toHaveBeenLastCalledWith(null);
    fireEvent.pointerUp(viewport, { button: 1, clientX: 640, clientY: 500, pointerId: 1 });

    onHover.mockClear();
    fireEvent.pointerMove(viewport, { clientX: 400, clientY: 300, pointerType: "touch", pointerId: 9 });
    expect(onHover).not.toHaveBeenCalled();
  });

  it("gives a press on an item to its layer instead of panning", () => {
    withLayout();
    const onPress = vi.fn();
    const { viewport, stage } = withPoint({ onPress });
    const before = stage().view;
    fireEvent.pointerDown(viewport, { button: 0, clientX: 402, clientY: 301, pointerId: 1 });
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onPress.mock.calls[0]![0]).toBe("p");
    expect(viewport.hasAttribute("data-panning")).toBe(false);
    fireEvent.pointerMove(viewport, { clientX: 500, clientY: 400, pointerId: 1 });
    expect(stage().view).toEqual(before);
  });

  it("pans from a press the layer declines, or that misses every item", () => {
    withLayout();
    const onPress = vi.fn(() => false);
    const { viewport } = withPoint({ onPress });
    fireEvent.pointerDown(viewport, { button: 0, clientX: 400, clientY: 300, pointerId: 1 });
    expect(onPress).toHaveBeenCalled();
    expect(viewport.hasAttribute("data-panning")).toBe(true);
    fireEvent.pointerUp(viewport, { button: 0, clientX: 400, clientY: 300, pointerId: 1 });

    onPress.mockClear();
    fireEvent.pointerDown(viewport, { button: 0, clientX: 700, clientY: 500, pointerId: 2 });
    expect(onPress).not.toHaveBeenCalled();
    expect(viewport.hasAttribute("data-panning")).toBe(true);
  });

  it("does not offer a press to layers when the hand tool is on or for a non-primary button", () => {
    withLayout();
    const onPress = vi.fn();
    const hand = withPoint({ onPress }, { panTool: true });
    fireEvent.pointerDown(hand.viewport, { button: 0, clientX: 400, clientY: 300, pointerId: 1 });
    expect(onPress).not.toHaveBeenCalled();
    hand.unmount();

    const middle = withPoint({ onPress });
    fireEvent.pointerDown(middle.viewport, { button: 1, clientX: 400, clientY: 300, pointerId: 1 });
    expect(onPress).not.toHaveBeenCalled();
    expect(middle.viewport.hasAttribute("data-panning")).toBe(true);
  });
});

describe("ImageStage — touch", () => {
  const touch = (pointerId: number, clientX: number, clientY: number) => ({
    pointerType: "touch",
    pointerId,
    clientX,
    clientY,
    button: 0,
  });

  function zoomed(props: Parameters<typeof Harness>[0] = {}) {
    const rendered = renderWithStage(props);
    fireEvent.keyDown(rendered.viewport, { key: "1" });
    return rendered;
  }

  it("pans with one finger by default, and stops when it lifts", () => {
    withLayout();
    const { viewport, stage } = zoomed();
    const before = stage().view;
    fireEvent.pointerDown(viewport, touch(1, 400, 300));
    fireEvent.pointerMove(viewport, touch(1, 340, 260));
    expect(viewport.hasAttribute("data-panning")).toBe(true);
    fireEvent.pointerUp(viewport, touch(1, 340, 260));
    expect(viewport.hasAttribute("data-panning")).toBe(false);
    expect(stage().view.tx).toBeCloseTo(before.tx - 60, 6);
    expect(stage().view.ty).toBeCloseTo(before.ty - 40, 6);
    // The lost capture that follows a release is not a second release.
    fireEvent.lostPointerCapture(viewport, touch(1, 340, 260));
    expect(viewport.hasAttribute("data-panning")).toBe(false);
  });

  it("leaves one finger to the app when touchPan is two-finger", () => {
    withLayout();
    const { viewport, stage } = zoomed({ touchPan: "two-finger" });
    const before = stage().view;
    fireEvent.pointerDown(viewport, touch(1, 400, 300));
    fireEvent.pointerMove(viewport, touch(1, 340, 260));
    fireEvent.pointerUp(viewport, touch(1, 340, 260));
    expect(stage().view).toEqual(before);
  });

  it("pinch-zooms about the fingers' midpoint and pans with it", () => {
    withLayout();
    const { viewport, stage } = zoomed({ clamp: { maxScale: 16 } });
    // Zoom out a step so there is room to zoom in, away from the clamp.
    fireEvent.keyDown(viewport, { key: "-" });
    const before = stage().view;
    const held = stage().toImage({ x: 400, y: 300 });

    fireEvent.pointerDown(viewport, touch(1, 300, 300));
    fireEvent.pointerDown(viewport, touch(2, 500, 300));
    expect(viewport.hasAttribute("data-panning")).toBe(true);
    // Spread to twice the distance with the midpoint unchanged, then drag the midpoint.
    fireEvent.pointerMove(viewport, touch(2, 700, 300));
    expect(stage().view.scale).toBeCloseTo(before.scale * 2, 6);
    const after = stage().toImage({ x: 500, y: 300 });
    // The midpoint moved from (400, 300) to (500, 300): the point held is under it now.
    expect(after.x).toBeCloseTo(held.x, 5);
    expect(after.y).toBeCloseTo(held.y, 5);

    fireEvent.pointerUp(viewport, touch(2, 700, 300));
    fireEvent.pointerUp(viewport, touch(1, 300, 300));
    expect(viewport.hasAttribute("data-panning")).toBe(false);
  });

  it("carries on as a one-finger pan when one of two fingers lifts, never as a tap", () => {
    withLayout();
    const onBackgroundClick = vi.fn();
    const { viewport, stage } = zoomed({ onBackgroundClick });
    fireEvent.pointerDown(viewport, touch(1, 300, 300));
    fireEvent.pointerDown(viewport, touch(2, 500, 300));
    fireEvent.pointerUp(viewport, touch(1, 300, 300));
    expect(viewport.hasAttribute("data-panning")).toBe(true);
    const before = stage().view;
    fireEvent.pointerMove(viewport, touch(2, 560, 300));
    expect(stage().view.tx).toBeCloseTo(before.tx + 60, 6);
    fireEvent.pointerUp(viewport, touch(2, 560, 300));
    expect(onBackgroundClick).not.toHaveBeenCalled();
  });

  it("ignores a third finger and pointermoves from fingers it does not know", () => {
    withLayout();
    const { viewport, stage } = zoomed();
    fireEvent.pointerMove(viewport, touch(5, 10, 10));
    fireEvent.pointerDown(viewport, touch(1, 300, 300));
    fireEvent.pointerDown(viewport, touch(2, 500, 300));
    fireEvent.pointerDown(viewport, touch(3, 400, 100));
    const before = stage().view;
    fireEvent.pointerMove(viewport, touch(3, 400, 50));
    expect(stage().view).toEqual(before);
    fireEvent.pointerUp(viewport, touch(3, 400, 50));
    fireEvent.pointerCancel(viewport, touch(2, 500, 300));
    fireEvent.pointerCancel(viewport, touch(1, 300, 300));
    expect(viewport.hasAttribute("data-panning")).toBe(false);
  });

  it("reports a tap as a background click, and a drag or a long press as neither", () => {
    withLayout();
    const onBackgroundClick = vi.fn();
    const { viewport } = zoomed({ onBackgroundClick });
    fireEvent.pointerDown(viewport, touch(1, 400, 300));
    fireEvent.pointerUp(viewport, touch(1, 401, 300));
    expect(onBackgroundClick).toHaveBeenCalledTimes(1);

    fireEvent.pointerDown(viewport, touch(2, 400, 300));
    fireEvent.pointerMove(viewport, touch(2, 460, 300));
    fireEvent.pointerUp(viewport, touch(2, 460, 300));
    expect(onBackgroundClick).toHaveBeenCalledTimes(1);

    // A long press: the same touch, a second later.
    const at = (type: string, timeStamp: number) => {
      const event = new PointerEvent(type, { ...touch(3, 400, 300), bubbles: true });
      Object.defineProperty(event, "timeStamp", { value: timeStamp });
      fireEvent(viewport, event);
    };
    at("pointerdown", 1000);
    at("pointerup", 2000);
    expect(onBackgroundClick).toHaveBeenCalledTimes(1);
  });

  it("gives a tap on an item to its layer, with a fingertip's tolerance, instead of the background", () => {
    withLayout();
    const onPress = vi.fn();
    const onBackgroundClick = vi.fn();
    const { viewport } = renderWithStage({
      onBackgroundClick,
      layer: <TouchPoint onPress={onPress} />,
    });
    fireEvent.keyDown(viewport, { key: "1" });
    // 10 px away: outside a mouse's 6 px, inside a fingertip's 12.
    fireEvent.pointerDown(viewport, touch(1, 410, 300));
    expect(onPress).not.toHaveBeenCalled();
    fireEvent.pointerUp(viewport, touch(1, 410, 300));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onBackgroundClick).not.toHaveBeenCalled();
  });
});

function TouchPoint({ onPress }: { onPress: () => void }) {
  const { toImage: toImg } = useStage();
  const p = toImg({ x: 400, y: 300 });
  return <PointLayer x={p.x} y={p.y} onPress={onPress} />;
}

describe("ImageStage — why the view changed", () => {
  /** A stage that records every report, and lets a test set the view from outside. */
  function Reporting({
    reports,
    onHandle,
    hold = false,
    onSetView,
    ...props
  }: {
    reports: { view: StageView; change: StageViewChange }[];
    onHandle?: (handle: StageHandle | null) => void;
    /** Keep the view where the test put it, ignoring what the stage reports. */
    hold?: boolean;
    onSetView?: (set: (view: StageView | null) => void) => void;
  } & Partial<Omit<ImageStageProps, "view" | "onView" | "children">>) {
    const [view, setView] = useState<StageView | null>(null);
    useEffect(() => onSetView?.(setView), [onSetView]);
    return (
      <ImageStage
        image={IMAGE}
        {...props}
        view={view}
        ref={(h) => onHandle?.(h)}
        onView={(next, change) => {
          reports.push({ view: next, change });
          if (!hold) setView(next);
        }}
      >
        <div />
      </ImageStage>
    );
  }

  const last = (reports: { change: StageViewChange }[]) => reports[reports.length - 1]!.change;

  it("tags the opening view and a resize as measure, with the box they were made for", () => {
    withLayout();
    const reports: { view: StageView; change: StageViewChange }[] = [];
    render(<Reporting reports={reports} />);
    expect(reports).toHaveLength(1);
    expect(reports[0]!.change).toEqual({ cause: "measure", box: BOX });

    resize({ width: 1000, height: 400 });
    expect(last(reports)).toEqual({ cause: "measure", box: { width: 1000, height: 400 } });
  });

  it("tags wheel, drag and double-click as gesture, and the shortcuts as key", () => {
    withLayout();
    const reports: { view: StageView; change: StageViewChange }[] = [];
    const { container } = render(<Reporting reports={reports} />);
    const viewport = viewportOf(container);

    wheel(viewport, { deltaY: -200, clientX: 200, clientY: 150 });
    expect(last(reports).cause).toBe("gesture");

    fireEvent.keyDown(viewport, { key: "1" });
    expect(last(reports).cause).toBe("key");
    fireEvent.keyDown(viewport, { key: "+" });
    expect(last(reports).cause).toBe("key");
    fireEvent.keyDown(viewport, { key: "0" });
    expect(last(reports).cause).toBe("key");
    fireEvent.keyDown(viewport, { key: "1" });
    fireEvent.keyDown(viewport, { key: "ArrowLeft" });
    expect(last(reports).cause).toBe("key");

    const before = reports.length;
    fireEvent.pointerDown(viewport, { button: 0, clientX: 400, clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(viewport, { clientX: 340, clientY: 260, pointerId: 1 });
    fireEvent.pointerUp(viewport, { button: 0, clientX: 340, clientY: 260, pointerId: 1 });
    expect(reports.length).toBeGreaterThan(before);
    expect(last(reports).cause).toBe("gesture");

    fireEvent.doubleClick(viewport, { clientX: 400, clientY: 300 });
    expect(last(reports).cause).toBe("gesture");
    expect(last(reports).box).toEqual(BOX);
  });

  it("tags the handle's fit, zoomTo and frame, and a layer's setView, as command", () => {
    withLayout();
    const reports: { view: StageView; change: StageViewChange }[] = [];
    let handle: StageHandle | null = null;
    render(<Reporting reports={reports} onHandle={(h) => (handle = h)} />);

    act(() => handle!.zoomTo(2));
    expect(last(reports).cause).toBe("command");
    act(() => handle!.frame({ x: 600, y: 400, width: 80, height: 60 }));
    expect(last(reports).cause).toBe("command");
    act(() => handle!.fit());
    expect(last(reports).cause).toBe("command");
  });

  it("re-opens and reports a view the consumer set back to null after the stage measured", () => {
    withLayout();
    const reports: { view: StageView; change: StageViewChange }[] = [];
    let set: ((view: StageView | null) => void) | null = null;
    render(<Reporting reports={reports} onSetView={(fn) => (set = fn)} />);
    const opening = reports[0]!.view;

    act(() => set!({ scale: 3, tx: -10, ty: -10 }));
    const count = reports.length;
    act(() => set!(null));

    expect(reports.length).toBe(count + 1);
    expect(last(reports)).toEqual({ cause: "measure", box: BOX });
    expect(reports[reports.length - 1]!.view).toEqual(opening);
  });

  it("keeps working while the consumer holds the view at null: the wheel and the keys still report", () => {
    withLayout();
    const reports: { view: StageView; change: StageViewChange }[] = [];
    const { container } = render(<Reporting reports={reports} hold />);
    const viewport = viewportOf(container);
    // Held at null: the opening view was reported once and not adopted.
    expect(reports).toHaveLength(1);

    wheel(viewport, { deltaY: -200, clientX: 200, clientY: 150 });
    expect(reports).toHaveLength(2);
    expect(last(reports).cause).toBe("gesture");
    expect(reports[1]!.view.scale).toBeGreaterThan(reports[0]!.view.scale);

    fireEvent.keyDown(viewport, { key: "1" });
    expect(last(reports).cause).toBe("key");
    expect(reports[reports.length - 1]!.view.scale).toBe(1);
  });
});

describe("ImageStage — the background click's image point", () => {
  it("passes where the click landed, in image coordinates, for a mouse and a tap", () => {
    withLayout();
    const onBackgroundClick = vi.fn();
    const { viewport, stage } = renderWithStage({ onBackgroundClick, initial: { scale: 2, tx: 100, ty: 50 } });

    fireEvent.pointerDown(viewport, { button: 0, clientX: 300, clientY: 250, pointerId: 1 });
    fireEvent.pointerUp(viewport, { button: 0, clientX: 300, clientY: 250, pointerId: 1 });
    expect(onBackgroundClick).toHaveBeenCalledTimes(1);
    const expected = stage().toImage({ x: 300, y: 250 });
    expect(expected).toEqual(toImage(stage().view, { x: 300, y: 250 }));
    expect(onBackgroundClick.mock.calls[0]![1]).toEqual(expected);

    const tap = (id: number, x: number, y: number) => ({
      pointerId: id,
      pointerType: "touch",
      isPrimary: true,
      clientX: x,
      clientY: y,
      button: 0,
    });
    fireEvent.pointerDown(viewport, tap(2, 500, 350));
    fireEvent.pointerUp(viewport, tap(2, 500, 350));
    expect(onBackgroundClick).toHaveBeenCalledTimes(2);
    expect(onBackgroundClick.mock.calls[1]![1]).toEqual(stage().toImage({ x: 500, y: 350 }));
  });
});
