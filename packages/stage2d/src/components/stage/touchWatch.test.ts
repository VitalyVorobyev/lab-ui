import { afterEach, describe, expect, it, vi } from "vitest";

import { TAP_MS, TAP_SLOP } from "./gesture";
import { watchTouch } from "./touchWatch";

const ORIGIN = { pointerId: 3, clientX: 100, clientY: 100, timeStamp: 1000 };

/** A pointer event on `window`; happy-dom's `PointerEvent` takes `pointerType` and the ids. */
function fire(type: string, init: { pointerId: number; clientX?: number; clientY?: number; timeStamp?: number; pointerType?: string }) {
  const event = new PointerEvent(type, { pointerType: "touch", clientX: 100, clientY: 100, ...init });
  if (init.timeStamp !== undefined) Object.defineProperty(event, "timeStamp", { value: init.timeStamp });
  window.dispatchEvent(event);
}

function setup() {
  const watch = { onMove: vi.fn(), onEnd: vi.fn(), onCancel: vi.fn() };
  const cancel = watchTouch(ORIGIN, watch);
  return { watch, cancel };
}

afterEach(() => {
  // Leave no listener behind for the next test.
  fire("pointerup", { pointerId: 3 });
});

describe("watchTouch", () => {
  it("reports a tap: no moves, released quickly within the slop", () => {
    const { watch } = setup();
    fire("pointermove", { pointerId: 3, clientX: 100 + TAP_SLOP, timeStamp: 1100 });
    fire("pointerup", { pointerId: 3, clientX: 101, timeStamp: 1100 });
    expect(watch.onMove).not.toHaveBeenCalled();
    expect(watch.onEnd).toHaveBeenCalledTimes(1);
    expect(watch.onEnd.mock.calls[0]!.slice(1)).toEqual([false, true]);
  });

  it("reports moves only once the finger has left the slop, and then every move", () => {
    const { watch } = setup();
    fire("pointermove", { pointerId: 3, clientX: 102 });
    expect(watch.onMove).not.toHaveBeenCalled();
    fire("pointermove", { pointerId: 3, clientX: 110 });
    // Back inside the slop: still a drag, the slop is spent.
    fire("pointermove", { pointerId: 3, clientX: 101 });
    expect(watch.onMove).toHaveBeenCalledTimes(2);
    fire("pointerup", { pointerId: 3, clientX: 101, timeStamp: 1100 });
    expect(watch.onEnd.mock.calls[0]!.slice(1)).toEqual([true, false]);
  });

  it("is not a tap when held too long, though it never moved", () => {
    const { watch } = setup();
    fire("pointerup", { pointerId: 3, timeStamp: 1000 + TAP_MS + 1 });
    expect(watch.onEnd.mock.calls[0]!.slice(1)).toEqual([false, false]);
  });

  it("counts a release that landed far away as a move, even with no move event", () => {
    const { watch } = setup();
    fire("pointerup", { pointerId: 3, clientX: 140, timeStamp: 1100 });
    expect(watch.onEnd.mock.calls[0]!.slice(1)).toEqual([true, false]);
  });

  it("ignores other pointers' moves and releases", () => {
    const { watch } = setup();
    fire("pointermove", { pointerId: 9, clientX: 200 });
    fire("pointerup", { pointerId: 9 });
    fire("pointercancel", { pointerId: 9 });
    expect(watch.onMove).not.toHaveBeenCalled();
    expect(watch.onEnd).not.toHaveBeenCalled();
    expect(watch.onCancel).not.toHaveBeenCalled();
  });

  it("cancels on pointercancel, and stops listening", () => {
    const { watch } = setup();
    fire("pointercancel", { pointerId: 3 });
    expect(watch.onCancel).toHaveBeenCalledTimes(1);
    fire("pointerup", { pointerId: 3 });
    expect(watch.onEnd).not.toHaveBeenCalled();
  });

  it("cancels when a second touch lands, but not for a mouse press", () => {
    const { watch } = setup();
    fire("pointerdown", { pointerId: 1, pointerType: "mouse" });
    expect(watch.onCancel).not.toHaveBeenCalled();
    fire("pointerdown", { pointerId: 4 });
    expect(watch.onCancel).toHaveBeenCalledTimes(1);
    fire("pointerup", { pointerId: 3 });
    expect(watch.onEnd).not.toHaveBeenCalled();
  });

  it("does not take the press it began from for a second touch", () => {
    const { watch } = setup();
    fire("pointerdown", { pointerId: 3 });
    expect(watch.onCancel).not.toHaveBeenCalled();
  });

  it("can be cancelled by the caller, once, and not after it has ended", () => {
    const { watch, cancel } = setup();
    cancel();
    cancel();
    expect(watch.onCancel).toHaveBeenCalledTimes(1);
    const second = setup();
    fire("pointerup", { pointerId: 3 });
    second.cancel();
    expect(second.watch.onCancel).not.toHaveBeenCalled();
  });
});
