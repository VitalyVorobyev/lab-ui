import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  FULL_TIER_ZOOM,
  MAX_ZOOM,
  MIN_ZOOM,
  RESET_VIEW,
  ZoomPanCanvas,
  contentUnder,
  nativeZoomFor,
  zoomAt,
  type View,
} from "./ZoomPanCanvas";

/** A 400x300 box at the origin, so the centre is (200, 150). */
const RECT = { left: 0, top: 0, width: 400, height: 300 };

/**
 * Where a content point ends up on screen, under `translate(t) scale(z)` about the centre.
 * Coordinates are measured from the box's centre, which is what `transform-origin: center`
 * makes them.
 */
function project(view: { zoom: number; x: number; y: number }, content: { x: number; y: number }) {
  return { x: content.x * view.zoom + view.x, y: content.y * view.zoom + view.y };
}

/** The content point currently under a client-space pointer. */
function contentAt(view: { zoom: number; x: number; y: number }, pointer: { x: number; y: number }) {
  const px = pointer.x - RECT.left - RECT.width / 2;
  const py = pointer.y - RECT.top - RECT.height / 2;
  return { x: (px - view.x) / view.zoom, y: (py - view.y) / view.zoom };
}

describe("zoomAt", () => {
  it("keeps whatever is under the cursor under the cursor", () => {
    /**
     * The property a naive centre-anchored zoom lacks. Without it, magnifying a defect in
     * a corner means every wheel notch has to be undone with a drag — the gesture fights
     * the thing it is for.
     */
    const start = { zoom: 2, x: 30, y: -12 };
    const pointer = { x: 320, y: 70 };
    const before = contentAt(start, pointer);

    const after = zoomAt(start, pointer, RECT, 1.6);
    const moved = project(after, before);

    expect(moved.x).toBeCloseTo(pointer.x - RECT.width / 2, 6);
    expect(moved.y).toBeCloseTo(pointer.y - RECT.height / 2, 6);
  });

  it("holds the anchor across a zoom in and back out", () => {
    const start = { zoom: 1.5, x: -20, y: 8 };
    const pointer = { x: 120, y: 240 };
    const before = contentAt(start, pointer);

    const zoomed = zoomAt(zoomAt(start, pointer, RECT, 3), pointer, RECT, 1 / 3);
    const moved = project(zoomed, before);

    expect(zoomed.zoom).toBeCloseTo(start.zoom, 6);
    expect(moved.x).toBeCloseTo(pointer.x - RECT.width / 2, 6);
    expect(moved.y).toBeCloseTo(pointer.y - RECT.height / 2, 6);
  });

  it("resets rather than leaving an offset that cannot be seen", () => {
    // At 1x the content fills the frame, so a pan offset there is a way to be lost with no
    // visible handle to get back.
    expect(zoomAt({ zoom: 1.2, x: 200, y: 90 }, { x: 10, y: 10 }, RECT, 0.1)).toEqual(RESET_VIEW);
  });

  it("clamps at both ends", () => {
    expect(zoomAt({ zoom: 8, x: 0, y: 0 }, { x: 200, y: 150 }, RECT, 100).zoom).toBe(MAX_ZOOM);
    expect(zoomAt({ zoom: 1, x: 0, y: 0 }, { x: 200, y: 150 }, RECT, 0.001)).toEqual(RESET_VIEW);
  });
});

describe("nativeZoomFor", () => {
  it("is the ratio of source pixels to frame pixels", () => {
    expect(nativeZoomFor(1600, 400)).toBe(4);
    expect(nativeZoomFor(800, 400)).toBe(2);
  });

  it("reports 1 for an image smaller than its frame", () => {
    // There are no further pixels to reveal; magnifying past this shows the resampler
    // rather than the sensor.
    expect(nativeZoomFor(200, 400)).toBe(MIN_ZOOM);
  });

  it("clamps a huge source to the zoom ceiling", () => {
    expect(nativeZoomFor(40_000, 400)).toBe(MAX_ZOOM);
  });

  it("falls back to the tier boundary when the width is unknown", () => {
    // `nativeWidth` is optional; a missing or zero width must not produce Infinity or NaN.
    expect(Number.isFinite(nativeZoomFor(0, 400))).toBe(true);
    expect(Number.isFinite(nativeZoomFor(400, 0))).toBe(true);
  });
});

describe("contentUnder", () => {
  it("inverts the transform zoomAt maintains", () => {
    const view = { zoom: 2.5, x: -40, y: 25 };
    const content = { x: -30, y: 12 };
    const screenPoint = project(view, content);
    const under = contentUnder(
      view,
      { clientX: screenPoint.x + RECT.width / 2, clientY: screenPoint.y + RECT.height / 2 },
      RECT,
    );
    expect(under?.u).toBeCloseTo(content.x / RECT.width + 0.5, 9);
    expect(under?.v).toBeCloseTo(content.y / RECT.height + 0.5, 9);
  });

  it("is null outside the content", () => {
    expect(contentUnder(RESET_VIEW, { clientX: -1, clientY: 150 }, RECT)).toBeNull();
    expect(contentUnder(RESET_VIEW, { clientX: 200, clientY: 300 }, RECT)).toBeNull();
  });
});

describe("ZoomPanCanvas", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** The frame measures as `RECT`; happy-dom lays nothing out. */
  function withLayout() {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => ({
      ...RECT,
      right: RECT.left + RECT.width,
      bottom: RECT.top + RECT.height,
      x: RECT.left,
      y: RECT.top,
      toJSON: () => ({}),
    }));
  }

  function Harness({
    initial = RESET_VIEW,
    onView,
    onHover,
    fitLabel,
    nativeWidth,
  }: {
    initial?: View;
    onView?: (view: View) => void;
    onHover?: (position: { u: number; v: number } | null) => void;
    fitLabel?: string | null;
    nativeWidth?: number;
  }) {
    const [view, setView] = useState(initial);
    return (
      <ZoomPanCanvas
        view={view}
        onView={(next) => {
          setView(next);
          onView?.(next);
        }}
        className="h-80 custom"
        label="1600×1200"
        {...(onHover ? { onHover } : {})}
        {...(fitLabel !== undefined ? { fitLabel } : {})}
        {...(nativeWidth !== undefined ? { nativeWidth } : {})}
      >
        <div data-testid="content" />
      </ZoomPanCanvas>
    );
  }

  function frameOf(container: HTMLElement): HTMLElement {
    return container.firstElementChild as HTMLElement;
  }

  /** happy-dom's `WheelEvent` drops the mouse coordinates from its init, so set them here. */
  function wheel(element: HTMLElement, deltaY: number, clientX: number, clientY: number) {
    const event = new WheelEvent("wheel", { deltaY, bubbles: true, cancelable: true });
    Object.defineProperties(event, { clientX: { value: clientX }, clientY: { value: clientY } });
    act(() => {
      element.dispatchEvent(event);
    });
    return event;
  }

  it("merges className and exposes fit and panning as data attributes", () => {
    withLayout();
    const { container } = render(<Harness />);
    const frame = frameOf(container);
    for (const name of ["custom", "h-80", "overflow-hidden", "bg-canvas"]) {
      expect(frame.classList.contains(name)).toBe(true);
    }
    expect(frame.hasAttribute("data-fit")).toBe(true);
    expect(frame.hasAttribute("data-panning")).toBe(false);
    expect(screen.getByText("1600×1200")).toBeTruthy();
  });

  it("zooms with the wheel about the pointer and keeps the page from scrolling", () => {
    withLayout();
    const onView = vi.fn();
    const { container } = render(<Harness onView={onView} />);
    const event = wheel(frameOf(container), -400, 300, 100);
    expect(event.defaultPrevented).toBe(true);
    expect(onView).toHaveBeenLastCalledWith(zoomAt(RESET_VIEW, { x: 300, y: 100 }, RECT, 1 + 400 * 0.0015));
    expect(frameOf(container).hasAttribute("data-fit")).toBe(false);

    // The listener, attached once, reads the latest view: a second notch compounds.
    const first = onView.mock.lastCall?.[0] as View;
    wheel(frameOf(container), -400, 300, 100);
    expect(onView).toHaveBeenLastCalledWith(zoomAt(first, { x: 300, y: 100 }, RECT, 1 + 400 * 0.0015));
  });

  it("pans on a drag, reporting no hover while the pointer holds the image", () => {
    withLayout();
    const onView = vi.fn();
    const onHover = vi.fn();
    const { container } = render(<Harness initial={{ zoom: 2, x: 0, y: 0 }} onView={onView} onHover={onHover} />);
    const frame = frameOf(container);

    fireEvent.pointerDown(frame, { clientX: 100, clientY: 100, pointerId: 1 });
    expect(frame.hasAttribute("data-panning")).toBe(true);
    expect(frame.classList.contains("cursor-grabbing")).toBe(true);
    fireEvent.pointerMove(frame, { clientX: 130, clientY: 80, pointerId: 1 });
    expect(onView).toHaveBeenLastCalledWith({ zoom: 2, x: 30, y: -20 });
    expect(onHover).toHaveBeenLastCalledWith(null);
    fireEvent.pointerUp(frame, { pointerId: 1 });
    expect(frame.hasAttribute("data-panning")).toBe(false);

    // Interrupted drags end too.
    fireEvent.pointerDown(frame, { clientX: 100, clientY: 100, pointerId: 2 });
    fireEvent.pointerCancel(frame, { pointerId: 2 });
    expect(frame.hasAttribute("data-panning")).toBe(false);
    fireEvent.pointerDown(frame, { clientX: 100, clientY: 100, pointerId: 3 });
    fireEvent.lostPointerCapture(frame, { pointerId: 3 });
    expect(frame.hasAttribute("data-panning")).toBe(false);
  });

  it("reports hover as content fractions, and null on leave", () => {
    withLayout();
    const onHover = vi.fn();
    const { container } = render(<Harness onHover={onHover} />);
    const frame = frameOf(container);
    fireEvent.pointerMove(frame, { clientX: 100, clientY: 75 });
    expect(onHover).toHaveBeenLastCalledWith({ u: 0.25, v: 0.25 });
    fireEvent.pointerLeave(frame);
    expect(onHover).toHaveBeenLastCalledWith(null);
  });

  it("toggles fit against native 1:1 on double-click", () => {
    withLayout();
    const onView = vi.fn();
    const { container } = render(<Harness onView={onView} nativeWidth={1600} />);
    const frame = frameOf(container);
    fireEvent.doubleClick(frame, { clientX: 200, clientY: 150 });
    expect((onView.mock.lastCall?.[0] as View).zoom).toBe(nativeZoomFor(1600, RECT.width));
    fireEvent.doubleClick(frame, { clientX: 200, clientY: 150 });
    expect(onView).toHaveBeenLastCalledWith(RESET_VIEW);

    // Without a native width, the gesture falls back to the tier boundary.
    const { container: other } = render(<Harness onView={onView} />);
    fireEvent.doubleClick(frameOf(other), { clientX: 200, clientY: 150 });
    expect((onView.mock.lastCall?.[0] as View).zoom).toBe(FULL_TIER_ZOOM);
  });

  it("shows a Fit button when zoomed, which resets without starting a pan or a double-click zoom", () => {
    withLayout();
    const onView = vi.fn();
    const { container } = render(<Harness initial={{ zoom: 3, x: 10, y: 10 }} onView={onView} />);
    const button = screen.getByRole("button", { name: "Fit" });
    fireEvent.pointerDown(button, { pointerId: 1 });
    expect(frameOf(container).hasAttribute("data-panning")).toBe(false);
    fireEvent.doubleClick(button);
    expect(onView).not.toHaveBeenCalled();
    fireEvent.click(button);
    expect(onView).toHaveBeenLastCalledWith(RESET_VIEW);
    expect(screen.queryByRole("button", { name: "Fit" })).toBeNull();
  });

  it("hides the Fit button when fitLabel is null", () => {
    withLayout();
    render(<Harness initial={{ zoom: 3, x: 0, y: 0 }} fitLabel={null} />);
    expect(screen.queryByRole("button", { name: "Fit" })).toBeNull();
  });
});
