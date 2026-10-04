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
const pressed = fn();
const doubled = fn();

/**
 * A measuring tool built on the surface: with the tool on, a click drops a point and a drag
 * measures a line; with it off, every press is declined and the stage pans.
 */
function Ruler({
  initialTool,
  initialView = { scale: 1, tx: 0, ty: 0 },
  claimsTouch = false,
  doubleClick = false,
}: {
  initialTool: boolean;
  initialView?: StageView;
  claimsTouch?: boolean;
  doubleClick?: boolean;
}) {
  const [view, setView] = useState<StageView | null>(initialView);
  const [tool, setTool] = useState(initialTool);
  const [line, setLine] = useState<{ a: Point; b: Point } | null>(null);
  const [points, setPoints] = useState<Point[]>([]);

  const onPress = (press: StagePress) => {
    const { point, shiftKey } = press;
    pressed(press);
    if (!tool || shiftKey) return; // Declined: the stage pans.
    return {
      claimsTouch,
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
        <StageSurface
          onPress={onPress}
          cursor={tool ? "crosshair" : undefined}
          onHover={hovered}
          onDoubleClick={doubleClick ? doubled : undefined}
        />
        <svg viewBox={imageViewBox(IMAGE)} className="pointer-events-none absolute inset-0 h-full w-full">
          {line && <line x1={line.a.x} y1={line.a.y} x2={line.b.x} y2={line.b.y} stroke="var(--signal)" strokeWidth={2} />}
          {points.map((p) => (
            <circle key={`${p.x},${p.y}`} cx={p.x} cy={p.y} r={4} fill="var(--signal)" />
          ))}
        </svg>
      </ImageStage>
      <output data-testid="view">{view ? `${view.scale},${Math.round(view.tx)},${Math.round(view.ty)}` : "none"}</output>
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

/** A touch pointer event at a client offset from the stage's top-left corner. */
function finger(target: Element, x: number, y: number, pointerId: number) {
  const viewport = target.closest("[role=application]")!.getBoundingClientRect();
  return { clientX: viewport.left + x, clientY: viewport.top + y, pointerId, pointerType: "touch", button: 0 };
}

/** The 2x view the touch stories pan from: the image is wider than the viewport, so it can move. */
const ZOOMED: StageView = { scale: 2, tx: 0, ty: 0 };

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

**Touch.** A touch is *watched*, not claimed, unless its drag sets \`claimsTouch\`: the stage still pans with one
finger and pinches with two, so act in \`onEnd\` when \`moved\` is \`false\` (a tap), not in \`onPress\`. \`onMove\` fires only
once the finger has left the tap slop, \`onCancel\` when a second finger lands or the browser takes the touch, and
\`onHover\` is not called. \`StagePress\` carries \`touch\`, \`client\` and the hit \`radius\` (12 px for a finger, 6 otherwise).

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

export const TouchTapActsOnRelease: Story = {
  play: async ({ canvas, canvasElement }) => {
    pressed.mockClear();
    const surface = canvasElement.querySelector("[data-stage-surface]")!;
    const viewport = surface.closest("[role=application]")!;
    await fireEvent.pointerDown(surface, finger(surface, 50, 50, 5));
    // Offered to the tool at the press, with a fingertip's tolerance, but nothing has happened yet.
    await expect(pressed).toHaveBeenCalledTimes(1);
    await expect(pressed.mock.calls[0]![0]).toMatchObject({ touch: true, radius: 12 });
    await expect(pressed.mock.calls[0]![0]).toHaveProperty("client.x", expect.any(Number));
    await expect(canvas.getByTestId("ruler")).toHaveTextContent("0 points");
    await fireEvent.pointerUp(viewport, finger(surface, 50, 50, 5));
    await waitFor(() => expect(canvas.getByTestId("ruler")).toHaveTextContent("1 points"));
    // A mouse press, for contrast, has the smaller tolerance.
    await fireEvent.pointerDown(surface, at(surface, { x: 90, y: 90 }));
    await expect(pressed.mock.lastCall![0]).toMatchObject({ touch: false, radius: 6 });
    await fireEvent.pointerUp(window, at(surface, { x: 90, y: 90 }));
  },
};

export const TouchDragLeavesThePanToTheStage: Story = {
  render: () => <Ruler initialTool initialView={ZOOMED} />,
  play: async ({ canvas, canvasElement }) => {
    const surface = canvasElement.querySelector("[data-stage-surface]")!;
    const viewport = surface.closest("[role=application]")!;
    await expect(canvas.getByTestId("view")).toHaveTextContent("2,0,0");
    await fireEvent.pointerDown(surface, finger(surface, 150, 150, 5));
    // Inside the tap slop: the stage may still read it as a tap, and the tool hears nothing.
    await fireEvent.pointerMove(viewport, finger(surface, 152, 150, 5));
    await expect(canvas.getByTestId("ruler")).toHaveTextContent("no line");
    // Past it: the stage pans, and the tool's drag now moves too.
    await fireEvent.pointerMove(viewport, finger(surface, 110, 150, 5));
    await waitFor(() => expect(canvas.getByTestId("view")).toHaveTextContent("2,-40,0"));
    await expect(canvas.getByTestId("ruler")).toHaveTextContent(/\d+ px/);
    await fireEvent.pointerUp(viewport, finger(surface, 110, 150, 5));
    // The release of a drag is not a tap.
    await expect(canvas.getByTestId("ruler")).toHaveTextContent(/ · 0 points/);
  },
};

export const TouchSecondFingerCancels: Story = {
  render: () => <Ruler initialTool initialView={ZOOMED} />,
  play: async ({ canvas, canvasElement }) => {
    cancelled.mockClear();
    const surface = canvasElement.querySelector("[data-stage-surface]")!;
    const viewport = surface.closest("[role=application]")!;
    await fireEvent.pointerDown(surface, finger(surface, 150, 150, 5));
    await fireEvent.pointerDown(surface, finger(surface, 250, 150, 6));
    await expect(cancelled).toHaveBeenCalledTimes(1);
    // The stage took both fingers as a pinch: spreading them zooms.
    await fireEvent.pointerMove(viewport, finger(surface, 350, 150, 6));
    await waitFor(() => expect(canvas.getByTestId("view")).not.toHaveTextContent(/^2,/));
    await fireEvent.pointerUp(viewport, finger(surface, 350, 150, 6));
    await fireEvent.pointerUp(viewport, finger(surface, 150, 150, 5));
    await expect(cancelled).toHaveBeenCalledTimes(1);
    await expect(canvas.getByTestId("ruler")).toHaveTextContent("0 points");
  },
};

export const TouchClaimed: Story = {
  render: () => <Ruler initialTool initialView={ZOOMED} claimsTouch />,
  play: async ({ canvas, canvasElement }) => {
    const surface = canvasElement.querySelector("[data-stage-surface]")!;
    const viewport = surface.closest("[role=application]")!;
    // Like a mouse press: the gesture owns the finger, so the stage does not pan.
    await fireEvent.pointerDown(surface, finger(surface, 150, 150, 5));
    await waitFor(() => expect(canvasElement.querySelector("svg[data-dragging]")).not.toBeNull());
    await fireEvent.pointerMove(viewport, finger(surface, 110, 150, 5));
    await waitFor(() => expect(canvas.getByTestId("ruler")).toHaveTextContent(/\d+ px/));
    await expect(canvas.getByTestId("view")).toHaveTextContent("2,0,0");
    await fireEvent.pointerUp(window, finger(surface, 110, 150, 5));
    await waitFor(() => expect(canvasElement.querySelector("svg[data-dragging]")).toBeNull());
  },
};

export const TouchDoesNotHover: Story = {
  play: async ({ canvasElement }) => {
    hovered.mockClear();
    const surface = canvasElement.querySelector("[data-stage-surface]")!;
    await fireEvent.pointerMove(surface, finger(surface, 20, 30, 5));
    await expect(hovered).not.toHaveBeenCalled();
    await fireEvent.pointerMove(surface, at(surface, { x: 20, y: 30 }));
    await expect(hovered).toHaveBeenCalledTimes(1);
  },
};

export const OwnsTheDoubleClick: Story = {
  render: () => <Ruler initialTool initialView={ZOOMED} doubleClick />,
  play: async ({ canvas, canvasElement }) => {
    doubled.mockClear();
    const surface = canvasElement.querySelector("[data-stage-surface]")!;
    await fireEvent.dblClick(surface, at(surface, { x: 100, y: 80 }));
    await expect(doubled).toHaveBeenCalledTimes(1);
    // The stage's double-click-to-fit did not run.
    await expect(canvas.getByTestId("view")).toHaveTextContent("2,0,0");
  },
};
