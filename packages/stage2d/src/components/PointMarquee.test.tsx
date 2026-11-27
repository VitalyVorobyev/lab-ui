/** The marquee's modifier gate, its band, its release and Escape, without a browser. */

import { act, fireEvent, render } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import type { Point } from "./measureGeometry";
import { PointMarquee, type PointMarqueeHandle, type PointMarqueeProps } from "./PointMarquee";
import type { PointId } from "./pointIndex";
import { ImageStage } from "./stage/ImageStage";
import type { StagePress } from "./stage/StageSurface";
import type { StageView } from "./stage/view";

const ITEMS = [
  { id: "a", x: 50, y: 50 },
  { id: "b", x: 100, y: 60 },
  { id: "c", x: 300, y: 200 },
];

/** At 1:1 with the viewport at the origin (happy-dom lays nothing out), client = image + 0.5. */
const at = (p: Point, extra: Record<string, unknown> = {}) => ({
  clientX: p.x + 0.5,
  clientY: p.y + 0.5,
  pointerId: 1,
  button: 0,
  ...extra,
});

function setup(props: Partial<PointMarqueeProps> = {}, view: StageView = { scale: 1, tx: 0, ty: 0 }) {
  const onSelect = vi.fn<(ids: PointId[], mode: "replace" | "add") => void>();
  const onCancel = vi.fn();
  const onBandChange = vi.fn();
  const ref = createRef<PointMarqueeHandle>();
  const onView = vi.fn();
  const result = render(
    <ImageStage image={{ width: 400, height: 300 }} view={view} onView={onView}>
      <PointMarquee ref={ref} items={ITEMS} onSelect={onSelect} onCancel={onCancel} onBandChange={onBandChange} {...props} />
    </ImageStage>,
  );
  const surface = () => result.container.querySelector("[data-marquee-surface]");
  const band = () => result.container.querySelector("svg[data-marquee] rect");
  return { ...result, onSelect, onCancel, onBandChange, onView, ref, surface, band };
}

/** Move to `p` and release there, as a pointer does: the move is what makes it a drag. */
const dragTo = (p: Point, extra: Record<string, unknown> = { shiftKey: true }) => {
  fireEvent.pointerMove(window, at(p, extra));
  fireEvent.pointerUp(window, at(p, extra));
};

const hold = (key = "Shift", extra: Record<string, unknown> = { shiftKey: true }) =>
  act(() => void fireEvent.keyDown(window, { key, ...extra }));
const release = () => act(() => void fireEvent.keyUp(window, { key: "Shift" }));

describe("PointMarquee", () => {
  it("has no press target until the modifier is held, and drops it on release and on blur", () => {
    const { surface } = setup();
    expect(surface()).toBeNull();
    hold();
    expect(surface()).not.toBeNull();
    release();
    expect(surface()).toBeNull();
    hold();
    act(() => void fireEvent.blur(window));
    expect(surface()).toBeNull();
  });

  it("follows the modifier it is given, and ignores the others", () => {
    const { surface } = setup({ modifier: "alt" });
    hold();
    expect(surface()).toBeNull();
    hold("Alt", { altKey: true });
    expect(surface()).not.toBeNull();
  });

  it("draws the band while dragging and reports the ids inside on release, in item order", () => {
    const { surface, band, onSelect, onBandChange } = setup();
    hold();
    fireEvent.pointerDown(surface()!, at({ x: 40, y: 40 }, { shiftKey: true }));
    fireEvent.pointerMove(window, at({ x: 120, y: 80 }, { shiftKey: true }));
    expect(band()!.getAttribute("width")).toBe("80");
    expect(onBandChange).toHaveBeenLastCalledWith({ x: 40, y: 40, width: 80, height: 40 });
    dragTo({ x: 120, y: 80 });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenLastCalledWith(["a", "b"], "replace");
    expect(band()).toBeNull();
    expect(onBandChange).toHaveBeenLastCalledWith(null);
  });

  it("sweeps in any direction, and an empty rectangle reports an empty list", () => {
    const { surface, onSelect } = setup();
    hold();
    fireEvent.pointerDown(surface()!, at({ x: 390, y: 290 }, { shiftKey: true }));
    dragTo({ x: 250, y: 150 });
    expect(onSelect).toHaveBeenLastCalledWith(["c"], "replace");
    fireEvent.pointerDown(surface()!, at({ x: 200, y: 100 }, { shiftKey: true }));
    dragTo({ x: 220, y: 120 });
    expect(onSelect).toHaveBeenLastCalledWith([], "replace");
  });

  it("adds with ⌘/Ctrl held as well", () => {
    const { surface, onSelect } = setup();
    hold();
    fireEvent.pointerDown(surface()!, at({ x: 40, y: 40 }, { shiftKey: true, ctrlKey: true }));
    dragTo({ x: 120, y: 80 });
    expect(onSelect).toHaveBeenLastCalledWith(["a", "b"], "add");
  });

  it("reports nothing for a click that did not move", () => {
    const { surface, onSelect, band } = setup();
    hold();
    fireEvent.pointerDown(surface()!, at({ x: 50, y: 50 }, { shiftKey: true }));
    dragTo({ x: 50, y: 50 });
    expect(onSelect).not.toHaveBeenCalled();
    expect(band()).toBeNull();
  });

  it("is abandoned by Escape: the band goes, onCancel is called, and the release selects nothing", () => {
    const { surface, band, onSelect, onCancel } = setup();
    hold();
    fireEvent.pointerDown(surface()!, at({ x: 40, y: 40 }, { shiftKey: true }));
    fireEvent.pointerMove(window, at({ x: 120, y: 80 }));
    expect(band()).not.toBeNull();
    act(() => void fireEvent.keyDown(window, { key: "Escape" }));
    expect(band()).toBeNull();
    expect(onCancel).toHaveBeenCalledTimes(1);
    fireEvent.pointerMove(window, at({ x: 200, y: 200 }));
    expect(band()).toBeNull();
    dragTo({ x: 200, y: 200 });
    expect(onSelect).not.toHaveBeenCalled();
    // A later marquee works.
    fireEvent.pointerDown(surface()!, at({ x: 40, y: 40 }, { shiftKey: true }));
    dragTo({ x: 120, y: 80 });
    expect(onSelect).toHaveBeenLastCalledWith(["a", "b"], "replace");
  });

  it("ignores Escape when no marquee is in flight", () => {
    const { onCancel } = setup();
    act(() => void fireEvent.keyDown(window, { key: "Escape" }));
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("does not claim a press without the modifier: the stage pans", () => {
    const { container, onSelect, onView } = setup();
    const viewport = container.querySelector("[role=application]")!;
    fireEvent.pointerDown(viewport, at({ x: 100, y: 100 }));
    fireEvent.pointerMove(viewport, at({ x: 140, y: 120 }));
    fireEvent.pointerUp(viewport, at({ x: 140, y: 120 }));
    expect(onSelect).not.toHaveBeenCalled();
    expect(container.querySelector("[data-marquee-surface]")).toBeNull();
    expect(onView).toHaveBeenCalled();
  });

  it("has no target of its own with surface off or disabled", () => {
    const off = setup({ surface: false });
    hold();
    expect(off.surface()).toBeNull();
    off.unmount();
    const disabled = setup({ enabled: false });
    hold();
    expect(disabled.surface()).toBeNull();
  });

  it("starts from an app's own StageSurface through the ref, only with the modifier and never for a touch", () => {
    const { ref, onSelect } = setup({ surface: false });
    const press = (extra: Partial<StagePress> = {}): StagePress => ({
      point: { x: 40, y: 40 },
      client: { x: 40.5, y: 40.5 },
      touch: false,
      radius: 6,
      shiftKey: true,
      altKey: false,
      metaKey: false,
      ...extra,
    });
    expect(ref.current!.sweepDrag(press({ shiftKey: false }))).toBeUndefined();
    expect(ref.current!.sweepDrag(press({ touch: true }))).toBeUndefined();
    let drag = ref.current!.sweepDrag(press())!;
    act(() => drag.onEnd?.({ x: 120, y: 80 }, new PointerEvent("pointerup"), true));
    expect(onSelect).toHaveBeenLastCalledWith(["a", "b"], "replace");
    drag = ref.current!.sweepDrag(press({ metaKey: true }))!;
    act(() => drag.onEnd?.({ x: 120, y: 80 }, new PointerEvent("pointerup"), true));
    expect(onSelect).toHaveBeenLastCalledWith(["a", "b"], "add");
    drag = ref.current!.sweepDrag(press())!;
    act(() => drag.onCancel?.());
    act(() => drag.onEnd?.({ x: 120, y: 80 }, new PointerEvent("pointerup"), true));
    expect(onSelect).toHaveBeenCalledTimes(2);
  });
});
