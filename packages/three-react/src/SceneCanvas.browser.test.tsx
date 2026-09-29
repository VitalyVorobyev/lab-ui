import { type RootState, useThree } from "@react-three/fiber";
import { render } from "@testing-library/react";
import { StrictMode, useEffect } from "react";
import { Vector3 } from "three";
import { afterAll, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

import { AtFrame, FrameTree } from "./FrameTree";
import { CameraFrustum } from "./gizmos";
import { SceneCanvas } from "./SceneCanvas";

// Tailwind is not compiled here; the canvas only renders once its box has a size.
const style = document.createElement("style");
style.textContent = ".viewport { width: 240px; height: 160px; }";
document.head.append(style);
afterAll(() => style.remove());

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

describe("SceneCanvas", () => {
  it("picks gizmos placed in a frame on GIZMO_LAYER", async () => {
    const onSelect = vi.fn();
    const { container } = render(
      // Looking down −Z at the frustum of a camera at z = 1 whose optical axis is +Z.
      <SceneCanvas className="viewport" eye={[0, 0, 3]} target={[0, 0, 0]} up={[0, 1, 0]} grid={0}>
        <FrameTree baked={baked}>
          <AtFrame name="cam">
            <CameraFrustum borderRays={RAYS} depth={0.5} onSelect={onSelect} />
          </AtFrame>
        </FrameTree>
      </SceneCanvas>,
    );
    await vi.waitFor(() => expect(container.querySelector("canvas")).not.toBeNull());
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
});
