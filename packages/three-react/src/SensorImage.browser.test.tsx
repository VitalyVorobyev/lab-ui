import { cleanup, render } from "@testing-library/react";
import { FrameTreeRuntime, type MeshLoader, type RemapTable, SensorView } from "@vitavision/three";
import { useEffect, useMemo, useState } from "react";
import { BoxGeometry, Mesh, MeshBasicMaterial, type Object3D } from "three";
import { type MockInstance, afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FrameTree, type PlayheadSource } from "./FrameTree";
import { Robot } from "./Robot";
import { SceneCanvas } from "./SceneCanvas";
import { SensorImage } from "./SensorImage";
import { invalidateScene, useSceneInvalidate } from "./sceneSignal";

// Tailwind is not compiled here; the scene canvas only renders once its box has a size.
const style = document.createElement("style");
style.textContent = ".viewport { width: 240px; height: 160px; }";
document.head.append(style);
afterAll(() => style.remove());

const I = { rotation: [0, 0, 0, 1], translation: [0, 0, 0] };
const baked = {
  dt: 1,
  frames: ["world", "cam", "arm/base"],
  samples: [0, 1].map((t) => ({ t, world_se3_frame: [I, { ...I, translation: [0, 0, -1 - t] }, I] })),
};
const CANONICAL = { width: 32, height: 24, focalPx: 20 };
const LUT: RemapTable = {
  width: 32,
  height: 24,
  data: Float32Array.from({ length: 2 * 32 * 24 }, (_, k) => (k % 2 === 0 ? (k / 2) % 32 : Math.floor(k / 2 / 32))),
  pixelCentre: "integer",
};

/** The callback of the one IntersectionObserver a mounted image creates. */
let report: ((isIntersecting: boolean) => void) | undefined;

class FakeIntersectionObserver {
  constructor(callback: (entries: Pick<IntersectionObserverEntry, "isIntersecting">[]) => void) {
    report = (isIntersecting) => callback([{ isIntersecting }]);
  }
  observe(): void {}
  disconnect(): void {
    report = undefined;
  }
}

const settle = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Animation frames slow down while other test files render beside this one. */
const WAIT = { timeout: 5000 };

let draws: MockInstance<SensorView["render"]>;

/** Wait until the image has been drawn `n` times in all. */
const drawn = (n: number) => vi.waitFor(() => expect(draws).toHaveBeenCalledTimes(n), WAIT);

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  draws = vi.spyOn(SensorView.prototype, "render");
});

afterEach(() => {
  // The browser project has no shared setup: unmount here, or earlier images keep drawing.
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.documentElement.classList.remove("dark");
});

function mount() {
  const runtime = new FrameTreeRuntime(baked);
  const playhead = { sample: 0, get() { return this.sample; } };
  const view = render(<SensorImage runtime={runtime} frame="cam" canonical={CANONICAL} lut={LUT} playhead={playhead} />);
  return { runtime, playhead, view };
}

describe("SensorImage", () => {
  it("draws once, then only when the playhead, the theme or the scene changes", async () => {
    const { runtime, playhead } = mount();
    await drawn(1);
    // No periodic refresh: a static image is drawn once.
    await settle(400);
    expect(draws).toHaveBeenCalledOnce();

    invalidateScene(runtime);
    await drawn(2);

    playhead.sample = 1;
    await drawn(3);
    expect(runtime.current).toBe(1);

    document.documentElement.classList.add("dark");
    await drawn(4);
    await settle(200);
    expect(draws).toHaveBeenCalledTimes(4);
  });

  it("does no work while its tab is hidden or it is out of view, and catches up on return", async () => {
    const { runtime } = mount();
    await drawn(1);

    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    invalidateScene(runtime);
    await settle(200);
    expect(draws).toHaveBeenCalledOnce();
    visibility.mockReturnValue("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    await drawn(2);

    report!(false);
    invalidateScene(runtime);
    await settle(200);
    expect(draws).toHaveBeenCalledTimes(2);
    // Back in view: drawn once, even with nothing invalidated meanwhile.
    report!(true);
    await drawn(3);
    report!(true);
    await settle(200);
    expect(draws).toHaveBeenCalledTimes(3);
  });

  it("counts as always in view without IntersectionObserver, and stops listening when unmounted", async () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const { runtime, view } = mount();
    await drawn(1);
    invalidateScene(runtime);
    await drawn(2);
    view.unmount();
    invalidateScene(runtime);
    await settle(200);
    expect(draws).toHaveBeenCalledTimes(2);
  });

  it("redraws when a Robot's meshes attach to the scene", async () => {
    let attach: ((mesh: Object3D) => void) | undefined;
    const loader: MeshLoader = { load: () => new Promise((resolve) => (attach = resolve)) };
    let invalidate: (() => void) | undefined;
    function Probe() {
      const fn = useSceneInvalidate();
      useEffect(() => {
        invalidate = fn;
      }, [fn]);
      return null;
    }
    function Cell() {
      const [runtime, setRuntime] = useState<FrameTreeRuntime | null>(null);
      const playhead = useMemo<PlayheadSource>(() => ({ get: () => 0 }), []);
      return (
        <>
          <SceneCanvas className="viewport" grid={0}>
            <FrameTree baked={baked} playhead={playhead} onRuntime={setRuntime}>
              <Robot id="arm" visuals={[{ link: "base", mesh: "base.glb" }]} resolve={(p) => p} loader={loader} />
              <Probe />
            </FrameTree>
          </SceneCanvas>
          {runtime && <SensorImage runtime={runtime} frame="cam" canonical={CANONICAL} lut={LUT} playhead={playhead} />}
        </>
      );
    }
    render(<Cell />);
    await drawn(1);
    await vi.waitFor(() => expect(attach).toBeDefined(), WAIT);
    attach!(new Mesh(new BoxGeometry(), new MeshBasicMaterial()));
    // Attaching the mesh redraws, and so does colouring it: one draw or two, as frames fall.
    await vi.waitFor(() => expect(draws.mock.calls.length).toBeGreaterThan(1), WAIT);
    await settle(200);

    // `useSceneInvalidate` reaches the same image through the enclosing FrameTree.
    await vi.waitFor(() => expect(invalidate).toBeDefined(), WAIT);
    const calls = draws.mock.calls.length;
    invalidate!();
    await vi.waitFor(() => expect(draws.mock.calls.length).toBeGreaterThan(calls), WAIT);
  });
});
