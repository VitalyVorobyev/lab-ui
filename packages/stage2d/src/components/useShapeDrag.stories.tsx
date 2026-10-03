import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fireEvent, fn, waitFor } from "storybook/test";

import { AreaSet } from "./AreaSet";
import type { Point } from "./measureGeometry";
import { PointSet } from "./PointSet";
import { PolylineSet } from "./PolylineSet";
import { ImageStage } from "./stage/ImageStage";
import type { StagePointerEvent } from "./stage/hitContext";
import type { StageView } from "./stage/view";
import { translatePoints, useShapeDrag } from "./useShapeDrag";

const IMAGE = { width: 400, height: 300 };
const VIEW: StageView = { scale: 1, tx: 0, ty: 0 };

interface Shape {
  id: string;
  kind: "area" | "line" | "point";
  /** Flat image coordinates: a ring, a polyline, or one point. */
  points: number[];
}

const SHAPES: Shape[] = [
  { id: "region", kind: "area", points: [60, 60, 160, 60, 160, 130, 60, 130] },
  { id: "contour", kind: "line", points: [220, 80, 280, 150, 350, 100] },
  { id: "landmark", kind: "point", points: [120, 220] },
];

const ended = fn();

/** Client position of image point `p` (the view is 1:1 at the origin) on the stage the story renders. */
function at(root: Element, p: Point, extra: Record<string, unknown> = {}) {
  const stage = root.querySelector("[data-stage]")!.getBoundingClientRect();
  return { clientX: stage.left + p.x + 0.5, clientY: stage.top + p.y + 0.5, pointerId: 1, button: 0, ...extra };
}

/**
 * Select, drag, commit. Pressing an item selects it and starts a move; the item is drawn shifted by the
 * displacement while the pointer is down (the preview) and the app's geometry changes once, at the release.
 */
function Scene({ slop }: { slop?: number }) {
  const startMove = useShapeDrag();
  const [shapes, setShapes] = useState(SHAPES);
  const [selected, setSelected] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; delta: Point } | null>(null);

  const shifted = (shape: Shape): number[] => (drag?.id === shape.id ? translatePoints(shape.points, drag.delta) : shape.points);
  const press = (id: string, event: StagePointerEvent) => {
    setSelected(id);
    startMove(
      event,
      {
        onMove: (delta) => setDrag({ id, delta }),
        onEnd: (delta, moved) => {
          setDrag(null);
          ended(id, moved);
          if (moved) setShapes((all) => all.map((shape) => (shape.id === id ? { ...shape, points: translatePoints(shape.points, delta) } : shape)));
        },
        onCancel: () => setDrag(null),
      },
      slop === undefined ? undefined : { slop },
    );
  };
  const of = (kind: Shape["kind"]) => shapes.filter((shape) => shape.kind === kind);
  const selection = selected === null ? [] : [selected];

  return (
    <>
      <AreaSet items={of("area").map((shape) => ({ id: shape.id, points: shifted(shape) }))} selectedIds={selection} onItemPress={(id, event) => press(String(id), event)} />
      <PolylineSet items={of("line").map((shape) => ({ id: shape.id, points: shifted(shape) }))} selected={selection} onItemPress={(id, event) => press(String(id), event)} />
      <PointSet items={of("point").map((shape) => ({ id: shape.id, kind: "plus", x: shifted(shape)[0]!, y: shifted(shape)[1]! }))} selectedIds={selection} onItemPress={(id, event) => press(String(id), event)} />
      <output data-testid="geometry" className="absolute bottom-0 left-0 text-xs text-ink">
        {shapes.map((shape) => `${shape.id}:${shape.points.join(" ")}`).join(" | ")}
      </output>
    </>
  );
}

function Frame({ slop }: { slop?: number }) {
  return (
    <ImageStage image={IMAGE} view={VIEW} onView={() => {}} style={{ width: IMAGE.width + 2, height: IMAGE.height + 2 }}>
      <div className="absolute inset-0 bg-canvas" />
      <Scene {...(slop === undefined ? {} : { slop })} />
    </ImageStage>
  );
}

const meta = {
  title: "stage2d/Moving shapes",
  component: Frame,
  parameters: {
    docs: {
      description: {
        component: `\`useShapeDrag\` turns a press on an item into displacements in image pixels, with the click slop every selection UI needs: a
press that barely moves is a click, not a drag. It is the move half of select → drag → commit for manual shapes: points,
lines, polylines and polygons.

\`\`\`tsx
const startMove = useShapeDrag();
<AreaSet onItemPress={(id, event) =>
  startMove(event, {
    onMove: (delta) => setDrag({ id, delta }),          // preview: draw the shape shifted by delta
    onEnd: (delta, moved) => { setDrag(null); if (moved) commit(id, delta); },
    onCancel: () => setDrag(null),
  })} />
\`\`\`

- \`onMove\` runs once the pointer has left the slop (3 screen px; \`{ slop }\` changes it) with the total displacement from the press;
  \`onEnd(delta, moved)\` at the release. When \`moved\` is false the press was a click and \`delta\` is zero: select, do not move.
- \`translatePoints(points, delta)\` shifts flat coordinates, for the preview and for the commit.
- The press is claimed (the stage does not pan) and followed on \`window\`, so the drag survives leaving the canvas. A touch tap reaches
  \`onItemPress\` on release, so it is a click; move on touch with the handles of \`ShapeEditor\` or a mode of the app's own.
- The app keeps the geometry: the preview is state, the commit changes the model once. With thousands of items, draw the moving item in a
  layer of its own so the rest of the scene is not re-indexed on every move.

**Use** it for any layer that exposes \`onItemPress\`.

**Don't** use it for editing a shape's size or vertices: that is \`ShapeEditor\`, \`RectRoiEditor\` and \`ContourEditor\`.`,
      },
    },
  },
  render: () => <Frame />,
} satisfies Meta<typeof Frame>;

export default meta;
type Story = StoryObj<typeof meta>;

const geometry = (root: Element) => root.querySelector("[data-testid=geometry]")!.textContent;

export const SelectDragCommit: Story = {
  play: async ({ canvasElement }) => {
    ended.mockClear();
    const stage = canvasElement.querySelector("[role=application]")!;
    // Press inside the polygon, drag to (20, 15) away, then (40, 30), release.
    await fireEvent.pointerDown(stage, at(canvasElement, { x: 110, y: 100 }));
    await waitFor(() => expect(canvasElement.querySelector("[data-selected-areas]")).not.toBeNull());
    await fireEvent.pointerMove(window, at(canvasElement, { x: 130, y: 115 }));
    // The preview: the polygon is drawn shifted, the app's geometry has not changed.
    await waitFor(() => expect(canvasElement.querySelector("[data-selected-areas]")!.getAttribute("d")).toBe("M80 75L180 75L180 145L80 145Z"));
    await expect(geometry(canvasElement)).toContain("region:60 60 160 60 160 130 60 130");
    await fireEvent.pointerMove(window, at(canvasElement, { x: 150, y: 130 }));
    await fireEvent.pointerUp(window, at(canvasElement, { x: 150, y: 130 }));
    await waitFor(() => expect(geometry(canvasElement)).toContain("region:100 90 200 90 200 160 100 160"));
    await expect(ended).toHaveBeenLastCalledWith("region", true);
    await expect(stage).not.toHaveAttribute("data-panning");
  },
};

export const ClickSelectsWithoutMoving: Story = {
  play: async ({ canvasElement }) => {
    ended.mockClear();
    const stage = canvasElement.querySelector("[role=application]")!;
    await fireEvent.pointerDown(stage, at(canvasElement, { x: 120, y: 220 }));
    // Within the 3 px slop: a click.
    await fireEvent.pointerMove(window, at(canvasElement, { x: 121, y: 221 }));
    await fireEvent.pointerUp(window, at(canvasElement, { x: 121, y: 221 }));
    await waitFor(() => expect(ended).toHaveBeenLastCalledWith("landmark", false));
    await expect(geometry(canvasElement)).toContain("landmark:120 220");
    await expect(canvasElement.querySelector("[data-selected-points]")).not.toBeNull();
  },
};

export const MovePointAndPolyline: Story = {
  play: async ({ canvasElement }) => {
    const stage = canvasElement.querySelector("[role=application]")!;
    await fireEvent.pointerDown(stage, at(canvasElement, { x: 120, y: 220 }));
    await fireEvent.pointerMove(window, at(canvasElement, { x: 160, y: 200 }));
    await fireEvent.pointerUp(window, at(canvasElement, { x: 160, y: 200 }));
    await waitFor(() => expect(geometry(canvasElement)).toContain("landmark:160 200"));
    // The contour is a polyline: press on its middle vertex.
    await fireEvent.pointerDown(canvasElement.querySelector("[data-hit]")!, at(canvasElement, { x: 280, y: 150 }));
    await fireEvent.pointerMove(window, at(canvasElement, { x: 270, y: 170 }));
    await fireEvent.pointerUp(window, at(canvasElement, { x: 270, y: 170 }));
    await waitFor(() => expect(geometry(canvasElement)).toContain("contour:210 100 270 170 340 120"));
  },
};

/** A drag interrupted by the browser (`pointercancel`) drops the preview and changes nothing. */
export const CancelledDrag: Story = {
  play: async ({ canvasElement }) => {
    const stage = canvasElement.querySelector("[role=application]")!;
    await fireEvent.pointerDown(stage, at(canvasElement, { x: 110, y: 100 }));
    await fireEvent.pointerMove(window, at(canvasElement, { x: 150, y: 130 }));
    await waitFor(() => expect(canvasElement.querySelector("[data-selected-areas]")!.getAttribute("d")).not.toBe("M60 60L160 60L160 130L60 130Z"));
    await fireEvent.pointerCancel(window, at(canvasElement, { x: 150, y: 130 }));
    await waitFor(() => expect(canvasElement.querySelector("[data-selected-areas]")!.getAttribute("d")).toBe("M60 60L160 60L160 130L60 130Z"));
    await expect(geometry(canvasElement)).toContain("region:60 60 160 60 160 130 60 130");
  },
};

/** A wider slop: the same 6 px stroke is still a click. */
export const WiderSlop: Story = {
  render: () => <Frame slop={8} />,
  play: async ({ canvasElement }) => {
    ended.mockClear();
    const stage = canvasElement.querySelector("[role=application]")!;
    await fireEvent.pointerDown(stage, at(canvasElement, { x: 110, y: 100 }));
    await fireEvent.pointerMove(window, at(canvasElement, { x: 116, y: 100 }));
    await fireEvent.pointerUp(window, at(canvasElement, { x: 116, y: 100 }));
    await waitFor(() => expect(ended).toHaveBeenLastCalledWith("region", false));
  },
};

/** A touch tap arrives as the release and ends at once as a click. */
export const TouchTapIsAClick: Story = {
  play: async ({ canvasElement }) => {
    ended.mockClear();
    const stage = canvasElement.querySelector("[role=application]")!;
    await fireEvent.pointerDown(stage, at(canvasElement, { x: 110, y: 100 }, { pointerType: "touch", pointerId: 7 }));
    await fireEvent.pointerUp(stage, at(canvasElement, { x: 110, y: 100 }, { pointerType: "touch", pointerId: 7, timeStamp: 1 }));
    await waitFor(() => expect(ended).toHaveBeenLastCalledWith("region", false));
    await waitFor(() => expect(canvasElement.querySelector("[data-selected-areas]")).not.toBeNull());
  },
};
