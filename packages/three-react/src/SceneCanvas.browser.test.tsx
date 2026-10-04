import { type RootState, useFrame, useThree } from "@react-three/fiber";
import { cleanup, render } from "@testing-library/react";
import { StrictMode, useEffect } from "react";
import { Vector3 } from "three";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

import { AtFrame, FrameTree } from "./FrameTree";
import { CameraFrustum } from "./gizmos";
import { SceneCanvas } from "./SceneCanvas";

// Tailwind is not compiled here; the canvas only renders once its box has a size.
const style = document.createElement("style");
style.textContent = ".viewport { width: 240px; height: 160px; }";
document.head.append(style);
afterAll(() => style.remove());
// The browser project has no shared setup: unmount each test's canvas here.
afterEach(cleanup);

const I = { rotation: [0, 0, 0, 1], translation: [0, 0, 0] };
const baked = { dt: 1, frames: ["world", "cam"], samples: [{ t: 0, world_se3_frame: [I, { ...I, translation: [0, 0, 1] }] }] };

/** A square 90° field of view: the four corners and edge midpoints on the z = 1 plane. */
const RAYS = new Float64Array([-1, -1, 1, 0, -1, 1, 1, -1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, -1, 1, 1, -1, 0, 1]);

function Probe({ onState }: { onState: (state: RootState) => void }) {
  const state = useThree();
  useEffect(() => {
    onState(state);
  });
  return null;
}

/** Counts rendered frames: a click before the first one would raycast with unposed matrices. */
function Frames({ onFrame }: { onFrame: () => void }) {
  useFrame(onFrame);
  return null;
}

describe("SceneCanvas", () => {
  it("picks gizmos placed in a frame on GIZMO_LAYER", async () => {
    const onSelect = vi.fn();
    let frames = 0;
    const { container } = render(
      // Looking down −Z at the frustum of a camera at z = 1 whose optical axis is +Z.
      <SceneCanvas className="viewport" eye={[0, 0, 3]} target={[0, 0, 0]} up={[0, 1, 0]} grid={0}>
        <FrameTree baked={baked}>
          <AtFrame name="cam">
            <CameraFrustum borderRays={RAYS} depth={0.5} onSelect={onSelect} />
          </AtFrame>
        </FrameTree>
        <Frames onFrame={() => (frames += 1)} />
      </SceneCanvas>,
    );
    await vi.waitFor(() => expect(frames).toBeGreaterThan(1));
    await userEvent.click(container.querySelector("canvas")!);
    await vi.waitFor(() => expect(onSelect).toHaveBeenCalledOnce());
  });

  it("keeps orbit controls working under StrictMode", async () => {
    let root: RootState | undefined;
    const { container } = render(
      <StrictMode>
        <SceneCanvas className="viewport" eye={[2, 0, 0]} target={[0, 0, 0]}>
          <Probe onState={(s) => (root = s)} />
        </SceneCanvas>
      </StrictMode>,
    );
    await vi.waitFor(() => expect(root).toBeDefined());
    const canvas = container.querySelector("canvas")!;
    const distance = () => root!.camera.position.distanceTo(new Vector3());
    const before = distance();
    canvas.dispatchEvent(new WheelEvent("wheel", { deltaY: -400, bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(distance()).toBeLessThan(before - 0.01));
  });

  it("is a focusable 3D view that describes its keys", async () => {
    const { container } = render(<SceneCanvas className="viewport" label="Cell" />);
    const view = container.firstElementChild as HTMLElement;
    expect(view).toHaveAttribute("role", "group");
    expect(view).toHaveAttribute("aria-roledescription", "3D view");
    expect(view).toHaveAccessibleName("Cell");
    expect(view.tabIndex).toBe(0);
    expect(document.getElementById(view.getAttribute("aria-describedby")!)?.textContent).toMatch(/Arrow keys orbit/);
    await vi.waitFor(() => expect(container.querySelector("canvas")).not.toBeNull());
  });

  it("orbits, tilts within the polar limits, zooms and resets from the keyboard", async () => {
    let root: RootState | undefined;
    const scene = (target: [number, number, number]) => (
      <SceneCanvas className="viewport" eye={[2, 0, 0]} target={target} grid={0}>
        <Probe onState={(s) => (root = s)} />
      </SceneCanvas>
    );
    const { container, rerender } = render(scene([0, 0, 0]));
    await vi.waitFor(() => expect(root).toBeDefined());
    const view = container.firstElementChild as HTMLElement;
    const camera = root!.camera;
    const press = (key: string, init: KeyboardEventInit = {}, on: Element = view) => {
      const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
      on.dispatchEvent(event);
      return event.defaultPrevented;
    };
    const elevation = () => Math.asin(camera.position.z / camera.position.length());
    const deg = (d: number) => (d * Math.PI) / 180;

    expect(press("ArrowLeft")).toBe(true);
    // Z up, eye on +X: a step left turns it clockwise seen from above.
    expect(Math.atan2(camera.position.y, camera.position.x)).toBeCloseTo(deg(-5), 6);
    expect(press("ArrowDown", { shiftKey: true })).toBe(true);
    expect(elevation()).toBeCloseTo(deg(-15), 6);
    for (let i = 0; i < 20; i++) press("ArrowUp", { shiftKey: true });
    // Clamped just short of the pole, never over it.
    expect(elevation()).toBeLessThan(deg(90));
    expect(elevation()).toBeGreaterThan(deg(89.9));
    expect(camera.position.length()).toBeCloseTo(2, 6);

    expect(press("=")).toBe(true);
    expect(camera.position.length()).toBeCloseTo(2 / 1.2, 6);
    expect(press("_")).toBe(true);
    expect(camera.position.length()).toBeCloseTo(2, 6);

    // Not the camera's: page zoom, other keys, and keys pressed on content inside the view.
    const at = camera.position.clone();
    expect(press("0", { ctrlKey: true })).toBe(false);
    expect(press("+", { metaKey: true })).toBe(false);
    expect(press("a")).toBe(false);
    expect(press("ArrowLeft", {}, container.querySelector("canvas")!)).toBe(false);
    expect(camera.position.equals(at)).toBe(true);

    // `0` returns to the opening eye, looking at the current target.
    rerender(scene([0, 0, 1]));
    expect(press("0")).toBe(true);
    expect(camera.position.distanceTo(new Vector3(2, 0, 0))).toBeLessThan(1e-9);
    const look = camera.getWorldDirection(new Vector3());
    expect(look.angleTo(new Vector3(-2, 0, 1))).toBeLessThan(1e-6);
  });

  it("is pointer-only with keyboard={false}", async () => {
    let root: RootState | undefined;
    const { container } = render(
      <SceneCanvas className="viewport" eye={[2, 0, 0]} target={[0, 0, 0]} keyboard={false}>
        <Probe onState={(s) => (root = s)} />
      </SceneCanvas>,
    );
    await vi.waitFor(() => expect(root).toBeDefined());
    const view = container.firstElementChild as HTMLElement;
    expect(view).not.toHaveAttribute("tabindex");
    expect(view).not.toHaveAttribute("aria-describedby");
    const at = root!.camera.position.clone();
    const event = new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true });
    view.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(root!.camera.position.equals(at)).toBe(true);
  });
});
