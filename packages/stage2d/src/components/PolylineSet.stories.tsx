import type { Meta, StoryObj } from "@storybook/react-vite";
import { useRef, useState } from "react";
import { expect, fireEvent, fn, waitFor } from "storybook/test";

import {
  PolylineSet,
  type PolylineSelectMode,
  type PolylineSetHandle,
  type PolylineSetItem,
  type PolylineSetProps,
} from "./PolylineSet";
import type { PolylineId } from "./polylineIndex";
import { RectRoiEditor } from "./RectRoiEditor";
import { ImageStage } from "./stage/ImageStage";
import { StageSurface } from "./stage/StageSurface";
import { useStageHitTest } from "./stage/useStageHitTest";
import type { Rect, StageView } from "./stage/view";

const IMAGE = { width: 400, height: 300 };
const VIEW: StageView = { scale: 1, tx: 0, ty: 0 };

/** Contour candidates, as a teach preview returns them; one is dropped, one is open. */
const ITEMS: PolylineSetItem[] = [
  { id: 1, points: [60, 60, 160, 60, 160, 140, 60, 140], closed: true },
  { id: 2, points: [220, 80, 340, 80, 340, 200, 220, 200], closed: true },
  { id: 3, points: [40, 220, 120, 250, 200, 230, 280, 260], dashed: true, stroke: "var(--fg-subtle)" },
  { id: 4, points: [300, 40, 380, 120] },
];

const select = fn();
const hover = fn();
const hoverChange = fn();
const itemPress = fn();

function applySelect(current: Set<PolylineId>, ids: PolylineId[], mode: PolylineSelectMode): Set<PolylineId> {
  if (mode === "replace") return new Set(ids);
  const next = new Set(current);
  for (const id of ids) {
    if (mode === "toggle" && next.has(id)) next.delete(id);
    else next.add(id);
  }
  return next;
}

function Harness(props: Partial<PolylineSetProps>) {
  const [selected, setSelected] = useState<Set<PolylineId>>(() => new Set());
  return (
    <div>
      <ImageStage image={IMAGE} view={VIEW} onView={() => {}} style={{ width: IMAGE.width + 2, height: IMAGE.height + 2 }}>
        <div className="absolute inset-0 bg-canvas" />
        <PolylineSet
          items={ITEMS}
          {...props}
          selected={selected}
          onHover={hover}
          onHoverChange={hoverChange}
          onItemPress={(id) => {
            itemPress(id);
          }}
          onSelect={(ids, mode) => {
            select(ids, mode);
            setSelected((current) => applySelect(current, ids, mode));
          }}
        />
      </ImageStage>
      <output data-testid="selected">{[...selected].sort().join(",") || "none"}</output>
    </div>
  );
}

const surfacePress = fn();

/**
 * Lines inside a region of interest whose inside is left to the layers below: a Shift-press
 * there reaches the app's `StageSurface`, which starts the lines' band through their `ref`.
 */
function SweepInsideRegion() {
  const linesRef = useRef<PolylineSetHandle>(null);
  const [selected, setSelected] = useState<Set<PolylineId>>(() => new Set());
  const [region, setRegion] = useState<Rect | null>({ x: 40, y: 30, width: 320, height: 240 });
  return (
    <div>
      <ImageStage image={IMAGE} view={VIEW} onView={() => {}} style={{ width: IMAGE.width + 2, height: IMAGE.height + 2 }}>
        <div className="absolute inset-0 bg-canvas" />
        <StageSurface onPress={(press) => (press.shiftKey ? linesRef.current?.sweepDrag(press) : undefined)} />
        <PolylineSet
          ref={linesRef}
          items={ITEMS}
          selected={selected}
          onSelect={(ids, mode) => {
            select(ids, mode);
            setSelected((current) => applySelect(current, ids, mode));
          }}
        />
        <RectRoiEditor value={region} onValueChange={setRegion} interior="none" fillOpacity={0} />
      </ImageStage>
      <output data-testid="selected">{[...selected].sort().join(",") || "none"}</output>
      <output data-testid="region">{region ? `${region.x},${region.y},${region.width},${region.height}` : "none"}</output>
    </div>
  );
}

/** A draw tool's surface below a polyline layer that takes no presses; the line is still found by the hit-test. */
function DrawOverLines({ interactive }: { interactive?: boolean }) {
  const [text, setText] = useState("no press");
  return (
    <div>
      <ImageStage image={IMAGE} view={VIEW} onView={() => {}} style={{ width: IMAGE.width + 2, height: IMAGE.height + 2 }}>
        <div className="absolute inset-0 bg-canvas" />
        <Surface onText={setText} />
        <PolylineSet items={ITEMS} interactive={interactive} />
      </ImageStage>
      <output data-testid="surface">{text}</output>
    </div>
  );
}

function Surface({ onText }: { onText: (text: string) => void }) {
  const { hitTest } = useStageHitTest();
  return (
    <StageSurface
      onPress={(press) => {
        surfacePress(press);
        const hit = hitTest(press.point, press.radius);
        onText(hit ? `hit ${String(hit.id)}` : "no hit");
        return {};
      }}
    />
  );
}

/** A pointer event at image coordinates (the view is 1:1 at the origin). */
function at(target: Element, p: { x: number; y: number }, extra: Record<string, unknown> = {}) {
  // From the transformed stage itself (1:1), so a border or a centring offset cannot shift it.
  const stage = target.closest("[role=application]")!.querySelector("[data-stage]")!.getBoundingClientRect();
  return {
    clientX: stage.left + p.x + 0.5,
    clientY: stage.top + p.y + 0.5,
    pointerId: 1,
    button: 0,
    ...extra,
  };
}

const meta = {
  title: "stage2d/PolylineSet",
  component: PolylineSet,
  parameters: {
    docs: {
      description: {
        component: `Many selectable polylines over the image — contour candidates, a document's segments, a batch's
matches — drawn as a few batched paths and picked through a spatial index rather than the DOM, so thousands of lines
stay smooth and a hover costs microseconds.

- **States:** default, hover, selected, and \`dimmed\`; \`dashed\` and \`stroke\` style individual lines.
- **Clicks:** a click on a line selects it, and ⌘/Ctrl-click toggles it.
- **Rubber band:** Shift-drag from a line, or any drag with \`marquee\`, draws a band. On release it selects every
  line the band touches; with ⌘/Ctrl it adds them; an empty band clears the selection.
- **Points:** above \`vertexScale\`, the hovered and selected lines show their points as \`vertexColor\` dots (the
  near-white \`label\` role by default) of \`vertexSize\` screen pixels on a dark halo, so they show on a selected line.
- **Sweeps from elsewhere:** with \`marqueeSurface={false}\` the \`marquee\` tool keeps no full-frame target of its own
  (a press on a line still sweeps); the app starts a band from its own \`StageSurface\` with
  \`ref.current.sweepDrag(press)\`, or from any \`pointerdown\` with \`ref.current.startSweep(event)\`, whether or not the
  layer is interactive.
- **Callbacks and hit-test:** \`onHoverChange\` and \`onItemPress\` use the names \`PointSet\` uses, and the layer answers
  \`useStageHitTest\` at \`STAGE_HIT_PRIORITY.line\`. A \`PointSet\` marker over a line takes the press.

**Use** it for any set of lines a person picks from, together with a list of the same items beside the stage. Hover
can be controlled from that list.

**Don't** use it to edit one line's vertices; that is \`ContourEditor\`.

**Accessibility**: the layer is a named image with a count ("Lines: 4 lines, 1 selected"). Picking is by pointer, so
the same selection must be possible from the list beside the stage, which is also where a screen reader finds it.`,
      },
    },
  },
  args: { items: ITEMS },
  render: () => <Harness />,
} satisfies Meta<typeof PolylineSet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("img", { name: "Lines: 4 lines, 0 selected" })).toBeInTheDocument();
  },
};

export const ClickAndToggle: Story = {
  play: async ({ canvas, canvasElement }) => {
    select.mockClear();
    const hit = canvasElement.querySelector("[data-hit]")!;
    await fireEvent.pointerDown(hit, at(hit, { x: 100, y: 61 }));
    await expect(select).toHaveBeenLastCalledWith([1], "replace");
    await fireEvent.pointerDown(hit, at(hit, { x: 340, y: 150 }, { metaKey: true }));
    await expect(select).toHaveBeenLastCalledWith([2], "toggle");
    await waitFor(() => expect(canvas.getByTestId("selected")).toHaveTextContent("1,2"));
    await expect(canvasElement.querySelector("[data-selected-lines]")).not.toBeNull();
  },
};

export const Hover: Story = {
  play: async ({ canvasElement }) => {
    hover.mockClear();
    const hit = canvasElement.querySelector("[data-hit]")!;
    // Just below the bottom edge of square 2, far from every other line.
    await fireEvent.pointerMove(hit, at(hit, { x: 280, y: 202 }));
    await expect(hover).toHaveBeenLastCalledWith(2);
    await waitFor(() => expect(canvasElement.querySelector("svg[data-hovered='2']")).not.toBeNull());
    // React's onPointerLeave is driven by `pointerout`.
    await fireEvent.pointerOut(hit, { relatedTarget: document.body });
    await expect(hover).toHaveBeenLastCalledWith(null);
  },
};

/** `onHoverChange` and `onItemPress` are the names `PointSet` uses, so an app handles every layer alike. */
export const Callbacks: Story = {
  play: async ({ canvasElement }) => {
    hoverChange.mockClear();
    itemPress.mockClear();
    const hit = canvasElement.querySelector("[data-hit]")!;
    await fireEvent.pointerMove(hit, at(hit, { x: 280, y: 202 }));
    await expect(hoverChange).toHaveBeenLastCalledWith(2);
    await fireEvent.pointerDown(hit, at(hit, { x: 100, y: 61 }));
    await expect(itemPress).toHaveBeenLastCalledWith(1);
    // A shift-press starts a band instead of pressing the line.
    itemPress.mockClear();
    await fireEvent.pointerDown(hit, at(hit, { x: 100, y: 60 }, { shiftKey: true }));
    await expect(itemPress).not.toHaveBeenCalled();
    await fireEvent.pointerUp(window, at(hit, { x: 100, y: 60 }));
  },
};

export const ShiftSweep: Story = {
  play: async ({ canvas, canvasElement }) => {
    select.mockClear();
    const hit = canvasElement.querySelector("[data-hit]")!;
    // Shift-press on line 1, drag a band down past line 3 (which crosses x = 100 at y = 242.5)
    // that stays clear of lines 2 and 4.
    await fireEvent.pointerDown(hit, at(hit, { x: 100, y: 60 }, { shiftKey: true }));
    await waitFor(() => expect(canvasElement.querySelector("svg[data-sweeping]")).not.toBeNull());
    await fireEvent.pointerMove(window, at(hit, { x: 150, y: 260 }));
    await fireEvent.pointerUp(window, at(hit, { x: 150, y: 260 }));
    await expect(select).toHaveBeenLastCalledWith([1, 3], "replace");
    await waitFor(() => expect(canvas.getByTestId("selected")).toHaveTextContent("1,3"));
  },
};

export const MarqueeTool: Story = {
  render: () => <Harness marquee />,
  play: async ({ canvas, canvasElement }) => {
    select.mockClear();
    const surface = canvasElement.querySelector("[data-marquee-surface]")!;
    // From bare image: a band over line 2 and line 4.
    await fireEvent.pointerDown(surface, at(surface, { x: 210, y: 30 }));
    await fireEvent.pointerMove(window, at(surface, { x: 390, y: 100 }));
    await fireEvent.pointerUp(window, at(surface, { x: 390, y: 100 }));
    await expect(select).toHaveBeenLastCalledWith([2, 4], "replace");
    // ⌘ adds; an empty band with nothing held clears.
    await fireEvent.pointerDown(surface, at(surface, { x: 50, y: 50 }, { metaKey: true }));
    await fireEvent.pointerUp(window, at(surface, { x: 70, y: 70 }));
    await expect(select).toHaveBeenLastCalledWith([1], "add");
    await waitFor(() => expect(canvas.getByTestId("selected")).toHaveTextContent("1,2,4"));
    await fireEvent.pointerDown(surface, at(surface, { x: 200, y: 160 }));
    await fireEvent.pointerUp(window, at(surface, { x: 205, y: 165 }));
    await expect(select).toHaveBeenLastCalledWith([], "replace");
  },
};

export const DimmedAndVertices: Story = {
  render: () => (
    <ImageStage image={IMAGE} view={{ scale: 4, tx: -200, ty: -160 }} onView={() => {}} style={{ width: 402, height: 302 }}>
      <div className="absolute inset-0 bg-canvas" />
      <PolylineSet items={ITEMS} selected={[1]} dimmed={[2, 4]} hovered={3} />
    </ImageStage>
  ),
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole("img", { name: "Lines: 4 lines, 1 selected" })).toBeInTheDocument();
    // Controlled hover is drawn; points show at 4×.
    await expect(canvasElement.querySelector("[data-hovered-line]")).not.toBeNull();
    await expect(canvasElement.querySelector("[data-points]")).not.toBeNull();
    await expect(canvasElement.querySelector("path[opacity='0.35']")).not.toBeNull();
  },
};

export const NotInteractiveLetsPressesThrough: Story = {
  render: () => <DrawOverLines />,
  play: async ({ canvas, canvasElement }) => {
    surfacePress.mockClear();
    // No handler, so no press target: the layer draws, and answers the hit-test.
    await expect(canvasElement.querySelector("[data-hit]")).toBeNull();
    await expect(canvasElement.querySelector("[data-marquee-surface]")).toBeNull();
    const surface = canvasElement.querySelector("[data-stage-surface]")!;
    // On the top edge of square 1: the surface gets the press, and the hit-test still finds the line.
    await fireEvent.pointerDown(surface, at(surface, { x: 100, y: 60 }));
    await fireEvent.pointerUp(window, at(surface, { x: 100, y: 60 }));
    await expect(surfacePress).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(canvas.getByTestId("surface")).toHaveTextContent("hit 1"));
    await fireEvent.pointerDown(surface, at(surface, { x: 200, y: 160 }));
    await fireEvent.pointerUp(window, at(surface, { x: 200, y: 160 }));
    await waitFor(() => expect(canvas.getByTestId("surface")).toHaveTextContent("no hit"));
  },
};

export const InteractiveClaimsPresses: Story = {
  render: () => <DrawOverLines interactive />,
  play: async ({ canvasElement }) => {
    surfacePress.mockClear();
    const hit = canvasElement.querySelector("[data-hit]")!;
    await expect(hit).not.toBeNull();
    // Forced on without a handler: the press target is back, and it takes the press from the surface.
    await fireEvent.pointerDown(hit, at(hit, { x: 100, y: 60 }));
    await expect(surfacePress).not.toHaveBeenCalled();
  },
};

export const TouchSelectsOnTap: Story = {
  play: async ({ canvas, canvasElement }) => {
    select.mockClear();
    itemPress.mockClear();
    const hit = canvasElement.querySelector("[data-hit]")!;
    const viewport = hit.closest("[role=application]")!;
    const touch = (p: { x: number; y: number }, id = 5) => at(hit, p, { pointerType: "touch", pointerId: id });
    // The press is left to the stage (it may be a pan or a pinch): nothing is selected yet.
    await fireEvent.pointerDown(hit, touch({ x: 100, y: 61 }));
    await expect(select).not.toHaveBeenCalled();
    await fireEvent.pointerUp(viewport, touch({ x: 100, y: 61 }));
    await expect(select).toHaveBeenLastCalledWith([1], "replace");
    await expect(itemPress).toHaveBeenLastCalledWith(1);
    await waitFor(() => expect(canvas.getByTestId("selected")).toHaveTextContent("1"));
    // A finger that travels is a pan, not a selection.
    select.mockClear();
    await fireEvent.pointerDown(hit, touch({ x: 340, y: 150 }));
    await fireEvent.pointerMove(viewport, touch({ x: 300, y: 150 }));
    await fireEvent.pointerUp(viewport, touch({ x: 300, y: 150 }));
    await expect(select).not.toHaveBeenCalled();
    // A second finger turns the first into a pinch.
    await fireEvent.pointerDown(hit, touch({ x: 340, y: 150 }));
    await fireEvent.pointerDown(viewport, touch({ x: 240, y: 150 }, 6));
    await fireEvent.pointerUp(viewport, touch({ x: 340, y: 150 }));
    await fireEvent.pointerUp(viewport, touch({ x: 240, y: 150 }, 6));
    await expect(select).not.toHaveBeenCalled();
  },
};

/**
 * The points of selected lines at 4×: near-white dots on a dark halo, drawn over the selection
 * colour so they show on a selected line.
 */
export const SelectedVertices: Story = {
  render: () => (
    <ImageStage image={IMAGE} view={{ scale: 4, tx: -200, ty: -160 }} onView={() => {}} style={{ width: 402, height: 302 }}>
      <div className="absolute inset-0 bg-canvas" />
      <PolylineSet items={ITEMS} selected={[1, 2]} />
    </ImageStage>
  ),
  play: async ({ canvasElement }) => {
    const dots = canvasElement.querySelector("[data-points]")!;
    await expect(dots).toHaveAttribute("stroke", "var(--stage-label)");
    // 4 screen px at 4×; the halo under it is 1 px wider on each side.
    await expect(dots).toHaveAttribute("stroke-width", "1");
    const halo = dots.previousElementSibling!;
    await expect(halo).toHaveAttribute("stroke", "var(--stage-halo)");
    await expect(halo).toHaveAttribute("stroke-width", "1.5");
    // Drawn after the selected lines, so on top of them.
    const lines = canvasElement.querySelector("[data-selected-lines]")!;
    await expect(lines.compareDocumentPosition(dots) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  },
};

/** \`marquee\` without its full-frame target: a drag from a line still sweeps, and bare image is left to the layers below. */
export const MarqueeWithoutSurface: Story = {
  render: () => <Harness marquee marqueeSurface={false} />,
  play: async ({ canvas, canvasElement }) => {
    select.mockClear();
    await expect(canvasElement.querySelector("[data-marquee-surface]")).toBeNull();
    const hit = canvasElement.querySelector("[data-hit]")!;
    // From the right side of square 1 (no Shift needed with the tool on), across line 3.
    await fireEvent.pointerDown(hit, at(hit, { x: 160, y: 100 }));
    await fireEvent.pointerMove(window, at(hit, { x: 100, y: 260 }));
    await fireEvent.pointerUp(window, at(hit, { x: 100, y: 260 }));
    await expect(select).toHaveBeenLastCalledWith([1, 3], "replace");
    await waitFor(() => expect(canvas.getByTestId("selected")).toHaveTextContent("1,3"));
  },
};

/**
 * A Shift-drag that starts inside a region editor (\`interior="none"\`) sweeps the lines: the
 * press reaches the app's \`StageSurface\`, which returns the lines' \`sweepDrag\`.
 */
export const SweepFromRegionInside: Story = {
  render: () => <SweepInsideRegion />,
  play: async ({ canvas, canvasElement }) => {
    select.mockClear();
    const inside = canvasElement.querySelector("[data-roi-interior]")!;
    const start = { x: 200, y: 160 };
    // Where the stylesheet is loaded, the region's inside is not what a press there lands on.
    if (getComputedStyle(inside).pointerEvents === "none") {
      const { clientX, clientY } = at(inside, start);
      await expect(document.elementFromPoint(clientX, clientY)?.closest("[data-roi-interior]")).toBeNull();
    }
    const surface = canvasElement.querySelector("[data-stage-surface]")!;
    // A band from inside the region up to the top right: over lines 2 and 4.
    await fireEvent.pointerDown(surface, at(surface, start, { shiftKey: true }));
    await waitFor(() => expect(canvasElement.querySelector("svg[data-sweeping]")).not.toBeNull());
    await fireEvent.pointerMove(window, at(surface, { x: 390, y: 20 }));
    await fireEvent.pointerUp(window, at(surface, { x: 390, y: 20 }));
    await expect(select).toHaveBeenLastCalledWith([2, 4], "replace");
    await waitFor(() => expect(canvas.getByTestId("selected")).toHaveTextContent("2,4"));
    // The region is untouched.
    await expect(canvas.getByTestId("region")).toHaveTextContent("40,30,320,240");
  },
};
