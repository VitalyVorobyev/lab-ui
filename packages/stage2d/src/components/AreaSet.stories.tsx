import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fireEvent, fn, waitFor } from "storybook/test";

import type { AreaId } from "./areaIndex";
import { AreaSet, type AreaSetItem, type AreaSetProps } from "./AreaSet";
import { PointSet } from "./PointSet";
import { ImageStage } from "./stage/ImageStage";
import { useStageHitTest } from "./stage/useStageHitTest";
import { StageSurface } from "./stage/StageSurface";
import type { StageView } from "./stage/view";

const IMAGE = { width: 400, height: 300 };
const VIEW: StageView = { scale: 1, tx: 0, ty: 0 };

/** A square of half-side `r` centred at `(cx, cy)`, turned by `angle`, vertex 0 first. */
function quad(cx: number, cy: number, r: number, angle: number): number[] {
  return [0, 1, 2, 3].flatMap((_, k) => {
    const t = angle + (k * Math.PI) / 2 - (3 * Math.PI) / 4;
    return [cx + r * Math.SQRT2 * Math.cos(t), cy + r * Math.SQRT2 * Math.sin(t)];
  });
}

/** Six marker quads inside a board outline, and a model-role region below. */
const ITEMS: AreaSetItem[] = [
  { id: "board", role: "structure", label: "board", points: [30, 20, 370, 20, 370, 210, 30, 210] },
  ...Array.from({ length: 6 }, (_, n): AreaSetItem => ({
    id: n,
    label: String(n),
    points: quad(70 + 110 * (n % 3), 60 + 100 * Math.floor(n / 3), 20, 0.15 * n),
  })),
  { id: "roi", role: "model", label: "ROI", points: [40, 225, 360, 225, 380, 285, 40, 285] },
];

const hover = fn();
const press = fn();

/** Client position of image point `p` (the view is 1:1 at the origin) on the stage the story renders. */
function at(root: Element, p: { x: number; y: number }, extra: Record<string, unknown> = {}) {
  const stage = root.querySelector("[data-stage]")!.getBoundingClientRect();
  return { clientX: stage.left + p.x + 0.5, clientY: stage.top + p.y + 0.5, pointerId: 1, button: 0, ...extra };
}

const viewport = (root: Element) => root.querySelector("[role=application]")!;

function Frame({ children, view = VIEW }: { children: React.ReactNode; view?: StageView }) {
  return (
    <ImageStage image={IMAGE} view={view} onView={() => {}} style={{ width: IMAGE.width + 2, height: IMAGE.height + 2 }}>
      <div className="absolute inset-0 bg-canvas" />
      {children}
    </ImageStage>
  );
}

function Harness(props: Partial<AreaSetProps>) {
  const [selected, setSelected] = useState<Set<AreaId>>(() => new Set());
  return (
    <div>
      <Frame>
        <AreaSet
          items={ITEMS}
          {...props}
          selectedIds={selected}
          onHoverChange={hover}
          onItemPress={(id, event) => {
            press(id);
            setSelected((current) => {
              const toggle = event.metaKey || event.ctrlKey;
              return toggle ? new Set(current.has(id) ? [...current].filter((x) => x !== id) : [...current, id]) : new Set([id]);
            });
          }}
        />
      </Frame>
      <output data-testid="selected">{[...selected].map(String).sort().join(",") || "none"}</output>
    </div>
  );
}

const meta = {
  title: "stage2d/AreaSet",
  component: AreaSet,
  parameters: {
    docs: {
      description: {
        component: `Many closed regions over the image — marker quads, drawn polygons, region annotations, defect outlines —
drawn as a few batched paths (an outline with its 12 % fill, one path per state and role) and picked through a
spatial index rather than the DOM, so thousands of regions stay smooth and a hover costs microseconds.

- **Roles:** each item is painted in an overlay role: \`feature\` (detected, the default), \`model\` (predicted) or
  \`structure\` (context, such as a board outline). Colour is never the only channel: pass \`label\`s and
  \`firstVertexTick\`.
- **States:** default 1.5 px (1 for \`model\` and \`structure\`), hover 2 px, selected 2.5 px in the selection colour,
  and \`dimmed\` at 35 % opacity. \`hoveredId\` and \`selectedIds\` are controlled by the app; a hover the app does not
  control is tracked by the layer.
- **Labels:** an item's \`label\` is drawn (11 px mono on a halo) at the centre of its region, only where regions are at
  least 24 screen px apart, and at most 200 at a time. The hovered and selected regions always carry theirs.
- **Corner 0:** \`firstVertexTick\` draws a short line from the first vertex towards the centre, so the orientation of
  a marker quad reads.
- **Pointer:** a press within the pointer's tolerance (6 px, 12 for touch) of a region's outline picks that region;
  else the smallest region that contains it, so a quad inside a board is picked rather than the board.
  \`onHoverChange(id | null)\` and \`onItemPress(id, event)\` come from the stage's pointer handling and the layer's
  index. Setting \`onItemPress\` makes the layer claim presses inside its regions, so the stage does not pan from them;
  for an app with a drawing tool, ask \`useStageHitTest\` what is under a press instead.
- **Moving:** start \`useShapeDrag\` from an \`onItemPress\` on a selected region (see *Moving shapes*).

**Use** it for any set of regions a person inspects or picks from, with a list of the same items beside the stage.

**Don't** use it for a handful of regions the user edits vertex by vertex; that is \`ContourEditor\`. A rotated
rectangle or ellipse with handles is \`ShapeEditor\`.

**Accessibility**: the layer is a named image with a count ("Areas: 8 areas, 1 selected"). Picking is by pointer, so the
same selection must be possible from the list beside the stage, which is also where a screen reader finds it.`,
      },
    },
  },
  args: { items: ITEMS },
  render: () => <Harness />,
} satisfies Meta<typeof AreaSet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole("img", { name: "Areas: 8 areas, 0 selected" })).toBeInTheDocument();
    // Three roles are three batches (structure, feature, model): not one element per region.
    await expect(canvasElement.querySelectorAll("path[data-batch]")).toHaveLength(3);
    // The regions are far apart: all eight labels fit.
    await expect(canvasElement.querySelectorAll("[data-labels] text")).toHaveLength(8);
  },
};

export const FirstVertexTick: Story = {
  render: () => (
    <Frame>
      <AreaSet items={ITEMS.slice(1, 7)} firstVertexTick />
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    const ticks = canvasElement.querySelector("path[data-ticks='0|feature']")!;
    // One short segment per quad, from its vertex 0 towards its centre, in one path.
    await expect((ticks.getAttribute("d")!.match(/M/g) ?? []).length).toBe(6);
    // Quad 0 is unrotated by 0 rad: vertex 0 is its top-left corner at (50, 40), the tick runs inwards.
    const [x0, y0] = ticks.getAttribute("d")!.slice(1).split("L")[0]!.split(" ").map(Number) as [number, number];
    await expect([Math.round(x0), Math.round(y0)]).toEqual([50, 40]);
  },
};

export const Hover: Story = {
  play: async ({ canvasElement }) => {
    hover.mockClear();
    const stage = viewport(canvasElement);
    // Inside quad 0, which is also inside the board: the smaller region is picked.
    await fireEvent.pointerMove(stage, at(canvasElement, { x: 70, y: 60 }));
    await expect(hover).toHaveBeenLastCalledWith(0);
    await waitFor(() => expect(canvasElement.querySelector("svg[data-hovered='0']")).not.toBeNull());
    await expect(canvasElement.querySelector("[data-hovered-area]")).not.toBeNull();
    // Inside the board only.
    await fireEvent.pointerMove(stage, at(canvasElement, { x: 125, y: 110 }));
    await expect(hover).toHaveBeenLastCalledWith("board");
    // Bare image ends it.
    await fireEvent.pointerMove(stage, at(canvasElement, { x: 200, y: 217 }));
    await expect(hover).toHaveBeenLastCalledWith(null);
    await fireEvent.pointerMove(stage, at(canvasElement, { x: 70, y: 60 }));
    await fireEvent.pointerOut(stage, { relatedTarget: document.body });
    await expect(hover).toHaveBeenLastCalledWith(null);
  },
};

export const ClickToSelect: Story = {
  play: async ({ canvas, canvasElement }) => {
    press.mockClear();
    const stage = viewport(canvasElement);
    await fireEvent.pointerDown(stage, at(canvasElement, { x: 290, y: 160 }));
    await expect(press).toHaveBeenLastCalledWith(5);
    // A press a region claims is not a pan.
    await expect(stage).not.toHaveAttribute("data-panning");
    await waitFor(() => expect(canvas.getByTestId("selected")).toHaveTextContent("5"));
    await expect(canvasElement.querySelector("[data-selected-areas]")).not.toBeNull();
    await expect(canvas.getByRole("img", { name: "Areas: 8 areas, 1 selected" })).toBeInTheDocument();
    // An outline within the tolerance beats the interior around it: 4 px outside the model region's edge.
    await fireEvent.pointerDown(stage, at(canvasElement, { x: 200, y: 289 }, { metaKey: true }));
    await waitFor(() => expect(canvas.getByTestId("selected")).toHaveTextContent("5,roi"));
    // Bare image is not a region: the stage pans.
    press.mockClear();
    await fireEvent.pointerDown(stage, at(canvasElement, { x: 200, y: 300 - 1 }));
    await fireEvent.pointerUp(stage, at(canvasElement, { x: 200, y: 299 }));
    await fireEvent.pointerDown(stage, at(canvasElement, { x: 390, y: 100 }));
    await expect(press).not.toHaveBeenCalled();
    await expect(stage).toHaveAttribute("data-panning");
    await fireEvent.pointerUp(stage, at(canvasElement, { x: 390, y: 100 }));
  },
};

export const SelectedAndDimmed: Story = {
  render: () => (
    <Frame>
      <AreaSet items={ITEMS} selectedIds={[0, "roi"]} dimmed={(id) => typeof id === "number" && id >= 3} firstVertexTick />
    </Frame>
  ),
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole("img", { name: "Areas: 8 areas, 2 selected" })).toBeInTheDocument();
    await expect(canvasElement.querySelector("[data-selected-areas]")).not.toBeNull();
    await expect(canvasElement.querySelector("g[opacity='0.35'] path[data-batch='1|feature']")).not.toBeNull();
    // Selected regions' ticks are in the selection colour, in their own path.
    await expect(canvasElement.querySelector("path[data-ticks='selected']")).not.toBeNull();
  },
};

export const ControlledHover: Story = {
  render: () => (
    <Frame>
      <AreaSet items={ITEMS} hoveredId="roi" />
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("svg[data-hovered='roi']")).not.toBeNull();
    await expect(canvasElement.querySelector("[data-hovered-area]")).not.toBeNull();
  },
};

/** Six small squares 20 px apart: the labels thin out to those at least 24 px from the last kept. */
export const LabelsNeedRoom: Story = {
  render: () => (
    <Frame>
      <AreaSet
        items={Array.from({ length: 6 }, (_, n): AreaSetItem => ({ id: n, label: `L${n}`, points: quad(40 + 20 * n, 150, 6, 0) }))}
      />
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    const labels = [...canvasElement.querySelectorAll("[data-labels] text")].map((text) => text.textContent);
    // 20 px apart, 24 px wanted: every second region, 40 px apart.
    await expect(labels).toEqual(["L0", "L2", "L4"]);
  },
};

/** The selected region's label is forced on, whatever the spacing. */
export const SelectedLabelAlwaysShown: Story = {
  render: () => (
    <Frame>
      <AreaSet
        items={Array.from({ length: 6 }, (_, n): AreaSetItem => ({ id: n, label: `L${n}`, points: quad(40 + 20 * n, 150, 6, 0) }))}
        selectedIds={[1]}
        hoveredId={3}
      />
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    const labels = [...canvasElement.querySelectorAll("[data-labels] text")].map((text) => text.textContent);
    await expect(labels).toEqual(expect.arrayContaining(["L1", "L3"]));
  },
};

/** A region and a marker on top of it: the point layer outranks the area, so the marker takes the press. */
export const UnderPoints: Story = {
  render: () => <UnderPointsDemo />,
  play: async ({ canvas, canvasElement }) => {
    const stage = viewport(canvasElement);
    await fireEvent.pointerDown(stage, at(canvasElement, { x: 200, y: 150 }));
    await waitFor(() => expect(canvas.getByTestId("under")).toHaveTextContent("point:corner"));
    await fireEvent.pointerDown(stage, at(canvasElement, { x: 120, y: 150 }));
    await waitFor(() => expect(canvas.getByTestId("under")).toHaveTextContent("area:board"));
  },
};

function UnderPointsDemo() {
  const [last, setLast] = useState("nothing");
  return (
    <div>
      <Frame>
        <AreaSet items={[{ id: "board", points: [60, 60, 340, 60, 340, 240, 60, 240] }]} onItemPress={(id) => setLast(`area:${id}`)} />
        <PointSet items={[{ id: "corner", kind: "plus", x: 200, y: 150 }]} onItemPress={(id) => setLast(`point:${id}`)} />
      </Frame>
      <output data-testid="under">{last}</output>
    </div>
  );
}

const LARGE = Array.from({ length: 4000 }, (_, n): AreaSetItem => ({
  id: n,
  role: n % 2 === 0 ? "feature" : "model",
  points: quad((n * 7919) % 2000, (n * 104729) % 1500, 5 + (n % 7), (n % 10) / 10),
}));

/** Thousands of regions are a few elements. */
export const LargeSet: Story = {
  render: () => (
    <ImageStage image={{ width: 2000, height: 1500 }} view={{ scale: 0.2, tx: 0, ty: 0 }} onView={() => {}} style={{ width: 402, height: 302 }}>
      <div className="absolute inset-0 bg-canvas" />
      <AreaSet items={LARGE} />
    </ImageStage>
  ),
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole("img", { name: "Areas: 4000 areas, 0 selected" })).toBeInTheDocument();
    await expect(canvasElement.querySelectorAll("svg path").length).toBeLessThanOrEqual(8);
    const feature = canvasElement.querySelector("path[data-batch='0|feature']")!;
    await expect((feature.getAttribute("d")!.match(/Z/g) ?? []).length).toBe(2000);
  },
};

const pressedOnArea = fn();

/** With a drawing tool on, a press on bare image draws; a press on a region is declined, so the region takes it. */
function DrawOrSelectDemo() {
  const [drawn, setDrawn] = useState(0);
  return (
    <div>
      <Frame>
        <AreaSet items={ITEMS.slice(1, 7)} onItemPress={(id) => {
            pressedOnArea(id);
          }} />
        <Tool onDraw={() => setDrawn((n) => n + 1)} />
      </Frame>
      <output data-testid="drawn">{drawn}</output>
    </div>
  );
}

function Tool({ onDraw }: { onDraw: () => void }) {
  const { hitTest } = useStageHitTest();
  return (
    <StageSurface
      cursor="crosshair"
      onPress={({ point }) => {
        if (hitTest(point) !== null) return;
        return {
          onEnd: (_p, _event, moved) => {
            if (!moved) onDraw();
          },
        };
      }}
    />
  );
}

export const DrawOrSelect: Story = {
  render: () => <DrawOrSelectDemo />,
  play: async ({ canvas, canvasElement }) => {
    pressedOnArea.mockClear();
    const surface = canvasElement.querySelector("[data-stage-surface]")!;
    const bare = at(canvasElement, { x: 380, y: 280 });
    await fireEvent.pointerDown(surface, bare);
    await fireEvent.pointerUp(window, bare);
    await waitFor(() => expect(canvas.getByTestId("drawn")).toHaveTextContent("1"));
    await fireEvent.pointerDown(surface, at(canvasElement, { x: 70, y: 60 }));
    await expect(pressedOnArea).toHaveBeenLastCalledWith(0);
    await expect(canvas.getByTestId("drawn")).toHaveTextContent("1");
  },
};
