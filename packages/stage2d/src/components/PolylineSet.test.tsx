/**
 * The point dots, the marquee's own target, and bands started from elsewhere through the
 * `ref`: what the stories show, pinned down without a browser.
 */

import { act, fireEvent, render } from "@testing-library/react";
import { createRef, type RefObject } from "react";
import { describe, expect, it, vi } from "vitest";

import type { Point } from "./measureGeometry";
import { PolylineSet, type PolylineSelectMode, type PolylineSetHandle, type PolylineSetProps } from "./PolylineSet";
import type { PolylineId } from "./polylineIndex";
import { ImageStage } from "./stage/ImageStage";
import type { StagePress } from "./stage/StageSurface";
import type { StageView } from "./stage/view";

const ITEMS = [
  { id: 1, points: [60, 60, 160, 60, 160, 140, 60, 140], closed: true },
  { id: 2, points: [220, 80, 340, 80, 340, 200, 220, 200], closed: true },
];

/** At 1:1 with the viewport at the origin (happy-dom lays nothing out), client = image + 0.5. */
const at = (p: Point, extra: Record<string, unknown> = {}) => ({ clientX: p.x + 0.5, clientY: p.y + 0.5, pointerId: 1, button: 0, ...extra });

function setup(props: Partial<PolylineSetProps> = {}, view: StageView = { scale: 1, tx: 0, ty: 0 }, panTool = false) {
  const onSelect = vi.fn<(ids: PolylineId[], mode: PolylineSelectMode) => void>();
  const ref = createRef<PolylineSetHandle>();
  const result = render(
    <ImageStage image={{ width: 400, height: 300 }} view={view} onView={() => {}} panTool={panTool}>
      <PolylineSet ref={ref} items={ITEMS} onSelect={onSelect} {...props} />
    </ImageStage>,
  );
  const sweeping = () => result.container.querySelector("svg[data-sweeping]") !== null;
  return { ...result, onSelect, ref, sweeping };
}

/** An element of the app's own that starts a band through the ref on `pointerdown`. */
function ownTarget(ref: RefObject<PolylineSetHandle | null>, mode?: "replace" | "add") {
  const { getByTestId } = render(<div data-testid="own" onPointerDown={(e) => ref.current?.startSweep(e, mode)} onPointerUp={(e) => ref.current?.startSweep(e, mode)} />);
  return getByTestId("own");
}

describe("PolylineSet — point dots", () => {
  it("draws a selected line's points as near-white dots on a halo, sized in screen pixels", () => {
    const { container } = setup({ selected: [1] }, { scale: 4, tx: 0, ty: 0 });
    const dots = container.querySelector("[data-points]")!;
    expect(dots.getAttribute("stroke")).toBe("var(--stage-label)");
    expect(dots.getAttribute("stroke-width")).toBe("1");
    const halo = dots.previousElementSibling!;
    expect(halo.getAttribute("stroke")).toBe("var(--stage-halo)");
    expect(halo.getAttribute("stroke-width")).toBe("1.5");
    // Four points, each a zero-length round-capped segment.
    expect(dots.getAttribute("d")?.match(/h0/g)).toHaveLength(4);
  });

  it("takes a colour and a size, and draws nothing below vertexScale", () => {
    const custom = setup({ selected: [2], vertexColor: "#ff00ff", vertexSize: 8 }, { scale: 4, tx: 0, ty: 0 });
    const dots = custom.container.querySelector("[data-points]")!;
    expect(dots.getAttribute("stroke")).toBe("#ff00ff");
    expect(dots.getAttribute("stroke-width")).toBe("2");
    expect(dots.previousElementSibling?.getAttribute("stroke-width")).toBe("2.5");
    custom.unmount();
    const zoomedOut = setup({ selected: [2] }, { scale: 2, tx: 0, ty: 0 });
    expect(zoomedOut.container.querySelector("[data-points]")).toBeNull();
  });
});

describe("PolylineSet — the marquee's target", () => {
  it("covers the frame with marquee on, and not with marqueeSurface off, where a line still sweeps", () => {
    const own = setup({ marquee: true });
    expect(own.container.querySelector("[data-marquee-surface]")).not.toBeNull();
    own.unmount();

    const { container, onSelect, sweeping } = setup({ marquee: true, marqueeSurface: false });
    expect(container.querySelector("[data-marquee-surface]")).toBeNull();
    fireEvent.pointerDown(container.querySelector("[data-hit]")!, at({ x: 100, y: 60 }));
    expect(sweeping()).toBe(true);
    fireEvent.pointerMove(window, at({ x: 390, y: 210 }));
    fireEvent.pointerUp(window, at({ x: 390, y: 210 }));
    expect(onSelect).toHaveBeenLastCalledWith([1, 2], "replace");
  });
});

describe("PolylineSet — sweeps started elsewhere", () => {
  it("starts a band from the app's own pointerdown, replacing or, with ⌘/Ctrl, adding", () => {
    const { ref, onSelect, sweeping } = setup();
    const own = ownTarget(ref);
    fireEvent.pointerDown(own, at({ x: 200, y: 50 }));
    expect(sweeping()).toBe(true);
    fireEvent.pointerMove(window, at({ x: 390, y: 100 }));
    fireEvent.pointerUp(window, at({ x: 390, y: 100 }));
    expect(onSelect).toHaveBeenLastCalledWith([2], "replace");
    expect(sweeping()).toBe(false);
    fireEvent.pointerDown(own, at({ x: 50, y: 50 }, { ctrlKey: true }));
    fireEvent.pointerUp(window, at({ x: 70, y: 70 }));
    expect(onSelect).toHaveBeenLastCalledWith([1], "add");
  });

  it("takes the mode from the caller, works on a layer that takes no presses, and ignores a release", () => {
    const { ref, onSelect, container } = setup({ interactive: false });
    expect(container.querySelector("[data-hit]")).toBeNull();
    const own = ownTarget(ref, "add");
    fireEvent.pointerDown(own, at({ x: 50, y: 50 }));
    fireEvent.pointerUp(window, at({ x: 70, y: 70 }));
    expect(onSelect).toHaveBeenLastCalledWith([1], "add");
    onSelect.mockClear();
    // A touch tap reaches an app's handler as the release: there is no press to sweep from.
    fireEvent.pointerUp(own, at({ x: 50, y: 50 }));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("does nothing while the stage is in pan mode", () => {
    const { ref, onSelect, sweeping } = setup({}, { scale: 1, tx: 0, ty: 0 }, true);
    fireEvent.pointerDown(ownTarget(ref), at({ x: 50, y: 50 }));
    expect(sweeping()).toBe(false);
    fireEvent.pointerUp(window, at({ x: 70, y: 70 }));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("gives a StageSurface a drag that claims a touch and takes its mode from the press", () => {
    const { ref, onSelect, sweeping } = setup();
    const press = (metaKey: boolean): StagePress => ({
      point: { x: 200, y: 50 },
      client: { x: 200.5, y: 50.5 },
      touch: false,
      radius: 6,
      shiftKey: true,
      altKey: false,
      metaKey,
    });
    const event = new PointerEvent("pointerup");
    let drag = ref.current!.sweepDrag(press(false));
    expect(drag.claimsTouch).toBe(true);
    act(() => drag.onMove?.({ x: 390, y: 100 }, event));
    expect(sweeping()).toBe(true);
    act(() => drag.onEnd?.({ x: 390, y: 100 }, event, true));
    expect(onSelect).toHaveBeenLastCalledWith([2], "replace");

    drag = ref.current!.sweepDrag(press(true));
    act(() => drag.onEnd?.({ x: 390, y: 100 }, event, true));
    expect(onSelect).toHaveBeenLastCalledWith([2], "add");
    drag = ref.current!.sweepDrag(press(true), "replace");
    act(() => drag.onEnd?.({ x: 390, y: 100 }, event, true));
    expect(onSelect).toHaveBeenLastCalledWith([2], "replace");

    // A cancelled band selects nothing and goes away.
    onSelect.mockClear();
    act(() => {
      drag = ref.current!.sweepDrag(press(false));
    });
    expect(sweeping()).toBe(true);
    act(() => drag.onCancel?.());
    expect(sweeping()).toBe(false);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
