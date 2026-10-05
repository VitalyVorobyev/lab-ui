import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fireEvent, fn, waitFor } from "storybook/test";

import { AreaSet } from "./AreaSet";
import type { AreaId } from "./areaIndex";
import { ContourEditor } from "./ContourEditor";
import { ImageStage } from "./stage/ImageStage";
import type { StageView } from "./stage/view";
import type { Point } from "./measureGeometry";

function Example() {
  const [view, setView] = useState<StageView | null>(null);
  const [points, setPoints] = useState<Point[]>([{ x: 35, y: 32 }, { x: 165, y: 30 }, { x: 175, y: 125 }, { x: 28, y: 130 }]);
  return <div style={{ height: 440 }}><ImageStage image={{ width: 210, height: 160 }} view={view} onView={setView}><div className="absolute inset-0 bg-canvas" /><ContourEditor points={points} onChange={setPoints} editable /></ImageStage></div>;
}

function BorderExample() {
  const [points, setPoints] = useState<Point[]>([{ x: 40, y: 40 }, { x: 150, y: 40 }, { x: 150, y: 120 }]);
  return <div style={{ height: 440 }}><ImageStage image={{ width: 210, height: 160 }} view={{ scale: 2, tx: 0, ty: 0 }} onView={() => {}}><div className="absolute inset-0 bg-canvas" /><ContourEditor points={points} onChange={setPoints} editable bounds={{ x: -0.5, y: -0.5, width: 210, height: 160 }} /></ImageStage></div>;
}

/** 1:1 at the origin, so client coordinates are image coordinates plus the stage's corner. */
const IMAGE = { width: 400, height: 300 };
const SIZE = { width: IMAGE.width + 2, height: IMAGE.height + 2 };
const SQUARE: Point[] = [{ x: 80, y: 60 }, { x: 320, y: 60 }, { x: 320, y: 240 }, { x: 80, y: 240 }];

/** A pointer event over image point `p`, from the transformed stage itself. */
function at(within: Element, p: Point) {
  const stage = within.querySelector("[data-stage]")!.getBoundingClientRect();
  return { clientX: stage.left + p.x + 0.5, clientY: stage.top + p.y + 0.5, pointerId: 1, button: 0 };
}

const areaPress = fn();

/** A detected region whose edge runs along the contour's top side: a press there is the region's. */
function OverRegions() {
  const [points, setPoints] = useState<Point[]>(SQUARE);
  const [selected, setSelected] = useState<AreaId | null>(null);
  return (
    <div style={SIZE}>
      <ImageStage image={IMAGE} view={{ scale: 1, tx: 0, ty: 0 }} onView={() => {}} style={SIZE}>
        <div className="absolute inset-0 bg-canvas" />
        <AreaSet
          items={[{ id: "band", points: [100, 40, 300, 40, 300, 80, 100, 80] }]}
          selectedIds={selected === null ? [] : [selected]}
          onItemPress={(id) => {
            areaPress(id);
            setSelected(id);
          }}
        />
        <ContourEditor points={points} onChange={setPoints} editable />
      </ImageStage>
      <output data-testid="selected">{selected ?? "none"}</output>
      <output data-testid="count">{points.length}</output>
    </div>
  );
}

/** A view the story holds, so the double-click-to-fit shows. */
function DoubleClickExample() {
  const [view, setView] = useState<StageView | null>({ scale: 1, tx: 0, ty: 0 });
  const [points, setPoints] = useState<Point[]>(SQUARE);
  // A frame larger than the image, so 1:1 is not also fit.
  const frame = { width: 502, height: 402 };
  return (
    <div style={frame}>
      <ImageStage image={IMAGE} view={view} onView={setView} style={frame}>
        <div className="absolute inset-0 bg-canvas" />
        <ContourEditor points={points} onChange={setPoints} editable />
      </ImageStage>
      <output data-testid="points">{points.map((p) => `${p.x},${p.y}`).join(" ")}</output>
    </div>
  );
}

const meta = {
  title: "stage2d/ContourEditor",
  component: ContourEditor,
  parameters: {
    docs: {
      description: {
        component: `A closed contour drawn over an \`ImageStage\` in source-image coordinates, with editable vertices.

- **Vertices.** With \`editable\`, each vertex is a focusable handle: drag it (a press becomes a drag only after 3 screen
  pixels of travel, so a jittery click edits nothing), nudge it with the arrow keys (Shift for a tenth of a pixel),
  delete it with Delete or Backspace (a contour keeps at least three), or insert a vertex after it with Insert.
- **Outline.** The outline takes no presses: a press on it reaches the layers below, or pans the stage. While
  editable, the contour answers the stage's hit-test (\`STAGE_HIT_PRIORITY.line\` by default, segment indices as ids;
  set \`layerId\` and \`priority\` to place it), and a double-click near the outline inserts a vertex on the nearest
  segment instead of toggling fit.
- **Limits.** Every edit stays inside \`bounds\` (the pixel centres by default; the image area for polygons that may lie
  on its border).
- **Events.** \`onChange\` gets the whole new point list after each edit; \`onCommit\` marks the end of one, for history.

**Use** it to correct a contour a model or a measurement produced, or to outline a region by hand.

**Don't** use it for an axis-aligned box or a rotated shape (\`RectRoiEditor\`, \`ShapeEditor\`), or for picking among many
contours (\`PolylineSet\`).

**Accessibility**: read-only, the contour is an image named by \`label\`. Editable, each vertex is a button named
"\\<label\\> point N" that takes the keys above; double-click insertion has the Insert key as its keyboard equivalent.`,
      },
    },
  },
} satisfies Meta<typeof ContourEditor>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Editable: Story = { args: { points: [], onChange: () => {} }, render: () => <Example /> };

/** Polygons in the area convention may lie exactly on the image border: `bounds` is the whole image area. */
export const OnTheBorder: Story = {
  args: { points: [], onChange: () => {} },
  render: () => <BorderExample />,
  play: async ({ canvas }) => {
    const handle = canvas.getByRole("button", { name: "Contour point 1" });
    handle.focus();
    for (let i = 0; i < 41; i++) await fireEvent.keyDown(handle, { key: "ArrowLeft" });
    await waitFor(() => expect(canvas.getByRole("button", { name: "Contour point 1" }).getAttribute("cx")).toBe("-0.5"));
  },
};

/**
 * The outline takes no presses: one on the contour's top side reaches the region under it,
 * which selects it. With nothing below, the stage would pan.
 */
export const OutlinePassThrough: Story = {
  args: { points: [], onChange: () => {} },
  render: () => <OverRegions />,
  play: async ({ canvas, canvasElement }) => {
    areaPress.mockClear();
    // No transparent band over the outline.
    await expect(canvasElement.querySelector('polygon[stroke="transparent"]')).toBeNull();
    const viewport = canvas.getByRole("application");
    const onEdge = { x: 200, y: 60 };
    // Where the stylesheet is loaded, nothing of the editor is under a press on its outline.
    const { clientX, clientY } = at(canvasElement, onEdge);
    if (getComputedStyle(canvasElement.querySelector("polygon")!).pointerEvents === "none") {
      const under = document.elementFromPoint(clientX, clientY);
      await expect(under?.closest("svg")?.querySelector("[aria-label^='Contour point']") ?? null).toBeNull();
    }
    await fireEvent.pointerDown(viewport, at(canvasElement, onEdge));
    await fireEvent.pointerUp(viewport, at(canvasElement, onEdge));
    await expect(areaPress).toHaveBeenCalledWith("band");
    await waitFor(() => expect(canvas.getByTestId("selected")).toHaveTextContent("band"));
    await expect(canvas.getByTestId("count")).toHaveTextContent("4");
  },
};

/** A double-click near the outline inserts a vertex there; one away from it toggles fit as usual. */
export const DoubleClickInsert: Story = {
  args: { points: [], onChange: () => {} },
  render: () => <DoubleClickExample />,
  play: async ({ canvas, canvasElement }) => {
    const viewport = canvas.getByRole("application");
    await expect(viewport).not.toHaveAttribute("data-fit");
    // 3 px below the bottom side, so near it: a vertex after the third, where the pointer was
    // (a mouse event's position is whole pixels, so to within one).
    await fireEvent.doubleClick(viewport, at(canvasElement, { x: 200, y: 243 }));
    await waitFor(() => expect(canvas.getByRole("button", { name: "Contour point 5" })).toBeInTheDocument());
    const inserted = canvas.getByRole("button", { name: "Contour point 4" });
    await expect(Math.abs(Number(inserted.getAttribute("cx")) - 200)).toBeLessThanOrEqual(1);
    await expect(Math.abs(Number(inserted.getAttribute("cy")) - 243)).toBeLessThanOrEqual(1);
    await expect(viewport).not.toHaveAttribute("data-fit");
    const after = canvas.getByTestId("points").textContent;
    // In the middle, far from the outline: the stage's own double-click.
    await fireEvent.doubleClick(viewport, at(canvasElement, { x: 200, y: 150 }));
    await waitFor(() => expect(viewport).toHaveAttribute("data-fit"));
    await expect(canvas.getByTestId("points")).toHaveTextContent(after);
  },
};
