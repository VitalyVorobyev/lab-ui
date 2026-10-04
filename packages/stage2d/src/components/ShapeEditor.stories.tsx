import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fireEvent, fn, waitFor } from "storybook/test";

import { rotationHandlePoint, shapeHandlePoint, type RotatedShape } from "./shapeEdit";
import { ShapeEditor, type ShapeEditorProps } from "./ShapeEditor";
import { ImageStage } from "./stage/ImageStage";
import { StageSurface } from "./stage/StageSurface";
import type { StageView } from "./stage/view";

const IMAGE = { width: 400, height: 300 };
// 1:1 at the origin, so client coordinates are image coordinates plus the viewport's corner.
const VIEW: StageView = { scale: 1, tx: 0, ty: 0 };
const DEG = Math.PI / 180;

/** 160 × 80 around (200, 150), turned 20° clockwise. */
const SHAPE: RotatedShape = { cx: 200, cy: 150, width: 160, height: 80, rotation: 20 * DEG };

const change = fn();
const commit = fn();

function summary(shape: RotatedShape | null): string {
  return shape ? [shape.cx, shape.cy, shape.width, shape.height, shape.rotation / DEG].map((v) => Math.round(v)).join(",") : "none";
}

function Harness(props: Partial<ShapeEditorProps> & { initial: RotatedShape | null }) {
  const [value, setValue] = useState<RotatedShape | null>(props.initial);
  return (
    <div style={{ width: IMAGE.width + 2, height: IMAGE.height + 2 }}>
      <ImageStage image={IMAGE} view={VIEW} onView={() => {}} style={{ width: IMAGE.width + 2, height: IMAGE.height + 2 }}>
        <div className="absolute inset-0 bg-surface" />
        <ShapeEditor
          kind="rect"
          {...props}
          value={value}
          onValueChange={(next) => {
            setValue(next);
            change(next);
          }}
          onCommit={commit}
        />
      </ImageStage>
      <output data-testid="shape">{summary(value)}</output>
    </div>
  );
}

/** Press, move and release on an element, at image coordinates (the view is 1:1 at the origin). */
async function drag(target: Element, from: { x: number; y: number }, to: { x: number; y: number }, extra: Record<string, unknown> = {}) {
  const viewport = target.closest("[role=application]")!;
  const origin = viewport.getBoundingClientRect();
  const ox = origin.left + (viewport as HTMLElement).clientLeft;
  const oy = origin.top + (viewport as HTMLElement).clientTop;
  const at = (p: { x: number; y: number }) => ({ clientX: ox + p.x + 0.5, clientY: oy + p.y + 0.5, pointerId: 1, button: 0, ...extra });
  await fireEvent.pointerDown(target, at(from));
  await fireEvent.pointerMove(target, at({ x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }));
  await fireEvent.pointerMove(target, at(to));
  await fireEvent.pointerUp(target, at(to));
}

/** A pointer position at image coordinates (the view is 1:1 at the origin). */
function pointerAt(target: Element, p: { x: number; y: number }) {
  const viewport = target.closest("[role=application]")!;
  const origin = viewport.getBoundingClientRect();
  return {
    clientX: origin.left + (viewport as HTMLElement).clientLeft + p.x + 0.5,
    clientY: origin.top + (viewport as HTMLElement).clientTop + p.y + 0.5,
    button: 0,
  };
}

/** The centre of a handle element, in image coordinates. */
function handleAt(root: Element, name: string): { x: number; y: number } {
  const el = root.querySelector(`[data-handle=${name}]`)!;
  if (el instanceof SVGCircleElement) return { x: Number(el.getAttribute("cx")), y: Number(el.getAttribute("cy")) };
  return { x: Number(el.getAttribute("x")) + Number(el.getAttribute("width")) / 2, y: Number(el.getAttribute("y")) + Number(el.getAttribute("height")) / 2 };
}

const meta = {
  title: "stage2d/ShapeEditor",
  component: ShapeEditor,
  parameters: {
    docs: {
      description: {
        component: `A rotated rectangle or ellipse as an object inside an \`ImageStage\`: an annotation's oriented bounding box, a
detector's fitted ellipse.

- **Value:** \`{ cx, cy, width, height, rotation }\`. **Rotation is in radians, clockwise on screen**, zero when the width
  runs along x. A value in degrees (Konva's \`rotation\`) is \`degrees * Math.PI / 180\`. Konva rotates a \`Rect\` about its
  top-left corner and an \`Ellipse\` about its centre; \`shapeFromCorner\` and \`shapeCorner\` convert the former. An ellipse's
  \`width\` and \`height\` are its full axes, \`2 · radiusX\` and \`2 · radiusY\`.
- **Press order:** one decision serves every part of the editor: the nearest handle first (so a small shape's interior
  never steals a corner), then the interior or the band along the outline (6 px for a mouse, 12 px for a touch), which is
  how a thin or rotated shape is grabbed. A press beyond that is declined and reaches the stage.
- **Touch:** a press that grabs the shape is claimed; a second finger during an edit cancels it (the shape reverts, nothing
  is committed) and is left to the stage.
- **Editing:** eight handles resize the shape in its own frame (the opposite side stays where it is, whatever the
  rotation), the handle past the top side turns it about its centre (Shift rounds to 15°), the interior moves it. A shape
  stops at \`minSize\` (5 px by default) rather than flipping.
- **Events:** \`onValueChange\` follows every move; \`onCommit\` fires once a gesture ends. The value is controlled.
- **Keyboard:** arrow keys move the shape by one image pixel (Shift ×10); Alt + arrows grow it along its own axes from
  its top-left corner; \`[\` and \`]\` turn it by 1° (Shift 15°).
- **Screen size:** handles and the outline are a constant size on screen at every zoom.

**Use** it for a rotated box or an ellipse a person adjusts, with the numbers beside the stage.

**Don't** use it for an axis-aligned region (\`RectRoiEditor\`, which keeps it inside the image), or for polygons
(\`ContourEditor\`). It does not draw a new shape: preview one with \`DraftShape\` while the app's tool does.

**Accessibility**: the shape is a focusable button named with its numbers, and the keys above work without a pointer. The
hand tool and a held space bar still pan.`,
      },
    },
  },
  args: { kind: "rect", value: null, onValueChange: change },
  render: () => <Harness initial={SHAPE} />,
} satisfies Meta<typeof ShapeEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RotatedRectangle: Story = {
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole("button", { name: /Shape: centre 200, 150, 160 × 80 px, rotated 20°/ })).toBeVisible();
    await expect(canvasElement.querySelectorAll("[data-handle]")).toHaveLength(9);
    await expect(canvasElement.querySelector("[data-shape=rect]")).not.toBeNull();
    await expect(canvasElement.querySelector("[data-shape=rect]")!.getAttribute("transform")).toMatch(/^rotate\(20(\.0+\d*)? 200 150\)$/);
  },
};

export const Ellipse: Story = {
  render: () => <Harness initial={SHAPE} kind="ellipse" />,
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole("button", { name: /Shape: centre 200, 150/ })).toHaveAttribute("aria-roledescription", "ellipse");
    await expect(canvasElement.querySelector("ellipse[data-shape=ellipse]")).not.toBeNull();
    // The handles sit on the bounding box, which an ellipse also draws.
    await expect(canvasElement.querySelector("svg > rect[stroke-dasharray]")).not.toBeNull();
  },
};

export const ResizeKeepsTheOppositeSide: Story = {
  play: async ({ canvas, canvasElement }) => {
    commit.mockClear();
    const east = handleAt(canvasElement, "e");
    const westBefore = handleAt(canvasElement, "w");
    // 20 px further along the shape's own x axis.
    const to = { x: east.x + 20 * Math.cos(20 * DEG), y: east.y + 20 * Math.sin(20 * DEG) };
    await drag(canvasElement.querySelector("[data-handle=e]")!, east, to);
    await waitFor(() => expect(canvas.getByTestId("shape")).toHaveTextContent("209,153,180,80,20"));
    const westAfter = handleAt(canvasElement, "w");
    await expect(Math.hypot(westAfter.x - westBefore.x, westAfter.y - westBefore.y)).toBeLessThan(0.01);
    await expect(commit).toHaveBeenCalledTimes(1);
  },
};

export const MinimumSize: Story = {
  render: () => <Harness initial={SHAPE} minSize={12} />,
  play: async ({ canvas, canvasElement }) => {
    const east = handleAt(canvasElement, "e");
    // Dragged far across the shape: it stops at 12 px instead of flipping.
    await drag(canvasElement.querySelector("[data-handle=e]")!, east, { x: -300, y: -300 });
    await waitFor(() => expect(canvas.getByTestId("shape")).toHaveTextContent(/^\d+,\d+,12,80,20$/));
  },
};

export const MoveByTheInterior: Story = {
  play: async ({ canvas }) => {
    commit.mockClear();
    await drag(canvas.getByRole("button", { name: /Shape/ }), { x: 200, y: 150 }, { x: 230, y: 130 });
    await waitFor(() => expect(canvas.getByTestId("shape")).toHaveTextContent("230,130,160,80,20"));
    await expect(commit).toHaveBeenCalledTimes(1);
  },
};

export const Rotate: Story = {
  play: async ({ canvas, canvasElement }) => {
    commit.mockClear();
    const handle = handleAt(canvasElement, "rotate");
    const p = rotationHandlePoint(SHAPE, 24);
    await expect(Math.hypot(handle.x - p.x, handle.y - p.y)).toBeLessThan(0.01);
    // To the east of the centre: a quarter turn clockwise, size and centre unchanged.
    await drag(canvasElement.querySelector("[data-handle=rotate]")!, handle, { x: 320, y: 150 });
    await waitFor(() => expect(canvas.getByTestId("shape")).toHaveTextContent("200,150,160,80,90"));
    await expect(commit).toHaveBeenCalledTimes(1);
    // Shift rounds to 15 degrees: 37 degrees off vertical becomes 30.
    const next = canvasElement.querySelector("[data-handle=rotate]")!;
    const nowAt = handleAt(canvasElement, "rotate");
    await drag(next, nowAt, { x: 200 + 100 * Math.sin(37 * DEG), y: 150 - 100 * Math.cos(37 * DEG) }, { shiftKey: true });
    await waitFor(() => expect(canvas.getByTestId("shape")).toHaveTextContent("200,150,160,80,30"));
  },
};

export const Keyboard: Story = {
  play: async ({ canvas }) => {
    commit.mockClear();
    await fireEvent.keyDown(canvas.getByRole("button", { name: /Shape/ }), { key: "ArrowRight" });
    await fireEvent.keyDown(canvas.getByRole("button", { name: /Shape/ }), { key: "ArrowDown", shiftKey: true });
    await waitFor(() => expect(canvas.getByTestId("shape")).toHaveTextContent("201,160,160,80,20"));
    // Alt grows along the shape's own axes from its top-left corner.
    await fireEvent.keyDown(canvas.getByRole("button", { name: /Shape/ }), { key: "ArrowRight", altKey: true });
    await waitFor(() => expect(canvas.getByTestId("shape")).toHaveTextContent(/^\d+,\d+,161,80,20$/));
    await fireEvent.keyDown(canvas.getByRole("button", { name: /Shape/ }), { key: "]" });
    await fireEvent.keyDown(canvas.getByRole("button", { name: /Shape/ }), { key: "[", shiftKey: true });
    await waitFor(() => expect(canvas.getByTestId("shape")).toHaveTextContent(/^\d+,\d+,161,80,6$/));
    await expect(commit).toHaveBeenCalledTimes(5);
    // Other keys are left to the stage.
    await fireEvent.keyDown(canvas.getByRole("button", { name: /Shape/ }), { key: "a" });
    await expect(commit).toHaveBeenCalledTimes(5);
  },
};

export const ReadOnly: Story = {
  render: () => <Harness initial={SHAPE} editable={false} />,
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll("[data-handle]")).toHaveLength(0);
    await expect(canvasElement.querySelector("[data-shape]")).not.toBeNull();
    await expect(canvasElement.querySelector("svg")).not.toHaveAttribute("data-editable");
  },
};

export const NotRotatable: Story = {
  render: () => <Harness initial={{ ...SHAPE, rotation: 0 }} rotatable={false} />,
  play: async ({ canvas, canvasElement }) => {
    await expect(canvasElement.querySelector("[data-handle=rotate]")).toBeNull();
    await expect(canvasElement.querySelectorAll("[data-handle]")).toHaveLength(8);
    await fireEvent.keyDown(canvas.getByRole("button", { name: /Shape/ }), { key: "]" });
    await expect(canvas.getByTestId("shape")).toHaveTextContent("200,150,160,80,0");
  },
};

export const Empty: Story = {
  render: () => <Harness initial={null} />,
  play: async ({ canvas, canvasElement }) => {
    await expect(canvasElement.querySelectorAll("[data-handle]")).toHaveLength(0);
    await expect(canvas.getByTestId("shape")).toHaveTextContent("none");
  },
};

/** A handle's position is where the maths says, at every rotation. */
export const HandlesFollowTheShape: Story = {
  render: () => <Harness initial={{ cx: 200, cy: 150, width: 120, height: 60, rotation: Math.PI / 2 }} />,
  play: async ({ canvasElement }) => {
    const e = handleAt(canvasElement, "e");
    const expected = shapeHandlePoint({ cx: 200, cy: 150, width: 120, height: 60, rotation: Math.PI / 2 }, "e");
    await expect(Math.hypot(e.x - expected.x, e.y - expected.y)).toBeLessThan(0.01);
    // A quarter turn: the east handle faces south, so it is a vertical-resize cursor.
    await expect((canvasElement.querySelector("[data-handle=e]") as SVGElement).style.cursor).toBe("ns-resize");
  },
};

/** 30 × 20 around (200, 150): small enough that its interior covers its own corner handles. */
const SMALL: RotatedShape = { cx: 200, cy: 150, width: 30, height: 20, rotation: 0 };
/** 160 × 80 around (200, 150), level: its top side is at y = 110. */
const LEVEL: RotatedShape = { cx: 200, cy: 150, width: 160, height: 80, rotation: 0 };

export const CornerOfASmallShapeResizes: Story = {
  render: () => <Harness initial={SMALL} />,
  play: async ({ canvas }) => {
    commit.mockClear();
    // Pressed on the interior element, 4 px in from the nw corner at (185, 140): a handle press, not a move.
    await drag(canvas.getByRole("button", { name: /Shape/ }), { x: 188, y: 143 }, { x: 170, y: 130 });
    await waitFor(() => expect(canvas.getByTestId("shape")).toHaveTextContent("193,145,45,30,0"));
    await expect(commit).toHaveBeenCalledTimes(1);
  },
};

export const OutlineBandMoves: Story = {
  render: () => <Harness initial={LEVEL} />,
  play: async ({ canvas, canvasElement }) => {
    commit.mockClear();
    const band = canvasElement.querySelector("[data-shape-band]")!;
    // 4 px outside the top side, away from every handle: the band counts as the shape.
    await drag(band, { x: 150, y: 106 }, { x: 180, y: 86 });
    await waitFor(() => expect(canvas.getByTestId("shape")).toHaveTextContent("230,130,160,80,0"));
    await expect(commit).toHaveBeenCalledTimes(1);
  },
};

export const FarOutsideDeclines: Story = {
  render: () => <Harness initial={LEVEL} />,
  play: async ({ canvas, canvasElement }) => {
    commit.mockClear();
    const band = canvasElement.querySelector("[data-shape-band]")!;
    const viewport = band.closest("[role=application]")!;
    // 10 px outside: past a mouse's 6 px, so the editor declines and the stage reads the press as a pan.
    await fireEvent.pointerDown(band, { ...pointerAt(band, { x: 150, y: 100 }), pointerId: 1 });
    await expect(viewport).toHaveAttribute("data-panning");
    await fireEvent.pointerUp(viewport, { ...pointerAt(band, { x: 150, y: 100 }), pointerId: 1 });
    await expect(canvas.getByTestId("shape")).toHaveTextContent("200,150,160,80,0");
    await expect(commit).not.toHaveBeenCalled();
  },
};

/** Make the primary pointer coarse for one story, as a phone's is. */
function coarsePointer() {
  const original = Object.getOwnPropertyDescriptor(window, "matchMedia");
  window.matchMedia = (query: string) =>
    ({ matches: query.includes("coarse"), media: query, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList;
  return () => {
    if (original) Object.defineProperty(window, "matchMedia", original);
  };
}

export const TouchHasAWiderBand: Story = {
  beforeEach: coarsePointer,
  render: () => <Harness initial={LEVEL} />,
  play: async ({ canvas, canvasElement }) => {
    commit.mockClear();
    const band = canvasElement.querySelector("[data-shape-band]")!;
    // The same 10 px outside, with a finger (12 px): a move.
    await drag(band, { x: 150, y: 100 }, { x: 180, y: 80 }, { pointerType: "touch", pointerId: 7 });
    await waitFor(() => expect(canvas.getByTestId("shape")).toHaveTextContent("230,130,160,80,0"));
    await expect(commit).toHaveBeenCalledTimes(1);
  },
};

export const TouchSecondFingerCancelsTheEdit: Story = {
  render: () => <Harness initial={LEVEL} />,
  play: async ({ canvas, canvasElement }) => {
    commit.mockClear();
    const band = canvasElement.querySelector("[data-shape-band]")!;
    const viewport = band.closest("[role=application]")!;
    const origin = viewport.getBoundingClientRect();
    const finger = (p: { x: number; y: number }, pointerId: number) => ({
      clientX: origin.left + (viewport as HTMLElement).clientLeft + p.x + 0.5,
      clientY: origin.top + (viewport as HTMLElement).clientTop + p.y + 0.5,
      pointerId,
      pointerType: "touch",
      button: 0,
    });
    await fireEvent.pointerDown(band, finger({ x: 150, y: 106 }, 7));
    await fireEvent.pointerMove(band, finger({ x: 180, y: 86 }, 7));
    await waitFor(() => expect(canvas.getByTestId("shape")).toHaveTextContent("230,130,160,80,0"));
    // A second finger: the edit is abandoned, the shape is back, and nothing was committed.
    await fireEvent.pointerDown(viewport, finger({ x: 60, y: 60 }, 8));
    await waitFor(() => expect(canvas.getByTestId("shape")).toHaveTextContent("200,150,160,80,0"));
    await fireEvent.pointerMove(band, finger({ x: 200, y: 86 }, 7));
    await fireEvent.pointerUp(band, finger({ x: 200, y: 86 }, 7));
    await fireEvent.pointerUp(viewport, finger({ x: 60, y: 60 }, 8));
    await expect(canvas.getByTestId("shape")).toHaveTextContent("200,150,160,80,0");
    await expect(commit).not.toHaveBeenCalled();
  },
};

export const BrowserCancelRevertsTheEdit: Story = {
  render: () => <Harness initial={LEVEL} />,
  play: async ({ canvas, canvasElement }) => {
    commit.mockClear();
    const band = canvasElement.querySelector("[data-shape-band]")!;
    const extra = { pointerType: "touch", pointerId: 7 };
    // The browser takes the touch (`pointercancel`) mid-edit: the shape reverts and nothing is committed.
    await fireEvent.pointerDown(band, { ...pointerAt(band, { x: 150, y: 106 }), ...extra });
    await fireEvent.pointerMove(band, { ...pointerAt(band, { x: 180, y: 86 }), ...extra });
    await waitFor(() => expect(canvas.getByTestId("shape")).toHaveTextContent("230,130,160,80,0"));
    await fireEvent.pointerCancel(band, extra);
    await waitFor(() => expect(canvas.getByTestId("shape")).toHaveTextContent("200,150,160,80,0"));
    await expect(commit).not.toHaveBeenCalled();
  },
};

const below = fn();

export const MousePressJustOutsideReachesTheLayerBelow: Story = {
  render: () => (
    <div style={{ width: IMAGE.width + 2, height: IMAGE.height + 2 }}>
      <ImageStage image={IMAGE} view={VIEW} onView={() => {}} style={{ width: IMAGE.width + 2, height: IMAGE.height + 2 }}>
        <div className="absolute inset-0 bg-surface" />
        <StageSurface
          onPress={(press) => {
            below(press.point);
            return {};
          }}
        />
        <ShapeEditor kind="rect" value={LEVEL} onValueChange={change} />
      </ImageStage>
    </div>
  ),
  play: async ({ canvasElement }) => {
    below.mockClear();
    const surface = canvasElement.querySelector("[data-stage-surface]")!;
    // 9 px above the top side: past a mouse's band, so the press goes through to the surface below.
    await fireEvent.pointerDown(surface, { ...pointerAt(surface, { x: 150, y: 101 }), pointerId: 1 });
    await fireEvent.pointerUp(window, { pointerId: 1 });
    await expect(below).toHaveBeenCalledTimes(1);
    // Just inside the band it is the editor's, not the surface's.
    const band = canvasElement.querySelector("[data-shape-band]")!;
    await fireEvent.pointerDown(band, { ...pointerAt(band, { x: 150, y: 106 }), pointerId: 1 });
    await fireEvent.pointerUp(band, { ...pointerAt(band, { x: 150, y: 106 }), pointerId: 1 });
    await expect(below).toHaveBeenCalledTimes(1);
  },
};
