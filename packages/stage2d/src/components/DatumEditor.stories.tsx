import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fireEvent, fn, userEvent, waitFor } from "storybook/test";

import { DatumEditor, type DatumEditorProps } from "./DatumEditor";
import type { Datum } from "./datumEdit";
import { ImageStage } from "./stage/ImageStage";
import type { StageView } from "./stage/view";

const IMAGE = { width: 400, height: 300 };
const VIEW: StageView = { scale: 1, tx: 0, ty: 0 };
const START: Datum = { origin: { x: 200, y: 150 }, angle: 0 };

/** A part with a bore and a slot, as an SVG data URL: something to set a frame on. */
const PART = (() => {
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${IMAGE.width}" height="${IMAGE.height}">`,
    `<rect width="100%" height="100%" fill="#1f2226"/>`,
    `<rect x="60" y="50" width="280" height="200" rx="12" fill="#b9bec4"/>`,
    `<circle cx="200" cy="150" r="36" fill="#16181b"/>`,
    `<rect x="250" y="190" width="70" height="20" rx="10" fill="#16181b"/>`,
    `</svg>`,
  ].join("");
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
})();

const commit = fn();

/** The degrees an output shows, to one decimal. */
function describe(d: Datum): string {
  const degrees = Math.round(((d.angle * 180) / Math.PI) * 10) / 10;
  return `origin ${Math.round(d.origin.x * 10) / 10}, ${Math.round(d.origin.y * 10) / 10}; angle ${degrees === 0 ? 0 : degrees}°`;
}

function Harness({ view = VIEW, start = START, ...props }: Partial<DatumEditorProps> & { view?: StageView; start?: Datum }) {
  const [value, setValue] = useState<Datum>(start);
  return (
    <div>
      <ImageStage image={IMAGE} view={view} onView={() => {}} style={{ width: IMAGE.width + 2, height: IMAGE.height + 2 }}>
        <img src={PART} alt="" draggable={false} className="absolute inset-0 h-full w-full" />
        <DatumEditor value={value} onValueChange={setValue} onCommit={commit} {...props} />
      </ImageStage>
      <output data-testid="datum">{describe(value)}</output>
    </div>
  );
}

/** The client point of image point `p` under `view`: from the viewport's content box, as the stage converts. */
function client(root: Element, p: { x: number; y: number }, view: StageView = VIEW, extra: Record<string, unknown> = {}) {
  const viewport = root.querySelector("[role=application]")!;
  const rect = viewport.getBoundingClientRect();
  return {
    clientX: rect.left + viewport.clientLeft + view.tx + (p.x + 0.5) * view.scale,
    clientY: rect.top + viewport.clientTop + view.ty + (p.y + 0.5) * view.scale,
    pointerId: 1,
    button: 0,
    pointerType: "mouse",
    ...extra,
  };
}

const meta = {
  title: "stage2d/DatumEditor",
  component: DatumEditor,
  parameters: {
    docs: {
      description: {
        component: `A datum on the image: an origin and the direction of its i axis, the frame a model, a target or a
measurement is expressed in. Drawn as a ring at the origin with its i axis (an arm ending in a rotation handle) and
its j axis (half as long, a quarter turn clockwise on screen), all over a halo and a constant size on screen.

- **Value**: \`{ origin: { x, y }, angle }\`, the angle in radians clockwise on screen from \`+x\`, as
  \`RotatedShape.rotation\` is. \`value\` / \`defaultValue\` / \`onValueChange\`, and \`onCommit\` once a drag ends or a key
  is pressed.
- **Pointer**: drag the ring to move the origin, the arm or its handle to turn the datum. A press grabs whichever is
  nearer, and nothing moves until the pointer has travelled 3 px, so a click does not nudge it. Shift rounds the
  angle to \`angleSnap\` (15°); \`snapAlways\` rounds every turn. \`originSnap\` rounds the origin to a grid and
  \`bounds\` keeps it in (the image by default). \`rotatable={false}\` fixes the angle; \`editable={false}\` only draws it.
- **Keyboard**: the origin is a button. Arrow keys move it one image pixel (ten with Shift, or grid steps with
  \`originSnap\`); \`[\` and \`]\` turn it by 1° (15° with Shift).

**Use** it to set a frame on an image: a model's origin and 0° direction, a calibration target's origin, an
annotation's reference axis.

**Don't** use it for a shape with an extent (\`ShapeEditor\`) or a region (\`RectRoiEditor\`).

**Accessibility**: the origin is a focusable button with the role description "datum", named with its numbers
("Datum: origin 200, 150, angle 0°"), so the datum can be read and set without a pointer.`,
      },
    },
  },
  args: { onCommit: commit },
  render: (args) => <Harness {...args} />,
} satisfies Meta<typeof DatumEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Drag the origin: a move inside the 3 px slop does nothing, then the datum follows and commits on release. */
export const Default: Story = {
  play: async ({ canvas, canvasElement }) => {
    commit.mockClear();
    const origin = canvas.getByRole("button", { name: "Datum: origin 200, 150, angle 0°" });
    await expect(origin).toHaveAttribute("aria-roledescription", "datum");
    await fireEvent.pointerDown(origin, client(canvasElement, { x: 202, y: 151 }));
    await waitFor(() => expect(canvasElement.querySelector("svg[data-dragging=origin]")).not.toBeNull());
    await fireEvent.pointerMove(window, client(canvasElement, { x: 204, y: 151 }));
    await expect(canvas.getByTestId("datum")).toHaveTextContent("origin 200, 150");
    await fireEvent.pointerMove(window, client(canvasElement, { x: 242, y: 171 }));
    await waitFor(() => expect(canvas.getByTestId("datum")).toHaveTextContent("origin 240, 170"));
    await fireEvent.pointerUp(window, client(canvasElement, { x: 242, y: 171 }));
    await expect(commit).toHaveBeenCalledTimes(1);
    await expect(canvasElement.querySelector("[role=application]")).not.toHaveAttribute("data-panning");
    await expect(canvasElement.querySelector("svg[data-dragging]")).toBeNull();
  },
};

/** Drawn, not editable: no button, no handle, and the i axis ends in an arrowhead. */
export const ReadOnly: Story = {
  args: { editable: false },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.queryByRole("button")).toBeNull();
    await expect(canvasElement.querySelector("[data-handle=rotate]")).toBeNull();
    await expect(canvasElement.querySelector("[data-datum-ring]")).not.toBeNull();
    await expect(canvasElement.querySelector("[data-datum] polyline")).not.toBeNull();
    await expect(canvasElement.querySelector("svg[data-editable]")).toBeNull();
  },
};

/** Shift while turning rounds the angle to 15°: the handle dragged to 50° lands on 45°. */
export const SnappedRotate: Story = {
  play: async ({ canvas, canvasElement }) => {
    const handle = canvasElement.querySelector("[data-handle=rotate]")!;
    const at = (degrees: number) => {
      const a = (degrees * Math.PI) / 180;
      return { x: 200 + 60 * Math.cos(a), y: 150 + 60 * Math.sin(a) };
    };
    await fireEvent.pointerDown(handle, client(canvasElement, { x: 240, y: 150 }));
    await fireEvent.pointerMove(window, client(canvasElement, at(50), VIEW, { shiftKey: true }));
    await waitFor(() => expect(canvas.getByTestId("datum")).toHaveTextContent("angle 45°"));
    // Without Shift the angle follows the pointer.
    await fireEvent.pointerMove(window, client(canvasElement, at(50)));
    await waitFor(() => expect(canvas.getByTestId("datum")).toHaveTextContent("angle 50°"));
    await fireEvent.pointerMove(window, client(canvasElement, at(-100), VIEW, { shiftKey: true }));
    await fireEvent.pointerUp(window, client(canvasElement, at(-100), VIEW, { shiftKey: true }));
    await waitFor(() => expect(canvas.getByTestId("datum")).toHaveTextContent("angle -105°"));
    const label = canvas.getByRole("button").getAttribute("aria-label")!;
    const degrees = Number(/angle (-?[\d.]+)°/.exec(label)![1]);
    await expect(Math.abs(degrees / 15 - Math.round(degrees / 15))).toBeLessThan(1e-9);
  },
};

/** The keyboard: arrows move the origin, `[` and `]` turn it, Shift for bigger steps. */
export const Keyboard: Story = {
  play: async ({ canvas }) => {
    commit.mockClear();
    const origin = canvas.getByRole("button");
    origin.focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(origin).toHaveAccessibleName("Datum: origin 201, 150, angle 0°");
    await userEvent.keyboard("{Shift>}{ArrowDown}{/Shift}");
    await expect(origin).toHaveAccessibleName("Datum: origin 201, 160, angle 0°");
    await userEvent.keyboard("]");
    await expect(origin).toHaveAccessibleName("Datum: origin 201, 160, angle 1°");
    // `[[` types a "[" (a lone one opens a key code).
    await userEvent.keyboard("{Shift>}[[{/Shift}");
    await expect(origin).toHaveAccessibleName("Datum: origin 201, 160, angle -14°");
    await expect(commit).toHaveBeenCalledTimes(4);
  },
};

/** The origin kept inside a region and on a 10 px grid: dragged far outside, it stops on the region's last grid line. */
export const Bounds: Story = {
  args: { bounds: { x: 100, y: 75, width: 205, height: 150 }, originSnap: 10, label: "Target origin" },
  play: async ({ canvas, canvasElement }) => {
    const origin = canvas.getByRole("button", { name: /^Target origin/ });
    await fireEvent.pointerDown(origin, client(canvasElement, { x: 200, y: 150 }));
    await fireEvent.pointerMove(window, client(canvasElement, { x: 390, y: 290 }));
    await fireEvent.pointerUp(window, client(canvasElement, { x: 390, y: 290 }));
    await waitFor(() => expect(canvas.getByTestId("datum")).toHaveTextContent("origin 300, 220"));
    origin.focus();
    await userEvent.keyboard("{ArrowLeft}");
    await expect(canvas.getByTestId("datum")).toHaveTextContent("origin 290, 220");
  },
};

const ZOOM: StageView = { scale: 4, tx: -600, ty: -450 };

/** At 400 % the glyph keeps its screen size: the 7 px ring is 1.75 image px, the 40 px arm 10. */
export const ZoomedIn: Story = {
  render: (args) => <Harness {...args} view={ZOOM} />,
  play: async ({ canvas, canvasElement }) => {
    const ring = canvasElement.querySelector("[data-datum-ring]")!;
    await expect(Number(ring.getAttribute("r"))).toBeCloseTo(1.75, 6);
    const handle = canvasElement.querySelector("[data-handle=rotate]")!;
    await expect(Number(handle.getAttribute("cx"))).toBeCloseTo(210, 6);
    // A turn by the handle works in screen pixels too: a quarter turn, clockwise on screen.
    await fireEvent.pointerDown(handle, client(canvasElement, { x: 210, y: 150 }, ZOOM));
    await fireEvent.pointerMove(window, client(canvasElement, { x: 200, y: 160 }, ZOOM));
    await fireEvent.pointerUp(window, client(canvasElement, { x: 200, y: 160 }, ZOOM));
    await waitFor(() => expect(canvas.getByTestId("datum")).toHaveTextContent("angle 90°"));
  },
};
