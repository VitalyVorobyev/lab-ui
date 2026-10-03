import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fireEvent, waitFor } from "storybook/test";

import { areasInRect, buildAreaIndex } from "./areaIndex";
import { AreaSet, type AreaSetItem } from "./AreaSet";
import { DraftShape, MarqueeRect, type DraftShapeSpec } from "./DraftShape";
import type { Point } from "./measureGeometry";
import { PointSet, type PointSetItem } from "./PointSet";
import { buildPointIndexFrom, pointsInRect, type PointId } from "./pointIndex";
import { rectFromCorners } from "./roiEdit";
import { ImageStage } from "./stage/ImageStage";
import { StageSurface } from "./stage/StageSurface";
import { useStageHitTest } from "./stage/useStageHitTest";
import type { Rect, StageView } from "./stage/view";

const IMAGE = { width: 400, height: 300 };
const VIEW: StageView = { scale: 1, tx: 0, ty: 0 };

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <ImageStage image={IMAGE} view={VIEW} onView={() => {}} style={{ width: IMAGE.width + 2, height: IMAGE.height + 2 }}>
      <div className="absolute inset-0 bg-canvas" />
      {children}
    </ImageStage>
  );
}

/** Client position of image point `p` (the view is 1:1 at the origin) on the stage the story renders. */
function at(root: Element, p: Point, extra: Record<string, unknown> = {}) {
  const stage = root.querySelector("[data-stage]")!.getBoundingClientRect();
  return { clientX: stage.left + p.x + 0.5, clientY: stage.top + p.y + 0.5, pointerId: 1, button: 0, ...extra };
}

const meta = {
  title: "stage2d/DraftShape",
  component: DraftShape,
  parameters: {
    docs: {
      description: {
        component: `What an annotation tool shows while a shape is being drawn.

\`DraftShape\` previews the shape so far, dashed (6 4 screen px, 1.5 px wide) in the accent role with a halo:

- \`point\`: a dashed ring with a dot.
- \`line\`: the segment from \`from\` to \`to\`.
- \`polyline\` and \`polygon\`: the vertices placed so far (\`points\`, flat) as dots, and a segment on to the pointer (\`cursor\`).
  A polygon also shows, fainter, the segment that would close it, and takes the 12 % fill once it has three corners.
- \`rect\` and \`ellipse\`: two opposite corners (the drag's start and the pointer), with the 12 % fill.

\`MarqueeRect\` is the rubber band of a multi-select: the 12 % fill and a 1 px outline in the selection colour.

Neither takes input. The tool keeps the state (a \`StageSurface\` press that starts a draft, \`onHover\` that moves the cursor) and
renders these from it; see *DrawPolygon* and *MarqueeSelect* for the whole pattern. For the selection itself, \`pointsInRect\`,
\`polylinesInRect\` and \`areasInRect\` answer "what did the band catch".

**Use** them for in-progress geometry and the rubber band.

**Don't** use them for the finished shape: that is a layer (\`PointSet\`, \`PolylineSet\`, \`AreaSet\`) or \`ShapeEditor\`.

**Accessibility**: the previews are hidden from assistive technology; they are feedback for a pointer gesture. The finished shape is
what a screen reader meets.`,
      },
    },
  },
  args: { shape: null },
  render: (args) => (
    <Frame>
      <DraftShape {...args} />
    </Frame>
  ),
} satisfies Meta<typeof DraftShape>;

export default meta;
type Story = StoryObj<typeof meta>;

const shown = (spec: DraftShapeSpec): Story => ({
  args: { shape: spec },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector(`svg[data-draft=${spec.kind}]`)).not.toBeNull();
    await expect(canvasElement.querySelector("path[data-draft-outline]")).not.toBeNull();
    // Dashed on screen: the dash is in screen pixels, so 6 4 at 1x.
    await expect(canvasElement.querySelector("path[data-draft-outline]")!.getAttribute("stroke-dasharray")).toBe("6 4");
  },
});

export const Nothing: Story = {
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("path")).toBeNull();
    await expect(canvasElement.querySelector("svg[data-draft]")).toBeNull();
  },
};

export const PointDraft: Story = shown({ kind: "point", x: 200, y: 150 });
export const LineDraft: Story = shown({ kind: "line", from: { x: 60, y: 200 }, to: { x: 300, y: 80 } });
export const RectangleDraft: Story = shown({ kind: "rect", from: { x: 300, y: 220 }, to: { x: 120, y: 90 } });
export const EllipseDraft: Story = shown({ kind: "ellipse", from: { x: 100, y: 80 }, to: { x: 300, y: 220 } });

export const PolylineDraft: Story = {
  ...shown({ kind: "polyline", points: [60, 220, 140, 100, 230, 190], cursor: { x: 330, y: 90 } }),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("path[data-draft-outline]")!.getAttribute("d")).toBe("M60 220L140 100L230 190L330 90");
    // Three placed vertices, as zero-length segments.
    await expect((canvasElement.querySelector("path[data-draft-vertices]")!.getAttribute("d")!.match(/M/g) ?? []).length).toBe(3);
    // A polyline is not a region, and nothing closes it.
    await expect(canvasElement.querySelector("path[data-draft-closing]")).toBeNull();
    await expect(canvasElement.querySelector("path[fill-opacity]")).toBeNull();
  },
};

export const PolygonDraft: Story = {
  ...shown({ kind: "polygon", points: [80, 220, 120, 100, 230, 190], cursor: { x: 300, y: 80 } }),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("path[data-draft-closing]")!.getAttribute("d")).toBe("M300 80L80 220");
    await expect(canvasElement.querySelector("path[fill-opacity='0.12']")).not.toBeNull();
  },
};

/** One vertex placed and the pointer moving: a segment, no fill yet. */
export const PolygonJustStarted: Story = {
  ...shown({ kind: "polygon", points: [80, 220], cursor: { x: 200, y: 120 } }),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("path[fill-opacity]")).toBeNull();
    await expect(canvasElement.querySelector("path[data-draft-outline]")!.getAttribute("d")).toBe("M80 220L200 120");
  },
};

/** A draft with no vertices yet draws nothing (and does not throw). */
export const PolylineNoVertices: Story = {
  args: { shape: { kind: "polyline", points: [], cursor: { x: 10, y: 10 } } },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("path")).toBeNull();
  },
};

export const ModelRole: Story = {
  args: { shape: { kind: "rect", from: { x: 100, y: 80 }, to: { x: 260, y: 200 } }, role: "model" },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("path[data-draft-outline]")!.getAttribute("stroke")).toBe("var(--stage-model)");
  },
};

/** A polygon tool: a click places a vertex, the pointer moves the cursor, Enter-equivalent (a click near the first vertex) closes. */
function DrawPolygonDemo() {
  const [points, setPoints] = useState<number[]>([]);
  const [cursor, setCursor] = useState<Point | undefined>(undefined);
  const [done, setDone] = useState<number[][]>([]);
  return (
    <div>
      <Frame>
        <AreaSet items={done.map((ring, id): AreaSetItem => ({ id, points: ring }))} label="Drawn" />
        <StageSurface
          cursor="crosshair"
          onHover={setCursor}
          onPress={({ point }) => ({
            onEnd: (_p, _e, moved) => {
              if (moved) return;
              const closes = points.length >= 6 && Math.hypot(point.x - points[0]!, point.y - points[1]!) < 8;
              if (closes) {
                setDone((all) => [...all, points]);
                setPoints([]);
              } else setPoints((all) => [...all, point.x, point.y]);
            },
          })}
        />
        <DraftShape shape={points.length > 0 ? { kind: "polygon", points, cursor } : null} />
      </Frame>
      <output data-testid="drawn">{`${points.length / 2} placed, ${done.length} drawn`}</output>
    </div>
  );
}

export const DrawPolygon: Story = {
  render: () => <DrawPolygonDemo />,
  play: async ({ canvas, canvasElement }) => {
    const surface = canvasElement.querySelector("[data-stage-surface]")!;
    for (const p of [{ x: 100, y: 200 }, { x: 160, y: 80 }, { x: 260, y: 140 }]) {
      await fireEvent.pointerDown(surface, at(canvasElement, p));
      await fireEvent.pointerUp(window, at(canvasElement, p));
    }
    await waitFor(() => expect(canvas.getByTestId("drawn")).toHaveTextContent("3 placed, 0 drawn"));
    await fireEvent.pointerMove(surface, at(canvasElement, { x: 300, y: 220 }));
    await waitFor(() => expect(canvasElement.querySelector("path[data-draft-outline]")!.getAttribute("d")).toBe("M100 200L160 80L260 140L300 220"));
    // A click back on the first vertex closes the polygon: the draft ends and the region is a layer.
    await fireEvent.pointerDown(surface, at(canvasElement, { x: 102, y: 201 }));
    await fireEvent.pointerUp(window, at(canvasElement, { x: 102, y: 201 }));
    await waitFor(() => expect(canvas.getByTestId("drawn")).toHaveTextContent("0 placed, 1 drawn"));
    await expect(canvas.getByRole("img", { name: "Drawn: 1 area, 0 selected" })).toBeInTheDocument();
    await expect(canvasElement.querySelector("svg[data-draft]")).toBeNull();
  },
};

const MARQUEE_POINTS: PointSetItem[] = Array.from({ length: 12 }, (_, n) => ({
  id: `p${n}`,
  kind: "plus",
  x: 40 + 40 * (n % 6),
  y: 50 + 50 * Math.floor(n / 6),
}));
const MARQUEE_AREAS: AreaSetItem[] = [
  { id: "a", points: [60, 200, 140, 200, 140, 260, 60, 260] },
  { id: "b", points: [220, 190, 340, 190, 340, 270, 220, 270] },
];

/**
 * Rubber-band selection across layers. The tool declines a press on an item that claims presses
 * (the layer takes it) and otherwise sweeps: the band is a `MarqueeRect`, and at the release each layer's pure
 * query (`pointsInRect`, `areasInRect`) says what it caught.
 */
function MarqueeSelectDemo() {
  const [band, setBand] = useState<Rect | null>(null);
  const [picked, setPicked] = useState<{ points: PointId[]; areas: PointId[] }>({ points: [], areas: [] });
  return (
    <div>
      <Frame>
        <AreaSet items={MARQUEE_AREAS} selectedIds={picked.areas} />
        <PointSet items={MARQUEE_POINTS} selectedIds={picked.points} />
        <MarqueeTool onBand={setBand} onPick={setPicked} />
        <MarqueeRect rect={band} />
      </Frame>
      <output data-testid="picked">{`${picked.points.join(",") || "no points"} | ${picked.areas.join(",") || "no areas"}`}</output>
    </div>
  );
}

function MarqueeTool({ onBand, onPick }: { onBand: (rect: Rect | null) => void; onPick: (picked: { points: PointId[]; areas: PointId[] }) => void }) {
  const { hitTest } = useStageHitTest();
  return (
    <StageSurface
      cursor="crosshair"
      onPress={({ point }) => {
        if (hitTest(point, undefined, { pressable: true }) !== null) return; // an item is under it: decline, and the layer takes the press
        return {
          onMove: (p) => onBand(rectFromCorners(point, p)),
          onEnd: (p) => {
            const rect = rectFromCorners(point, p);
            onBand(null);
            onPick({
              points: pointsInRect(buildPointIndexFrom(MARQUEE_POINTS), rect).map((i) => MARQUEE_POINTS[i]!.id),
              areas: areasInRect(buildAreaIndex(MARQUEE_AREAS), rect),
            });
          },
          onCancel: () => onBand(null),
        };
      }}
    />
  );
}

export const MarqueeSelect: Story = {
  render: () => <MarqueeSelectDemo />,
  play: async ({ canvas, canvasElement }) => {
    const surface = canvasElement.querySelector("[data-stage-surface]")!;
    await fireEvent.pointerDown(surface, at(canvasElement, { x: 20, y: 30 }));
    await fireEvent.pointerMove(window, at(canvasElement, { x: 140, y: 120 }));
    await waitFor(() => expect(canvasElement.querySelector("svg[data-marquee]")).not.toBeNull());
    await expect(canvasElement.querySelector("svg[data-marquee] rect")).not.toBeNull();
    await fireEvent.pointerUp(window, at(canvasElement, { x: 140, y: 120 }));
    // The band (20,30)-(140,120) holds the corners at x = 40, 80, 120 in both rows (y = 50, 100).
    await waitFor(() => expect(canvas.getByTestId("picked")).toHaveTextContent("p0,p1,p2,p6,p7,p8 | no areas"));
    await expect(canvasElement.querySelector("svg[data-marquee]")).toBeNull();
    // A band that clips a region's corner catches the region.
    await fireEvent.pointerDown(surface, at(canvasElement, { x: 100, y: 240 }));
    await fireEvent.pointerMove(window, at(canvasElement, { x: 260, y: 285 }));
    await fireEvent.pointerUp(window, at(canvasElement, { x: 260, y: 285 }));
    await waitFor(() => expect(canvas.getByTestId("picked")).toHaveTextContent("no points | a,b"));
  },
};
