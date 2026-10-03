import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fireEvent, fn, waitFor } from "storybook/test";

import type { Point } from "../measureGeometry";
import { ImageStage } from "./ImageStage";
import { StageSurface, type StagePress } from "./StageSurface";
import { imageViewBox, type StageView } from "./view";

const IMAGE = { width: 400, height: 300 };
const onView = fn();
const hovered = fn();
const cancelled = fn();

/**
 * A measuring tool built on the surface: with the tool on, a click drops a point and a drag
 * measures a line; with it off, every press is declined and the stage pans.
 */
function Ruler({ initialTool }: { initialTool: boolean }) {
  const [view, setView] = useState<StageView | null>({ scale: 1, tx: 0, ty: 0 });
  const [tool, setTool] = useState(initialTool);
  const [line, setLine] = useState<{ a: Point; b: Point } | null>(null);
  const [points, setPoints] = useState<Point[]>([]);

  const onPress = ({ point, shiftKey }: StagePress) => {
    if (!tool || shiftKey) return; // Declined: the stage pans.
    return {
      onMove: (p: Point) => setLine({ a: point, b: p }),
      onEnd: (p: Point, _event: PointerEvent, moved: boolean) => {
        if (moved) setLine({ a: point, b: p });
        else setPoints((all) => [...all, p]);
      },
      onCancel: () => {
        cancelled();
        setLine(null);
      },
    };
  };

  return (
    <div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={tool} onChange={(event) => setTool(event.currentTarget.checked)} />
        Ruler
      </label>
      <ImageStage
        image={IMAGE}
        view={view}
        onView={(next) => {
          setView(next);
          onView(next);
        }}
        style={{ width: IMAGE.width + 2, height: IMAGE.height + 2 }}
      >
        <div className="absolute inset-0 bg-surface" />
        <StageSurface onPress={onPress} cursor={tool ? "crosshair" : undefined} onHover={hovered} />
        <svg viewBox={imageViewBox(IMAGE)} className="pointer-events-none absolute inset-0 h-full w-full">
          {line && <line x1={line.a.x} y1={line.a.y} x2={line.b.x} y2={line.b.y} stroke="var(--signal)" strokeWidth={2} />}
          {points.map((p) => (
            <circle key={`${p.x},${p.y}`} cx={p.x} cy={p.y} r={4} fill="var(--signal)" />
          ))}
        </svg>
      </ImageStage>
      <output data-testid="ruler">
        {line ? `${Math.round(Math.hypot(line.b.x - line.a.x, line.b.y - line.a.y))} px` : "no line"} · {points.length} points
      </output>
    </div>
  );
}

/** Pointer coordinates for an image point (the view is 1:1 at the origin). */
function at(target: Element, p: Point, extra: Record<string, unknown> = {}) {
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
  title: "stage2d/StageSurface",
  component: StageSurface,
  parameters: {
    docs: {
      description: {
        component: `The stage's tool model: one full-frame press target that asks the app what a press means.

**How it decides.**
- \`onPress\` returns a drag (\`onMove\`, \`onEnd\` with a \`moved\` flag that tells a click from a drag, and
  \`onCancel\`) to claim the press, or nothing to decline it.
- A declined press reaches the stage, which pans.
- The hand tool and a held space bar always pan.

**How drags are tracked.** Drags listen on \`window\`, so they survive the pointer leaving the canvas and never
depend on which element captured the pointer. \`useStageDrag\` starts the same kind of drag from any element, e.g. a
handle or a line.

**Use** one surface per stage, under the layers that have their own small targets. Put the priority between tools
(handle first, then sweep, then draw, then decline) in \`onPress\`.

**Don't** stack several full-frame targets. Only the topmost one ever receives a press.

**Accessibility**: the surface is pointer input only and is \`aria-hidden\`. Every action it offers must also be
reachable some other way, for example by typing a region's numbers or choosing from a list.`,
      },
    },
  },
  args: { onPress: () => undefined },
  render: () => <Ruler initialTool />,
} satisfies Meta<typeof StageSurface>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ClickAndDrag: Story = {
  play: async ({ canvas, canvasElement }) => {
    const surface = canvasElement.querySelector("[data-stage-surface]")!;
    await expect(surface).toHaveStyle({ cursor: "crosshair" });
    // A click: claimed, no move.
    await fireEvent.pointerDown(surface, at(surface, { x: 50, y: 50 }));
    await fireEvent.pointerUp(window, at(surface, { x: 50, y: 50 }));
    await waitFor(() => expect(canvas.getByTestId("ruler")).toHaveTextContent("1 points"));
    // A drag, finished outside the canvas: the window still hears it.
    await fireEvent.pointerDown(surface, at(surface, { x: 100, y: 100 }));
    await waitFor(() => expect(canvasElement.querySelector("svg[data-dragging]")).not.toBeNull());
    await fireEvent.pointerMove(window, at(surface, { x: 400, y: 100 }));
    await fireEvent.pointerMove(window, at(surface, { x: 700, y: 100 }));
    await fireEvent.pointerUp(window, at(surface, { x: 700, y: 100 }));
    await waitFor(() => expect(canvas.getByTestId("ruler")).toHaveTextContent("600 px · 1 points"));
    await expect(canvasElement.querySelector("svg[data-dragging]")).toBeNull();
  },
};

export const DeclinedPressPans: Story = {
  render: () => <Ruler initialTool={false} />,
  play: async ({ canvasElement }) => {
    onView.mockClear();
    const surface = canvasElement.querySelector("[data-stage-surface]")!;
    await fireEvent.pointerDown(surface, at(surface, { x: 100, y: 100 }));
    const viewport = surface.closest("[role=application]")!;
    await fireEvent.pointerMove(viewport, at(surface, { x: 140, y: 120 }));
    await fireEvent.pointerUp(viewport, at(surface, { x: 140, y: 120 }));
    await waitFor(() => expect(onView).toHaveBeenCalled());
  },
};

export const HoverAndCancel: Story = {
  play: async ({ canvasElement }) => {
    hovered.mockClear();
    cancelled.mockClear();
    const surface = canvasElement.querySelector("[data-stage-surface]")!;
    await fireEvent.pointerMove(surface, at(surface, { x: 20, y: 30 }));
    await expect(hovered).toHaveBeenLastCalledWith({ x: 20, y: 30 });
    // A right-button press is not offered to the tool.
    await fireEvent.pointerDown(surface, at(surface, { x: 20, y: 30 }, { button: 2 }));
    await expect(canvasElement.querySelector("svg[data-dragging]")).toBeNull();
    // A drag interrupted by the browser is cancelled, not finished.
    await fireEvent.pointerDown(surface, at(surface, { x: 20, y: 30 }));
    await fireEvent.pointerMove(window, at(surface, { x: 60, y: 30 }));
    await fireEvent.pointerCancel(window);
    await expect(cancelled).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(canvasElement.querySelector("svg[data-dragging]")).toBeNull());
  },
};
