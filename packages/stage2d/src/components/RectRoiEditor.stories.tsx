import type { Meta, StoryObj } from "@storybook/react-vite";
import { useRef, useState } from "react";
import { expect, fireEvent, fn, waitFor } from "storybook/test";

import { AreaSet } from "./AreaSet";
import type { AreaId } from "./areaIndex";
import type { Point } from "./measureGeometry";
import { RectRoiEditor, type RectRoiEditorHandle, type RectRoiEditorProps } from "./RectRoiEditor";
import { ImageStage } from "./stage/ImageStage";
import { StageSurface } from "./stage/StageSurface";
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

/** The client position over image point `p` (the view is 1:1 at the origin). */
function clientAt(within: Element, p: Point) {
  const viewport = within.closest("[role=application]") ?? within.querySelector("[role=application]")!;
  const origin = viewport.getBoundingClientRect();
  // `clientLeft` / `clientTop`: the stage's origin is inside the border.
  return {
    clientX: origin.left + viewport.clientLeft + p.x + 0.5,
    clientY: origin.top + viewport.clientTop + p.y + 0.5,
    pointerId: 1,
    button: 0,
  };
}

/** Press on an element, move through `path` and release at its end, at image coordinates. */
async function gesture(target: Element, from: Point, ...path: Point[]) {
  await fireEvent.pointerDown(target, clientAt(target, from));
  for (const p of path) await fireEvent.pointerMove(target, clientAt(target, p));
  await fireEvent.pointerUp(target, clientAt(target, path.at(-1) ?? from));
}

/** Press, move and release on an element, at image coordinates. */
async function drag(target: Element, from: Point, to: Point) {
  await gesture(target, from, { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }, to);
}

const SIZE = { width: IMAGE.width + 2, height: IMAGE.height + 2 };

/** Two detected regions inside the box: with `interior="none"` a press on one selects it. */
const AREAS = [
  { id: "pore", points: [130, 100, 190, 100, 190, 150, 130, 150] },
  { id: "scratch", points: [220, 170, 290, 170, 290, 200, 220, 200] },
];

function PassThroughHarness() {
  const [value, setValue] = useState<Rect | null>({ x: 80, y: 60, width: 240, height: 180 });
  const [selected, setSelected] = useState<AreaId | null>(null);
  return (
    <div style={SIZE}>
      <ImageStage image={IMAGE} view={VIEW} onView={() => {}} style={SIZE}>
        <div className="absolute inset-0 bg-surface" />
        <AreaSet items={AREAS} selectedIds={selected === null ? [] : [selected]} onItemPress={(id) => setSelected(id)} />
        <RectRoiEditor
          value={value}
          interior="none"
          onValueChange={(next) => {
            setValue(next);
            change(next);
          }}
          onCommit={commit}
        />
      </ImageStage>
      <output data-testid="roi">{value ? `${value.x},${value.y},${value.width},${value.height}` : "none"}</output>
      <output data-testid="selected">{selected ?? "none"}</output>
    </div>
  );
}

/** The app's own `StageSurface` decides what a press means, and starts the region's draw through its `ref`. */
function ExternalDrawHarness() {
  const [value, setValue] = useState<Rect | null>(null);
  const roiRef = useRef<RectRoiEditorHandle>(null);
  return (
    <div style={SIZE}>
      <ImageStage image={IMAGE} view={VIEW} onView={() => {}} style={SIZE}>
        <div className="absolute inset-0 bg-surface" />
        <StageSurface cursor="crosshair" onPress={(press) => roiRef.current?.drawDrag(press)} />
        <RectRoiEditor
          ref={roiRef}
          value={value}
          draw
          drawSurface={false}
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

const meta = {
  title: "stage2d/RectRoiEditor",
  component: RectRoiEditor,
  parameters: {
    docs: {
      description: {
        component: `An axis-aligned region of interest inside an \`ImageStage\`.

- **Editing.** Eight handles resize the region; the interior and the band along the outline move
  it. A handle dragged through the opposite edge flips the box. One decision serves every part:
  the nearest handle first, then the band, then the interior. With \`interior="none"\` a press
  inside the region reaches the layers below it (selecting a region the box encloses, say), and
  only the handles and the band grab the box.
- **Click slop.** A press becomes an edit only past 3 screen pixels of travel, so a jittery click
  changes nothing and commits nothing.
- **Drawing.** With \`draw\`, a drag elsewhere on the image draws a new region. With
  \`drawSurface={false}\` the layer has no full-frame target of its own: the app's \`StageSurface\`
  returns \`ref.current.drawDrag(press)\` from \`onPress\` (or calls \`startDraw(event)\` from a
  \`pointerdown\`), so other layers can sit between that surface and the region's handles.
- **Tint.** \`fill\` (default: the outline colour) and \`fillOpacity\` (default 0.06; 0 for none).
- **Limits.** The region stays inside \`bounds\` (the image by default) and is never smaller
  than \`minSize\`.
- **Events.** \`onValueChange\` follows every move; \`onCommit\` fires once a gesture ends.
- **Screen size.** Handles and the outline are a constant size on screen at every zoom.

**Use** it wherever a person sets the region an algorithm runs on, and pair it with the
region's numbers beside the stage, e.g. a \`VectorInput\`.

**Don't** use it for a rotated region or a polygon; that is \`ContourEditor\`.

**Accessibility**: the region is a focusable button named with its numbers, also with
\`interior="none"\`. Arrow keys move it (Shift ×10) and Alt + arrows resize it. The hand tool and a
held space bar still pan.

**Data attributes**: \`data-editable\` and \`data-drawing\` on the SVG; \`data-draw-surface\` on the draw
target; \`data-roi-interior\` on the region's inside; \`data-roi-band\` on the band along its outline;
\`data-handle\` (\`nw\`, \`n\`, \`ne\`, \`e\`, \`se\`, \`s\`, \`sw\`, \`w\`) on each handle.`,
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
    await waitFor(() => expect(canvas.getByTestId("roi")).toHaveTextContent("-0.5,-0.5,160,120"));
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
    await waitFor(() => expect(canvas.getByTestId("roi")).toHaveTextContent("-0.5,30,100.5,90"));
    await expect(commit).toHaveBeenCalledTimes(1);
  },
};

/**
 * The default bounds are the image's own extent, `[-0.5, w - 0.5]`: a region that fills them
 * is drawn on the image's edges, not half a pixel right and down of them.
 */
export const FullImage: Story = {
  render: () => <Harness initial={{ x: -0.5, y: -0.5, width: IMAGE.width, height: IMAGE.height }} />,
  play: async ({ canvasElement }) => {
    const image = canvasElement.querySelector("[data-stage]")!.getBoundingClientRect();
    const outline = canvasElement.querySelector("svg rect[fill-opacity]")!.getBoundingClientRect();
    await expect(outline.left).toBeCloseTo(image.left, 3);
    await expect(outline.top).toBeCloseTo(image.top, 3);
    await expect(outline.right).toBeCloseTo(image.right, 3);
    await expect(outline.bottom).toBeCloseTo(image.bottom, 3);
  },
};

export const ReadOnly: Story = {
  render: () => <Harness initial={{ x: 40, y: 40, width: 120, height: 80 }} editable={false} />,
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.queryByRole("button")).toBeNull();
    await expect(canvasElement.querySelector("[data-handle]")).toBeNull();
  },
};

/**
 * \`interior="none"\`: a press inside the box reaches the regions below it, so one the box
 * encloses can be selected; the band along the outline still moves the box, and the keys still
 * work.
 */
export const InteriorPassThrough: Story = {
  render: () => <PassThroughHarness />,
  play: async ({ canvas, canvasElement }) => {
    change.mockClear();
    commit.mockClear();
    const inside = canvasElement.querySelector("[data-roi-interior]")!;
    // Where the stylesheet is loaded the inside takes no pointer events at all, so a press
    // there lands on what is below.
    if (getComputedStyle(inside).pointerEvents === "none") {
      const { clientX, clientY } = clientAt(inside, { x: 160, y: 125 });
      await expect(document.elementFromPoint(clientX, clientY)?.closest("[data-roi-interior]")).toBeNull();
    }
    // Even a press the inside does receive is declined, and goes on to the stage: the pore,
    // inside the box, is selected and the box is left alone.
    await gesture(inside, { x: 160, y: 125 });
    await waitFor(() => expect(canvas.getByTestId("selected")).toHaveTextContent("pore"));
    await expect(change).not.toHaveBeenCalled();
    await expect(canvas.getByTestId("roi")).toHaveTextContent("80,60,240,180");
    // The band along the top edge, away from the handles, still moves it.
    await drag(canvasElement.querySelector("[data-roi-band]")!, { x: 140, y: 62 }, { x: 160, y: 82 });
    await waitFor(() => expect(canvas.getByTestId("roi")).toHaveTextContent("100,80,240,180"));
    await expect(commit).toHaveBeenCalledTimes(1);
    // Still a focusable button: the keys move it.
    await fireEvent.keyDown(canvas.getByRole("button", { name: /Region/ }), { key: "ArrowRight" });
    await waitFor(() => expect(canvas.getByTestId("roi")).toHaveTextContent("101,80,240,180"));
  },
};

/** No draw target of its own: the app's \`StageSurface\` starts the draw with \`drawDrag\`. */
export const ExternalDraw: Story = {
  render: () => <ExternalDrawHarness />,
  play: async ({ canvas, canvasElement }) => {
    commit.mockClear();
    await expect(canvasElement.querySelector("[data-draw-surface]")).toBeNull();
    const surface = canvasElement.querySelector("[data-stage-surface]")!;
    // A jitter is a click: nothing is drawn.
    await gesture(surface, { x: 60, y: 50 }, { x: 61, y: 51 });
    await expect(canvas.getByTestId("roi")).toHaveTextContent("none");
    await drag(surface, { x: 60, y: 50 }, { x: 180, y: 140 });
    await waitFor(() => expect(canvas.getByTestId("roi")).toHaveTextContent("60,50,120,90"));
    await expect(commit).toHaveBeenCalledTimes(1);
    // The drawn region is edited as usual.
    await expect(canvasElement.querySelector("[data-handle=se]")).not.toBeNull();
  },
};

/** \`fillOpacity={0}\`: an outline with no tint, for a region over a mask or a heatmap. */
export const NoTint: Story = {
  render: () => <Harness initial={{ x: 120, y: 80, width: 160, height: 120 }} fillOpacity={0} />,
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("svg rect[fill-opacity]")).toBeNull();
    const outline = canvasElement.querySelector("svg rect[stroke-dasharray]")!;
    await expect(outline).toHaveAttribute("fill", "none");
  },
};

/**
 * A press that wanders less than 3 screen pixels is a click: neither the value nor the commit
 * changes. Past the slop the drag edits as usual.
 */
export const JitterClick: Story = {
  play: async ({ canvas, canvasElement }) => {
    change.mockClear();
    commit.mockClear();
    const se = canvasElement.querySelector("[data-handle=se]")!;
    await gesture(se, { x: 280, y: 200 }, { x: 281, y: 201 }, { x: 282, y: 200 });
    const region = canvas.getByRole("button", { name: /Region/ });
    await gesture(region, { x: 200, y: 140 }, { x: 198, y: 141 });
    await expect(change).not.toHaveBeenCalled();
    await expect(commit).not.toHaveBeenCalled();
    await expect(canvas.getByTestId("roi")).toHaveTextContent("120,80,160,120");
    // Four pixels is a drag.
    await gesture(se, { x: 280, y: 200 }, { x: 284, y: 200 });
    await waitFor(() => expect(canvas.getByTestId("roi")).toHaveTextContent("120,80,164,120"));
    await expect(commit).toHaveBeenCalledTimes(1);
  },
};
