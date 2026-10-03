import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fireEvent, fn, waitFor } from "storybook/test";

import type { MarkerShape } from "./markerShapes";
import type { Point } from "./measureGeometry";
import { PointSet, type PointSetItem, type PointSetProps } from "./PointSet";
import type { PointId } from "./pointIndex";
import { PolylineSet } from "./PolylineSet";
import { ImageStage } from "./stage/ImageStage";
import { StageSurface } from "./stage/StageSurface";
import { useStageHitTest } from "./stage/useStageHitTest";
import type { StageView } from "./stage/view";

const IMAGE = { width: 400, height: 300 };
const VIEW: StageView = { scale: 1, tx: 0, ty: 0 };

/** A 4×3 board of detected corners (plus, labelled), one predicted point, a blob and a directed keypoint. */
const ITEMS: PointSetItem[] = [
  ...Array.from({ length: 12 }, (_, n): PointSetItem => ({
    id: n,
    kind: "plus",
    x: 80 + 80 * (n % 4),
    y: 70 + 70 * Math.floor(n / 4),
    label: String(n),
  })),
  { id: "predicted", kind: "hollow", x: 120, y: 105 },
  { id: "blob", kind: "dot", x: 340, y: 255 },
  { id: "keypoint", kind: "directed", angle: Math.PI / 4, x: 40, y: 260 },
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

function Harness(props: Partial<PointSetProps>) {
  const [selected, setSelected] = useState<Set<PointId>>(() => new Set());
  return (
    <div>
      <Frame>
        <PointSet
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
  title: "stage2d/PointSet",
  component: PointSet,
  parameters: {
    docs: {
      description: {
        component: `Many points over the image — detected corners, ring centres, keypoints, labelled landmarks —
drawn as a few batched paths and picked through a spatial index rather than the DOM, so thousands of points stay
smooth and a hover costs microseconds. A scene of 20,000 points is a dozen DOM nodes.

- **Markers** by kind, from the overlay grammar: \`dot\` (blob, r 2.5 px), \`plus\` (corner, 5 px arms), \`cross\`,
  \`square\`, \`hollow\` (predicted, r 4 px, in the model colour) and \`directed\` (a ring and an axis tick along
  \`angle\`). Pass \`markers\` to add a kind: a path generator, so a target-specific glyph is still one batched path.
  Sizes are screen pixels at every zoom.
- **States:** default 1.5 px, hover 2 px, selected 2.5 px in the selection colour **with a ring**, and \`dimmed\`
  at 35 % opacity. \`hoveredId\` and \`selectedIds\` are controlled by the app; a hover the app does not control is
  tracked by the layer.
- **Labels:** an item's \`label\` is drawn (11 px mono on a halo) only where points are at least 24 screen px apart,
  and at most 200 at a time. The hovered and selected items always carry theirs.
- **Pointer:** \`onHoverChange(id | null)\` and \`onItemPress(id, event)\` come from the stage's pointer handling and
  the layer's index, not from per-point elements. Setting \`onItemPress\` makes the layer claim presses on its
  points, so the stage does not pan from them. For an app with a drawing tool, ask \`useStageHitTest\` what is under
  a press instead (see *Draw or select*).

**Use** it for any set of points a person inspects or picks from, with a list of the same items beside the stage.

**Don't** use it for a handful of draggable handles; those are \`RectRoiEditor\` and \`ContourEditor\` territory.

**Accessibility**: the layer is a named image with a count ("Points: 15 points, 1 selected"). Picking is by pointer, so
the same selection must be possible from the list beside the stage, which is also where a screen reader finds it.`,
      },
    },
  },
  args: { items: ITEMS },
  render: () => <Harness />,
} satisfies Meta<typeof PointSet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole("img", { name: "Points: 15 points, 0 selected" })).toBeInTheDocument();
    // Four marker kinds are four batches (plus, hollow, dot, directed): not one element per point.
    await expect(canvasElement.querySelectorAll("path[data-batch]")).toHaveLength(4);
    // The corners are 80 px apart: all twelve labels fit.
    await expect(canvasElement.querySelectorAll("[data-labels] text")).toHaveLength(12);
  },
};

export const Hover: Story = {
  play: async ({ canvasElement }) => {
    hover.mockClear();
    const stage = viewport(canvasElement);
    await fireEvent.pointerMove(stage, at(canvasElement, { x: 163, y: 72 }));
    await expect(hover).toHaveBeenLastCalledWith(1);
    await waitFor(() => expect(canvasElement.querySelector("svg[data-hovered='1']")).not.toBeNull());
    await expect(canvasElement.querySelector("[data-hovered-point]")).not.toBeNull();
    // Moving to bare image ends it; React's onPointerLeave is driven by `pointerout`.
    await fireEvent.pointerMove(stage, at(canvasElement, { x: 200, y: 20 }));
    await expect(hover).toHaveBeenLastCalledWith(null);
    await fireEvent.pointerMove(stage, at(canvasElement, { x: 163, y: 72 }));
    await fireEvent.pointerOut(stage, { relatedTarget: document.body });
    await expect(hover).toHaveBeenLastCalledWith(null);
  },
};

export const ClickToSelect: Story = {
  play: async ({ canvas, canvasElement }) => {
    press.mockClear();
    const stage = viewport(canvasElement);
    await fireEvent.pointerDown(stage, at(canvasElement, { x: 240, y: 142 }));
    await expect(press).toHaveBeenLastCalledWith(6);
    // A press an item claims is not a pan.
    await expect(stage).not.toHaveAttribute("data-panning");
    await waitFor(() => expect(canvas.getByTestId("selected")).toHaveTextContent("6"));
    await expect(canvasElement.querySelector("[data-selected-points]")).not.toBeNull();
    await expect(canvasElement.querySelector("[data-selection-rings]")).not.toBeNull();
    await expect(canvas.getByRole("img", { name: "Points: 15 points, 1 selected" })).toBeInTheDocument();
    // ⌘/Ctrl-click adds to the selection (this story's rule); bare image is not an item.
    await fireEvent.pointerDown(stage, at(canvasElement, { x: 340, y: 255 }, { metaKey: true }));
    await waitFor(() => expect(canvas.getByTestId("selected")).toHaveTextContent("6,blob"));
    press.mockClear();
    await fireEvent.pointerDown(stage, at(canvasElement, { x: 200, y: 20 }));
    await expect(press).not.toHaveBeenCalled();
    await expect(stage).toHaveAttribute("data-panning");
    await fireEvent.pointerUp(stage, at(canvasElement, { x: 200, y: 20 }));
  },
};

export const SelectedAndDimmed: Story = {
  render: () => (
    <Frame>
      <PointSet items={ITEMS} selectedIds={[0, 5]} dimmed={(id) => typeof id === "number" && id >= 8} />
    </Frame>
  ),
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole("img", { name: "Points: 15 points, 2 selected" })).toBeInTheDocument();
    await expect(canvasElement.querySelector("[data-selected-points='plus']")).not.toBeNull();
    await expect(canvasElement.querySelector("[data-selection-rings='ring|plus']")).not.toBeNull();
    await expect(canvasElement.querySelector("path[opacity='0.35']")).not.toBeNull();
  },
};

export const ControlledHover: Story = {
  render: () => (
    <Frame>
      <PointSet items={ITEMS} hoveredId="predicted" />
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("svg[data-hovered='predicted']")).not.toBeNull();
    await expect(canvasElement.querySelector("[data-hovered-point]")).not.toBeNull();
  },
};

/** Ten points 14 px apart: the labels thin out to those at least 24 px from the last kept. */
export const LabelsNeedRoom: Story = {
  render: () => (
    <Frame>
      <PointSet
        items={Array.from({ length: 10 }, (_, n): PointSetItem => ({ id: n, x: 40 + 14 * n, y: 150, label: `L${n}` }))}
      />
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    const labels = [...canvasElement.querySelectorAll("[data-labels] text")].map((text) => text.textContent);
    // 14 px apart, 24 px wanted: every second point, 28 px apart.
    await expect(labels).toEqual(["L0", "L2", "L4", "L6", "L8"]);
  },
};

const DIAMOND: MarkerShape = {
  paint: "line",
  size: 5,
  path: (x, y, u) => `M${x - 5 * u} ${y}L${x} ${y - 5 * u}L${x + 5 * u} ${y}L${x} ${y + 5 * u}Z`,
};

/** A target-specific glyph is a path generator, so it is still one batched path. */
export const CustomMarker: Story = {
  render: () => (
    <Frame>
      <PointSet
        items={[
          { id: 1, kind: "diamond", x: 100, y: 100 },
          { id: 2, kind: "diamond", x: 200, y: 100 },
          { id: 3, kind: "plus", x: 300, y: 100 },
        ]}
        markers={{ diamond: DIAMOND }}
      />
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll("path[data-batch]")).toHaveLength(2);
    const diamonds = canvasElement.querySelector("path[data-batch$='diamond']")!;
    await expect(diamonds.getAttribute("d")).toBe("M95 100L100 95L105 100L100 105ZM195 100L200 95L205 100L200 105Z");
  },
};

const LARGE = Array.from({ length: 6000 }, (_, n): PointSetItem => ({
  id: n,
  kind: n % 2 === 0 ? "plus" : "dot",
  x: (n * 7919) % 2000,
  y: (n * 104729) % 1500,
}));

/** Thousands of points are a few elements; outlines are generated for the part near the viewport. */
export const LargeSet: Story = {
  render: () => (
    <ImageStage
      image={{ width: 2000, height: 1500 }}
      view={{ scale: 1, tx: -700, ty: -500 }}
      onView={() => {}}
      style={{ width: 402, height: 302 }}
    >
      <div className="absolute inset-0 bg-canvas" />
      <PointSet items={LARGE} />
    </ImageStage>
  ),
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole("img", { name: "Points: 6000 points, 0 selected" })).toBeInTheDocument();
    await expect(canvasElement.querySelectorAll("svg path").length).toBeLessThanOrEqual(8);
    const plus = canvasElement.querySelector("path[data-batch='0|feature|plus']")!;
    // 3000 plus markers are two sub-paths each when all are drawn; the window holds a fraction.
    const drawn = (plus.getAttribute("d")!.match(/M/g) ?? []).length / 2;
    await expect(drawn).toBeGreaterThan(0);
    await expect(drawn).toBeLessThan(1500);
    // The disc markers are never culled: they are one cheap stroke, unchanged by the zoom.
    const dots = canvasElement.querySelector("path[data-batch='0|feature|dot']")!;
    await expect((dots.getAttribute("d")!.match(/M/g) ?? []).length).toBe(3000);
  },
};

const pressedOnLine = fn();
const pressedOnPoint = fn();

/**
 * One hit-test across layers. With a drawing tool on, a press on bare image draws; a press on
 * a point or a line is declined, so the topmost item takes it: the point wins where both lie
 * under the pointer. The tool asks `useStageHitTest`, never the DOM.
 */
function DrawOrSelectDemo() {
  const [drawn, setDrawn] = useState<PointSetItem[]>([]);
  const [selected, setSelected] = useState<PointId | null>(null);
  const items = [...ITEMS.slice(0, 8), ...drawn];
  return (
    <div>
      <Frame>
        <PolylineSet
          items={[{ id: "edge", points: [80, 70, 240, 70] }]}
          onItemPress={(id) => {
            pressedOnLine(id);
          }}
        />
        <PointSet
          items={items}
          selectedIds={selected === null ? [] : [selected]}
          onItemPress={(id) => {
            pressedOnPoint(id);
            setSelected(id);
          }}
        />
        <Tool onDraw={(point) => setDrawn((all) => [...all, { id: `new-${all.length}`, kind: "cross", ...point }])} />
      </Frame>
      <output data-testid="drawn">{drawn.length}</output>
    </div>
  );
}

function Tool({ onDraw }: { onDraw: (point: { x: number; y: number }) => void }) {
  const { hitTest } = useStageHitTest();
  return (
    <StageSurface
      cursor="crosshair"
      onPress={({ point }) => {
        if (hitTest(point) !== null) return; // an item is under it: decline, and the item takes the press
        return {
          onEnd: (p: Point, _event: PointerEvent, moved: boolean) => {
            if (!moved) onDraw(p);
          },
        };
      }}
    />
  );
}

export const DrawOrSelect: Story = {
  render: () => <DrawOrSelectDemo />,
  play: async ({ canvas, canvasElement }) => {
    pressedOnLine.mockClear();
    pressedOnPoint.mockClear();
    const stage = viewport(canvasElement);
    // Bare image: the tool draws.
    const bare = at(canvasElement, { x: 300, y: 200 });
    await fireEvent.pointerDown(canvasElement.querySelector("[data-stage-surface]")!, bare);
    await fireEvent.pointerUp(window, bare);
    await waitFor(() => expect(canvas.getByTestId("drawn")).toHaveTextContent("1"));
    // A point not on the line: the tool declines, the point takes the press.
    const onPoint = at(canvasElement, { x: 240, y: 142 });
    await fireEvent.pointerDown(canvasElement.querySelector("[data-stage-surface]")!, onPoint);
    await expect(pressedOnPoint).toHaveBeenLastCalledWith(6);
    await expect(canvas.getByTestId("drawn")).toHaveTextContent("1");
    // The line alone: the line takes it.
    await fireEvent.pointerDown(canvasElement.querySelector("[data-hit]")!, at(canvasElement, { x: 120, y: 70 }));
    await expect(pressedOnLine).toHaveBeenLastCalledWith("edge");
    // A point on the line: the point is above it.
    pressedOnLine.mockClear();
    await fireEvent.pointerDown(canvasElement.querySelector("[data-hit]")!, at(canvasElement, { x: 160, y: 70 }));
    await expect(pressedOnLine).not.toHaveBeenCalled();
    await expect(pressedOnPoint).toHaveBeenLastCalledWith(1);
    await expect(stage).not.toHaveAttribute("data-panning");
  },
};
