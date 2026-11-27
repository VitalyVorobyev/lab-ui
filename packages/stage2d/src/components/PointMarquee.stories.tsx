import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fireEvent, waitFor } from "storybook/test";

import { PointMarquee, type PointMarqueeProps } from "./PointMarquee";
import { PointSet, type PointSetItem } from "./PointSet";
import type { PointId } from "./pointIndex";
import { ImageStage } from "./stage/ImageStage";
import type { StageView } from "./stage/view";

const IMAGE = { width: 400, height: 300 };
const VIEW: StageView = { scale: 1, tx: 0, ty: 0 };

/** A 5×4 grid of corners, with ids `r,c`. */
const ITEMS: PointSetItem[] = Array.from({ length: 20 }, (_, n) => ({
  id: `${Math.floor(n / 5)},${n % 5}`,
  kind: "plus",
  x: 60 + 70 * (n % 5),
  y: 55 + 65 * Math.floor(n / 5),
}));

/** Client position of image point `p` (the view is 1:1 at the origin) on the stage the story renders. */
function at(root: Element, p: { x: number; y: number }, extra: Record<string, unknown> = {}) {
  const stage = root.querySelector("[data-stage]")!.getBoundingClientRect();
  return { clientX: stage.left + p.x + 0.5, clientY: stage.top + p.y + 0.5, pointerId: 1, button: 0, ...extra };
}

function Harness(props: Partial<PointMarqueeProps>) {
  const [selected, setSelected] = useState<Set<PointId>>(() => new Set());
  const [view, setView] = useState<StageView>(VIEW);
  return (
    <div>
      <ImageStage image={IMAGE} view={view} onView={setView} style={{ width: IMAGE.width + 2, height: IMAGE.height + 2 }}>
        <div className="absolute inset-0 bg-canvas" />
        <PointSet items={ITEMS} selectedIds={selected} />
        <PointMarquee
          items={ITEMS}
          {...props}
          onSelect={(ids, mode) => setSelected((current) => new Set(mode === "add" ? [...current, ...ids] : ids))}
        />
      </ImageStage>
      <output data-testid="selected">{[...selected].map(String).sort().join(" ") || "none"}</output>
    </div>
  );
}

const meta = {
  title: "stage2d/PointMarquee",
  component: PointMarquee,
  parameters: {
    docs: {
      description: {
        component: `A rectangular marquee for a point set: hold a modifier (Shift by default) and drag, and \`onSelect\`
receives the ids of the points inside the rectangle, drawn as a band while the pointer moves. Add ⌘/Ctrl to the
modifier and the mode is \`"add"\` instead of \`"replace"\`.

- **Opt-in:** without the modifier the layer takes no press at all, so panning, wheel zoom and the layers beneath
  work as if it were not there. The layer's full-frame target exists only while the modifier is held.
- **Escape** abandons a marquee in flight: the band goes, \`onCancel\` is called, and the release selects nothing.
- **Hosted:** an app that already has a \`StageSurface\` sets \`surface={false}\` and returns \`ref.sweepDrag(press)\`
  from its \`onPress\`.
- A release without movement is a click, not a rectangle: nothing is reported.

**Use** it with \`PointSet\` (or any layer that shows the ids) for selecting many points at once.

**Don't** rely on it for touch: a finger has no modifier, so it pans. Offer the selection through a list or a
tool button as well.

**Accessibility**: the marquee is pointer-only and decorative (\`aria-hidden\`). The same selection must be
possible from the list beside the stage.`,
      },
    },
  },
  args: { items: ITEMS, onSelect: () => {} },
  render: (args) => <Harness {...args} />,
} satisfies Meta<typeof PointMarquee>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ShiftDrag: Story = {
  play: async ({ canvas, canvasElement }) => {
    const root = canvasElement;
    await expect(root.querySelector("[data-marquee-surface]")).toBeNull();
    await fireEvent.keyDown(window, { key: "Shift", shiftKey: true });
    await waitFor(() => expect(root.querySelector("[data-marquee-surface]")).not.toBeNull());
    const surface = root.querySelector("[data-marquee-surface]")!;
    await fireEvent.pointerDown(surface, at(root, { x: 40, y: 35 }, { shiftKey: true }));
    await fireEvent.pointerMove(window, at(root, { x: 140, y: 130 }, { shiftKey: true }));
    await waitFor(() => expect(root.querySelector("svg[data-marquee] rect")).not.toBeNull());
    await fireEvent.pointerUp(window, at(root, { x: 140, y: 130 }, { shiftKey: true }));
    await waitFor(() => expect(canvas.getByTestId("selected").textContent).toBe("0,0 0,1 1,0 1,1"));
    await fireEvent.keyUp(window, { key: "Shift" });
  },
};

export const EscapeCancels: Story = {
  play: async ({ canvas, canvasElement }) => {
    const root = canvasElement;
    await fireEvent.keyDown(window, { key: "Shift", shiftKey: true });
    await waitFor(() => expect(root.querySelector("[data-marquee-surface]")).not.toBeNull());
    const surface = root.querySelector("[data-marquee-surface]")!;
    await fireEvent.pointerDown(surface, at(root, { x: 40, y: 35 }, { shiftKey: true }));
    await fireEvent.pointerMove(window, at(root, { x: 140, y: 130 }, { shiftKey: true }));
    await waitFor(() => expect(root.querySelector("svg[data-marquee] rect")).not.toBeNull());
    await fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(root.querySelector("svg[data-marquee] rect")).toBeNull());
    await fireEvent.pointerUp(window, at(root, { x: 140, y: 130 }, { shiftKey: true }));
    await expect(canvas.getByTestId("selected").textContent).toBe("none");
    await fireEvent.keyUp(window, { key: "Shift" });
  },
};

export const WithoutModifierPans: Story = {
  play: async ({ canvas, canvasElement }) => {
    const root = canvasElement;
    await expect(root.querySelector("[data-marquee-surface]")).toBeNull();
    // A plain drag is the stage's: it pans, and nothing is selected.
    const viewport = root.querySelector("[role=application]")!;
    await fireEvent.pointerDown(viewport, at(root, { x: 40, y: 35 }));
    await fireEvent.pointerMove(viewport, at(root, { x: 140, y: 130 }));
    await fireEvent.pointerUp(viewport, at(root, { x: 140, y: 130 }));
    await expect(canvas.getByTestId("selected").textContent).toBe("none");
  },
};
