import { useThree } from "@react-three/fiber";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import type { Camera } from "three";

import { FrameAxes, TargetBoard } from "./gizmos";
import { SceneCanvas, type SceneCanvasProps } from "./SceneCanvas";

/** The camera each rendered story uses, by label — how `play` reads where it is. */
const CAMERAS = new Map<string, Camera>();

function CameraProbe({ label }: { label: string }) {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    CAMERAS.set(label, camera);
  }, [label, camera]);
  return null;
}

function Scene(props: SceneCanvasProps & { label: string }) {
  return (
    <SceneCanvas className="h-80 w-full" eye={[1, -1, 0.8]} target={[0, 0, 0]} grid={1} {...props}>
      <TargetBoard width={0.3} height={0.2} checker={{ cols: 6, rows: 4 }} />
      <FrameAxes size={0.15} />
      <CameraProbe label={props.label} />
    </SceneCanvas>
  );
}

const meta = {
  title: "three-react/Scene canvas",
  component: Scene,
  args: { label: "Calibration board" },
  parameters: {
    docs: {
      description: {
        component: `A 3D viewport with Z up: orbit controls, a ground grid normal to \`up\`, ambient and key light, and the scene
colours of the current theme. Everything inside is in world coordinates (metres); place content in moving frames with
\`FrameTree\` and \`AtFrame\`.

- **Props:** \`eye\` and \`target\` set the opening view, \`up\` the world's up axis (\`[0, -1, 0]\` for a camera-frame
  scene), \`fov\`, \`clip\` and \`grid\` the projection and the ground grid. Size it with \`className\`; the canvas fills it.
- **Keyboard:** with \`keyboard\` (the default) the view is a tab stop. Left and Right orbit about the up axis, Up and
  Down tilt over the target (5° a press, 15° with Shift), \`+\` and \`-\` zoom, and \`0\` returns to the opening view.
  Keys with Ctrl, Cmd or Alt are left to the browser. \`keyboard={false}\` makes it pointer-only, for a small preview
  that should not take a tab stop.
- **When not to use:** for a flat image with overlays use an image stage; for a fixed, non-interactive picture of a
  scene, render it to an image instead.
- **Accessibility:** the wrapper is a \`group\` announced as a "3D view" and named by \`label\`; with \`keyboard\` its keys
  are described to assistive technology. Picking objects is by pointer only: offer the same choices in a list or an
  inspector beside the view.`,
      },
    },
  },
} satisfies Meta<typeof Scene>;

export default meta;
type Story = StoryObj<typeof meta>;

const distance = (camera: Camera) => camera.position.length();
const azimuth = (camera: Camera) => Math.atan2(camera.position.y, camera.position.x);
const elevation = (camera: Camera) => Math.asin(camera.position.z / camera.position.length());

/** The keyboard moves the camera: arrows orbit and tilt, `+` and `-` zoom, `0` returns to the opening view. */
export const Keyboard: Story = {
  play: async ({ canvasElement, args }) => {
    const view = within(canvasElement).getByRole("group", { name: args.label });
    await expect(view).toHaveAttribute("aria-roledescription", "3D view");
    await expect(view).toHaveAccessibleDescription(/Arrow keys orbit/);
    await waitFor(() => expect(CAMERAS.get(args.label)).toBeDefined());
    const camera = CAMERAS.get(args.label)!;
    const start = camera.position.clone();

    await userEvent.tab();
    await expect(view).toHaveFocus();

    const a0 = azimuth(camera);
    await userEvent.keyboard("{ArrowRight}");
    // Z up: a step to the right turns the eye 5° counter-clockwise seen from above.
    await expect(azimuth(camera) - a0).toBeCloseTo((5 * Math.PI) / 180, 3);
    await userEvent.keyboard("{Shift>}{ArrowLeft}{/Shift}");
    await expect(azimuth(camera) - a0).toBeCloseTo((-10 * Math.PI) / 180, 3);

    const e0 = elevation(camera);
    await userEvent.keyboard("{ArrowUp}");
    await expect(elevation(camera)).toBeGreaterThan(e0);

    const d0 = distance(camera);
    await userEvent.keyboard("+");
    await expect(distance(camera)).toBeCloseTo(d0 / 1.2, 6);
    await userEvent.keyboard("-");
    await expect(distance(camera)).toBeCloseTo(d0, 6);

    await userEvent.keyboard("0");
    await expect(camera.position.distanceTo(start)).toBeLessThan(1e-6);
  },
};

/** `keyboard={false}`: pointer only — no tab stop, keys do nothing. */
export const PointerOnly: Story = {
  args: { label: "Preview", keyboard: false },
  play: async ({ canvasElement, args }) => {
    const view = within(canvasElement).getByRole("group", { name: args.label });
    await expect(view).not.toHaveAttribute("tabindex");
    await expect(view).not.toHaveAttribute("aria-describedby");
    await waitFor(() => expect(CAMERAS.get(args.label)).toBeDefined());
    const camera = CAMERAS.get(args.label)!;
    const start = camera.position.clone();
    view.focus();
    await userEvent.keyboard("{ArrowRight}+");
    await expect(camera.position.equals(start)).toBe(true);
  },
};
