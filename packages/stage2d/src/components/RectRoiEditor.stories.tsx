import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fireEvent, fn, waitFor } from "storybook/test";

import { RectRoiEditor, type RectRoiEditorProps } from "./RectRoiEditor";
import { ImageStage } from "./stage/ImageStage";
import type { Rect, StageView } from "./stage/view";

const IMAGE = { width: 400, height: 300 };
// 1:1 at the origin, so client coordinates are image coordinates plus the viewport's corner.
const VIEW: StageView = { scale: 1, tx: 0, ty: 0 };

const change = fn();
const commit = fn();

function Harness(props: Partial<RectRoiEditorProps> & { initial: Rect | null }) {
  const [value, setValue] = useState<Rect | null>(props.initial);
  return (
    <div style={{ width: IMAGE.width + 2, height: IMAGE.height + 2 }}>
      <ImageStage image={IMAGE} view={VIEW} onView={() => {}} style={{ width: IMAGE.width + 2, height: IMAGE.height + 2 }}>
        <div className="absolute inset-0 bg-surface" />
        <RectRoiEditor
          {...props}
          value={value}
          onValueChange={(next) => {
            setValue(next);
            change(next);
          }}
          onCommit={commit}
        />
      </ImageStage>
      <output data-testid="roi">{value ? `${value.x},${value.y},${value.width},${value.height}` : "none"}</output>
    </div>
  );
}

/** Press, move and release on an element, at image coordinates (the view is 1:1 at the origin). */
async function drag(target: Element, from: { x: number; y: number }, to: { x: number; y: number }) {
  const viewport = target.closest("[role=application]")!;
  const origin = viewport.getBoundingClientRect();
  // `clientLeft` / `clientTop`: the stage's origin is inside the border.
  const ox = origin.left + (viewport as HTMLElement).clientLeft;
  const oy = origin.top + (viewport as HTMLElement).clientTop;
  const at = (p: { x: number; y: number }) => ({ clientX: ox + p.x + 0.5, clientY: oy + p.y + 0.5, pointerId: 1, button: 0 });
  await fireEvent.pointerDown(target, at(from));
  await fireEvent.pointerMove(target, at({ x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }));
  await fireEvent.pointerMove(target, at(to));
  await fireEvent.pointerUp(target, at(to));
}

const meta = {
  title: "stage2d/RectRoiEditor",
  component: RectRoiEditor,
  parameters: {
    docs: {
      description: {
        component: `An axis-aligned region of interest inside an \`ImageStage\`.

- **Editing.** Eight handles resize the region and the interior moves it. A handle dragged
  through the opposite edge flips the box. With \`draw\`, a drag elsewhere on the image draws
  a new region.
- **Limits.** The region stays inside \`bounds\` (the image by default) and is never smaller
  than \`minSize\`.
- **Events.** \`onValueChange\` follows every move; \`onCommit\` fires once a gesture ends.
- **Screen size.** Handles and the outline are a constant size on screen at every zoom.

**Use** it wherever a person sets the region an algorithm runs on, and pair it with the
region's numbers beside the stage, e.g. a \`VectorInput\`.

**Don't** use it for a rotated region or a polygon; that is \`ContourEditor\`.

**Accessibility**: the region is a focusable button named with its numbers. Arrow keys move
it (Shift ×10) and Alt + arrows resize it. The hand tool and a held space bar still pan.`,
      },
    },
  },
  args: { value: null, onValueChange: change },
  render: () => <Harness initial={{ x: 120, y: 80, width: 160, height: 120 }} />,
} satisfies Meta<typeof RectRoiEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Editable: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: /Region: 120, 80, 160 × 120 px/ })).toBeVisible();
  },
};

export const Resize: Story = {
  play: async ({ canvas, canvasElement }) => {
    commit.mockClear();
    const se = canvasElement.querySelector("[data-handle=se]")!;
    await drag(se, { x: 280, y: 200 }, { x: 300, y: 240 });
    await waitFor(() => expect(canvas.getByTestId("roi")).toHaveTextContent("120,80,180,160"));
    await expect(commit).toHaveBeenCalledTimes(1);
  },
};

export const Move: Story = {
  play: async ({ canvas }) => {
    commit.mockClear();
    const region = canvas.getByRole("button", { name: /Region/ });
    await drag(region, { x: 200, y: 140 }, { x: 150, y: 120 });
    await waitFor(() => expect(canvas.getByTestId("roi")).toHaveTextContent("70,60,160,120"));
    await expect(commit).toHaveBeenCalledTimes(1);
    // Moved past the corner: held inside the image without shrinking.
    await drag(canvas.getByRole("button", { name: /Region/ }), { x: 150, y: 120 }, { x: -200, y: -200 });
    await waitFor(() => expect(canvas.getByTestId("roi")).toHaveTextContent("0,0,160,120"));
  },
};

export const Keyboard: Story = {
  play: async ({ canvas }) => {
    commit.mockClear();
    const region = canvas.getByRole("button", { name: /Region/ });
    await fireEvent.keyDown(region, { key: "ArrowRight" });
    await fireEvent.keyDown(canvas.getByRole("button", { name: /Region/ }), { key: "ArrowDown", shiftKey: true });
    await fireEvent.keyDown(canvas.getByRole("button", { name: /Region/ }), { key: "ArrowLeft", altKey: true });
    await waitFor(() => expect(canvas.getByTestId("roi")).toHaveTextContent("121,90,159,120"));
    await expect(commit).toHaveBeenCalledTimes(3);
    // Other keys are left to the stage.
    await fireEvent.keyDown(canvas.getByRole("button", { name: /Region/ }), { key: "a" });
    await expect(commit).toHaveBeenCalledTimes(3);
  },
};

export const Draw: Story = {
  render: () => <Harness initial={null} draw />,
  play: async ({ canvas, canvasElement }) => {
    commit.mockClear();
    const surface = canvasElement.querySelector("[data-draw-surface]")!;
    // A click is not a region.
    await drag(surface, { x: 50, y: 50 }, { x: 51, y: 51 });
    await expect(canvas.getByTestId("roi")).toHaveTextContent("none");
    // Dragged up-left from the start corner, and past the image's edge.
    await drag(surface, { x: 100, y: 120 }, { x: -40, y: 30 });
    await waitFor(() => expect(canvas.getByTestId("roi")).toHaveTextContent("0,30,100,90"));
    await expect(commit).toHaveBeenCalledTimes(1);
  },
};

export const ReadOnly: Story = {
  render: () => <Harness initial={{ x: 40, y: 40, width: 120, height: 80 }} editable={false} />,
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.queryByRole("button")).toBeNull();
    await expect(canvasElement.querySelector("[data-handle]")).toBeNull();
  },
};
