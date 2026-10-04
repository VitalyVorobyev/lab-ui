import { renderHook } from "@testing-library/react";
import { FrameTreeRuntime } from "@vitavision/three";
import { describe, expect, it, vi } from "vitest";

import { invalidateScene, onSceneInvalidate, useSceneInvalidate } from "./sceneSignal";

const I = { rotation: [0, 0, 0, 1], translation: [0, 0, 0] };
const baked = () => ({ dt: 1, frames: ["world"], samples: [{ t: 0, world_se3_frame: [I] }] });

describe("invalidateScene", () => {
  it("reaches the listeners of that runtime only, until they unsubscribe", () => {
    const a = new FrameTreeRuntime(baked());
    const b = new FrameTreeRuntime(baked());
    const first = vi.fn();
    const second = vi.fn();
    const other = vi.fn();
    const stopFirst = onSceneInvalidate(a, first);
    onSceneInvalidate(a, second);
    onSceneInvalidate(b, other);
    invalidateScene(a);
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
    expect(other).not.toHaveBeenCalled();
    stopFirst();
    invalidateScene(a);
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledTimes(2);
  });

  it("is a no-op for a runtime nobody listens to", () => {
    expect(() => invalidateScene(new FrameTreeRuntime(baked()))).not.toThrow();
  });

  it("lets a listener unsubscribe while it is being called", () => {
    const runtime = new FrameTreeRuntime(baked());
    const once = vi.fn();
    const later = vi.fn();
    const stop = onSceneInvalidate(runtime, () => {
      once();
      stop();
    });
    onSceneInvalidate(runtime, later);
    invalidateScene(runtime);
    invalidateScene(runtime);
    expect(once).toHaveBeenCalledOnce();
    expect(later).toHaveBeenCalledTimes(2);
  });
});

describe("useSceneInvalidate", () => {
  // Inside a FrameTree (which needs a canvas) it is exercised by SensorImage.browser.test.tsx.
  it("must be used inside a FrameTree", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => renderHook(() => useSceneInvalidate())).toThrow(/inside <FrameTree>/);
    error.mockRestore();
  });
});
