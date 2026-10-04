import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fireEvent, fn, waitFor } from "storybook/test";

import type { EllipseId } from "./ellipseIndex";
import { EllipseSet, type EllipseSetItem, type EllipseSetProps } from "./EllipseSet";
import { PointSet } from "./PointSet";
import { ImageStage } from "./stage/ImageStage";
import { useStageHitTest } from "./stage/useStageHitTest";
import type { StageView } from "./stage/view";

const IMAGE = { width: 400, height: 300 };
const VIEW: StageView = { scale: 1, tx: 0, ty: 0 };

/** Two nested rings, a turned thin ellipse, a dashed one, a model-role one and two dots. */
const ITEMS: EllipseSetItem[] = [
  { id: "outer", x: 110, y: 100, rx: 70, ry: 50, angle: 0.3 },
  { id: "inner", x: 110, y: 100, rx: 30, ry: 20, angle: 0.3, role: "model" },
  { id: "thin", x: 290, y: 90, rx: 60, ry: 8, angle: -0.6 },
  { id: "dashed", x: 280, y: 210, rx: 40, ry: 28, dashed: true },
  { id: "dot-a", x: 60, y: 240, rx: 6, ry: 6, opacity: 0.6 },
  { id: "dot-b", x: 100, y: 240, rx: 6, ry: 6 },
];

const hover = fn();
const press = fn();

/** Client position of image point `p` (the view is 1:1 at the origin) on the stage the story renders. */
function at(root: Element, p: { x: number; y: number }, extra: Record<string, unknown> = {}) {
  const stage = root.querySelector("[data-stage]")!.getBoundingClientRect();
  return { clientX: stage.left + p.x + 0.5, clientY: stage.top + p.y + 0.5, pointerId: 1, button: 0, ...extra };
}

const viewport = (root: Element) => root.querySelector("[role=application]")!;

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <ImageStage image={IMAGE} view={VIEW} onView={() => {}} style={{ width: IMAGE.width + 2, height: IMAGE.height + 2 }}>
      <div className="absolute inset-0 bg-canvas" />
      {children}
    </ImageStage>
  );
}

function Harness(props: Partial<EllipseSetProps>) {
  const [selected, setSelected] = useState<Set<EllipseId>>(() => new Set());
  return (
    <div>
      <Frame>
        <EllipseSet
          items={ITEMS}
          label="Ellipses"
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
  title: "stage2d/EllipseSet",
  component: EllipseSet,
  parameters: {
    docs: {
      description: {
        component: `Many ellipses over the image whose size is data — fitted ring edges, edge-bit dots, drawn ellipse
annotations — as exact arcs batched into a few paths (one per state, role, dash and opacity), picked through a spatial
index rather than the DOM.

- **Geometry** is in image pixels (\`rx\`, \`ry\`, rotation \`angle\`), so it scales with the image; strokes are screen
  constants. \`minRadius\` keeps a dot visible at fit.
- **States:** default 1.5 px (1 for \`model\` and \`structure\`), hover 2 px, selected 2.5 px in the selection colour,
  \`dimmed\` at 35 % opacity, and per item \`dashed\` and \`opacity\` so two kinds differ by more than colour.
- **Pointer:** a press within the pointer's tolerance (6 px, 12 for touch) of an outline picks that ellipse, else the
  smallest ellipse containing it, so a ring inside another is picked rather than the outer one. The distance is the true
  Euclidean distance to the outline, also for a thin ellipse. \`onHoverChange(id | null)\` and \`onItemPress(id, event)\`
  claim presses inside the layer; for an app with a drawing tool, ask \`useStageHitTest\` what is under a press.
- **\`pickable={false}\`** leaves a decorative layer out of the hit-test (the ring outlines of a calibration target,
  whose picking is a \`PointSet\` at the centres).

**Use** it for ellipses whose radius is a measurement or an annotation. **Don't** use it for a marker of a fixed screen
size (that is a \`PointSet\` glyph), or for an ellipse the user edits with handles (\`ShapeEditor\`).

**Accessibility**: with \`label\` the layer is a named image; without it the layer is decorative. Picking is by pointer, so
the same selection must be possible from a list beside the stage.`,
      },
    },
  },
  args: { items: ITEMS },
  render: () => <Harness />,
} satisfies Meta<typeof EllipseSet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole("img", { name: "Ellipses" })).toBeInTheDocument();
    await expect(canvasElement.querySelector("svg[data-ellipses='6']")).not.toBeNull();
    // feature solid, feature dashed, feature solid 60 %, model solid: not one element per ellipse.
    await expect(canvasElement.querySelectorAll("path[data-batch]")).toHaveLength(4);
  },
};

export const Hover: Story = {
  play: async ({ canvasElement }) => {
    hover.mockClear();
    const stage = viewport(canvasElement);
    // Inside the outer ring only (halfway between the rings).
    await fireEvent.pointerMove(stage, at(canvasElement, { x: 110 + 50 * Math.cos(0.3), y: 100 + 50 * Math.sin(0.3) }));
    await expect(hover).toHaveBeenLastCalledWith("outer");
    await waitFor(() => expect(canvasElement.querySelector("svg[data-hovered='outer']")).not.toBeNull());
    await expect(canvasElement.querySelector("[data-hovered-ellipse]")).not.toBeNull();
    // Inside both: the smaller wins.
    await fireEvent.pointerMove(stage, at(canvasElement, { x: 110, y: 100 }));
    await expect(hover).toHaveBeenLastCalledWith("inner");
    // The thin ellipse is picked 5 px off its outline, which a scaled-radius distance would miss.
    await fireEvent.pointerMove(stage, at(canvasElement, { x: 290 + 5 * Math.sin(-0.6), y: 90 - 8 - 5 + 5 * (1 - Math.cos(-0.6)) }));
    await expect(hover).toHaveBeenLastCalledWith("thin");
    // Bare image ends it.
    await fireEvent.pointerMove(stage, at(canvasElement, { x: 200, y: 280 }));
    await expect(hover).toHaveBeenLastCalledWith(null);
  },
};

export const ClickToSelect: Story = {
  play: async ({ canvas, canvasElement }) => {
    press.mockClear();
    const stage = viewport(canvasElement);
    await fireEvent.pointerDown(stage, at(canvasElement, { x: 280, y: 210 }));
    await expect(press).toHaveBeenLastCalledWith("dashed");
    // A press a layer claims is not a pan.
    await expect(stage).not.toHaveAttribute("data-panning");
    await waitFor(() => expect(canvas.getByTestId("selected")).toHaveTextContent("dashed"));
    await expect(canvasElement.querySelector("[data-selected-ellipses]")).not.toBeNull();
    // An outline within the tolerance beats the interior around it: 3 px outside the inner ring's edge, inside the outer one.
    await fireEvent.pointerDown(stage, at(canvasElement, { x: 110 + 33, y: 100 }, { metaKey: true }));
    await waitFor(() => expect(canvas.getByTestId("selected")).toHaveTextContent("dashed,inner"));
    // Bare image is not an ellipse: the stage pans.
    press.mockClear();
    await fireEvent.pointerDown(stage, at(canvasElement, { x: 380, y: 280 }));
    await expect(press).not.toHaveBeenCalled();
    await expect(stage).toHaveAttribute("data-panning");
    await fireEvent.pointerUp(stage, at(canvasElement, { x: 380, y: 280 }));
  },
};

export const SelectedAndDimmed: Story = {
  render: () => (
    <Frame>
      <EllipseSet items={ITEMS} selectedIds={["inner"]} dimmed={(id) => String(id).startsWith("dot")} label="Ellipses" />
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("[data-selected-ellipses]")).not.toBeNull();
    await expect(canvasElement.querySelector("g[opacity='0.35'] path[data-batch]")).not.toBeNull();
  },
};

export const ControlledHover: Story = {
  render: () => (
    <Frame>
      <EllipseSet items={ITEMS} hoveredId="thin" />
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("svg[data-hovered='thin']")).not.toBeNull();
    await expect(canvasElement.querySelector("[data-hovered-ellipse]")).not.toBeNull();
  },
};

/** A dot whose data size would vanish at this zoom is still drawn at `minRadius` screen pixels. */
export const MinRadius: Story = {
  render: () => (
    <ImageStage image={{ width: 2000, height: 1500 }} view={{ scale: 0.2, tx: 0, ty: 0 }} onView={() => {}} style={{ width: 402, height: 302 }}>
      <div className="absolute inset-0 bg-canvas" />
      <EllipseSet items={[{ id: "tiny", x: 1000, y: 750, rx: 1, ry: 1 }]} minRadius={3} />
    </ImageStage>
  ),
  play: async ({ canvasElement }) => {
    const d = canvasElement.querySelector("path[data-batch]")!.getAttribute("d")!;
    // 3 screen px at 0.2 is 15 image px.
    await expect(d).toContain("A15 15");
  },
};

const pressedOnPoint = fn();

/** Asks the stage's hit-test what is at `point`, when its button is pressed; the answer is `layer:id` or `none`. */
function Ask({ point, onAnswer }: { point: { x: number; y: number }; onAnswer: (text: string) => void }) {
  const { hitTest } = useStageHitTest();
  return (
    <button
      type="button"
      className="sr-only"
      data-testid="ask"
      onClick={() => {
        const hit = hitTest(point, 6);
        onAnswer(hit ? `${hit.layerId}:${hit.id}` : "none");
      }}
    >
      ask
    </button>
  );
}

/** Not pickable: the layer is left out of the hit-test, so its outline hovers and claims nothing, and bare image pans. */
export const NotPickable: Story = {
  render: () => <NotPickableDemo />,
  play: async ({ canvas, canvasElement }) => {
    pressedOnPoint.mockClear();
    hover.mockClear();
    const stage = viewport(canvasElement);
    // On the ring's outline, which a pickable layer would take.
    await fireEvent.pointerMove(stage, at(canvasElement, { x: 240, y: 150 }));
    await expect(hover).not.toHaveBeenCalled();
    await fireEvent.click(canvas.getByTestId("ask"));
    await expect(canvas.getByTestId("answer")).toHaveTextContent("none");
    await fireEvent.pointerDown(stage, at(canvasElement, { x: 240, y: 150 }));
    await expect(stage).toHaveAttribute("data-panning");
    await fireEvent.pointerUp(stage, at(canvasElement, { x: 240, y: 150 }));
    // The centre marker is the picked thing.
    await fireEvent.pointerDown(stage, at(canvasElement, { x: 200, y: 150 }));
    await expect(pressedOnPoint).toHaveBeenLastCalledWith("c");
  },
};

function NotPickableDemo() {
  const [answer, setAnswer] = useState("");
  return (
    <div>
      <Frame>
        <EllipseSet items={[{ id: "ring", x: 200, y: 150, rx: 40, ry: 40 }]} pickable={false} onHoverChange={hover} />
        <PointSet items={[{ id: "c", kind: "plus", x: 200, y: 150 }]} onItemPress={(id) => {
            pressedOnPoint(id);
          }} />
        <Ask point={{ x: 240, y: 150 }} onAnswer={setAnswer} />
      </Frame>
      <output data-testid="answer">{answer}</output>
    </div>
  );
}

/** The layer answers the stage's hit-test, so an app that arbitrates between layers sees it. */
export const HitTest: Story = {
  render: () => <HitTestDemo />,
  play: async ({ canvas }) => {
    await fireEvent.click(canvas.getByTestId("ask"));
    await expect(canvas.getByTestId("answer")).toHaveTextContent("rings:ring");
  },
};

function HitTestDemo() {
  const [answer, setAnswer] = useState("");
  return (
    <div>
      <Frame>
        <EllipseSet items={[{ id: "ring", x: 200, y: 150, rx: 40, ry: 40 }]} layerId="rings" />
        <Ask point={{ x: 243, y: 150 }} onAnswer={setAnswer} />
      </Frame>
      <output data-testid="answer">{answer}</output>
    </div>
  );
}
