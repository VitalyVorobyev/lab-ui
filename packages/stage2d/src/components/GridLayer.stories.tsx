import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fireEvent, fn, waitFor } from "storybook/test";

import { GridLayer, type GridNode, type GridLayerProps } from "./GridLayer";
import type { PointId } from "./pointIndex";
import { ImageStage } from "./stage/ImageStage";
import type { StageView } from "./stage/view";

const IMAGE = { width: 400, height: 300 };
const VIEW: StageView = { scale: 1, tx: 0, ty: 0 };

/** A 5×4 lattice of detected corners, slightly sheared, with (2, 1) and (4, 3) not detected. */
const NODES: GridNode[] = Array.from({ length: 20 }, (_, n): GridNode => {
  const i = n % 5;
  const j = Math.floor(n / 5);
  return { id: `${i}-${j}`, i, j, x: 60 + 68 * i + 6 * j, y: 50 + 66 * j - 3 * i };
}).filter((node) => !(node.i === 2 && node.j === 1) && !(node.i === 4 && node.j === 3));

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

function Harness(props: Partial<GridLayerProps>) {
  const [selected, setSelected] = useState<Set<PointId>>(() => new Set());
  return (
    <div>
      <Frame>
        <GridLayer
          nodes={NODES}
          {...props}
          selectedIds={selected}
          onHoverChange={hover}
          onItemPress={(id) => {
            press(id);
            setSelected(new Set([id]));
          }}
        />
      </Frame>
      <output data-testid="selected">{[...selected].map(String).join(",") || "none"}</output>
    </div>
  );
}

const meta = {
  title: "stage2d/GridLayer",
  component: GridLayer,
  parameters: {
    docs: {
      description: {
        component: `A detected calibration lattice over the image: the corners, the edges between lattice neighbours, and
optional \`i,j\` labels. Each node carries its lattice index \`(i, j)\`; the edges are computed (\`latticeEdges\`): node
\`(i, j)\` is joined to \`(i + 1, j)\` and to \`(i, j + 1)\` where both were detected, so a missed corner leaves a gap
rather than a wrong line.

- **Nodes** are a \`PointSet\`: \`plus\` markers by default (the overlay grammar's corner), picked through the point index,
  with the same hover, selection (with ring) and dimming. A grid of 10,000 corners is a dozen DOM nodes.
- **Edges** are one batched path per axis, in the \`structure\` role at 1 screen px with a halo, below the nodes. \`edges\`
  restyles each axis (role, dashed, visible) so the two axes differ by more than colour.
- **Labels:** \`indexLabels\` labels every node with its \`i,j\`, only where nodes are at least 24 screen px apart.
- **Pointer:** edges are not picked; a person points at a corner. \`onHoverChange\` and \`onItemPress\` are the
  \`PointSet\`'s, at point priority.

**Use** it for a detected board or any regular lattice.

**Don't** use it for the board's outline or a pattern's cells (that is \`AreaSet\`), or for loose points (\`PointSet\`).

**Accessibility**: the layer is a named image with a count ("Grid: 18 points, 1 selected"); the edges are decorative.
The same selection must be possible from the list beside the stage.`,
      },
    },
  },
  args: { nodes: NODES },
  render: () => <Harness />,
} satisfies Meta<typeof GridLayer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole("img", { name: "Grid: 18 points, 0 selected" })).toBeInTheDocument();
    // Two axes are two batches: not one element per edge.
    await expect(canvasElement.querySelectorAll("path[data-edge-batch]")).toHaveLength(2);
    // A full 5×4 lattice has 16 i-edges and 15 j-edges; the two missing corners take 3 and 3.
    const i = canvasElement.querySelector("path[data-edge-batch='i|0']")!;
    const j = canvasElement.querySelector("path[data-edge-batch='j|0']")!;
    await expect((i.getAttribute("d")!.match(/M/g) ?? []).length).toBe(13);
    await expect((j.getAttribute("d")!.match(/M/g) ?? []).length).toBe(12);
  },
};

export const IndexLabels: Story = {
  render: () => <Harness indexLabels />,
  play: async ({ canvasElement }) => {
    const labels = [...canvasElement.querySelectorAll("[data-labels] text")].map((text) => text.textContent);
    await expect(labels).toHaveLength(18);
    await expect(labels).toEqual(expect.arrayContaining(["0,0", "4,2", "3,3"]));
    await expect(labels).not.toContain("2,1");
  },
};

export const EdgeStyles: Story = {
  render: () => (
    <Frame>
      <GridLayer nodes={NODES} edges={{ i: { role: "feature" }, j: { role: "model", dashed: true } }} />
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    const j = canvasElement.querySelector("path[data-edge-batch='j|0']")!;
    await expect(j.getAttribute("stroke")).toBe("var(--stage-model)");
    await expect(j.getAttribute("stroke-dasharray")).not.toBeNull();
    await expect(canvasElement.querySelector("path[data-edge-batch='i|0']")!.getAttribute("stroke")).toBe("var(--stage-feature)");
  },
};

export const OneAxisHidden: Story = {
  render: () => (
    <Frame>
      <GridLayer nodes={NODES} edges={{ j: { visible: false } }} />
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll("path[data-edge-batch]")).toHaveLength(1);
    await expect(canvasElement.querySelector("path[data-edge-batch='i|0']")).not.toBeNull();
  },
};

export const Hover: Story = {
  play: async ({ canvasElement }) => {
    hover.mockClear();
    const stage = viewport(canvasElement);
    await fireEvent.pointerMove(stage, at(canvasElement, { x: 128 + 6, y: 50 + 66 - 3 }));
    await expect(hover).toHaveBeenLastCalledWith("1-1");
    await waitFor(() => expect(canvasElement.querySelector("svg[data-hovered='1-1']")).not.toBeNull());
    await fireEvent.pointerMove(stage, at(canvasElement, { x: 200, y: 280 }));
    await expect(hover).toHaveBeenLastCalledWith(null);
  },
};

export const ClickToSelect: Story = {
  play: async ({ canvas, canvasElement }) => {
    press.mockClear();
    const stage = viewport(canvasElement);
    await fireEvent.pointerDown(stage, at(canvasElement, { x: 60, y: 50 }));
    await expect(press).toHaveBeenLastCalledWith("0-0");
    await waitFor(() => expect(canvas.getByTestId("selected")).toHaveTextContent("0-0"));
    await expect(canvasElement.querySelector("[data-selection-rings]")).not.toBeNull();
    // A press on an edge, between nodes, is not a node: the stage pans.
    press.mockClear();
    await fireEvent.pointerDown(stage, at(canvasElement, { x: 94, y: 49 }));
    await expect(press).not.toHaveBeenCalled();
    await expect(stage).toHaveAttribute("data-panning");
    await fireEvent.pointerUp(stage, at(canvasElement, { x: 94, y: 49 }));
  },
};

/** An edge is dimmed when both its nodes are: the first row is out of the current filter. */
export const DimmedRow: Story = {
  render: () => (
    <Frame>
      <GridLayer nodes={NODES} dimmed={(id) => String(id).endsWith("-0")} />
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    // The row's i-edges are dimmed; the edges running down from it join a dimmed and a lit node: lit.
    await expect(canvasElement.querySelector("g[opacity='0.35'] path[data-edge-batch='i|1']")).not.toBeNull();
    await expect(canvasElement.querySelector("path[data-edge-batch='j|0']")).not.toBeNull();
    await expect(canvasElement.querySelector("path[data-edge-batch='i|0']")).not.toBeNull();
  },
};

const BIG: GridNode[] = Array.from({ length: 10_000 }, (_, n): GridNode => {
  const i = n % 100;
  const j = Math.floor(n / 100);
  return { id: n, i, j, x: 20 + 19 * i, y: 20 + 14 * j };
});

/** Ten thousand corners and their edges are a few elements. */
export const LargeGrid: Story = {
  render: () => (
    <ImageStage image={{ width: 2000, height: 1500 }} view={{ scale: 0.2, tx: 0, ty: 0 }} onView={() => {}} style={{ width: 402, height: 302 }}>
      <div className="absolute inset-0 bg-canvas" />
      <GridLayer nodes={BIG} kind="dot" />
    </ImageStage>
  ),
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole("img", { name: "Grid: 10000 points, 0 selected" })).toBeInTheDocument();
    await expect(canvasElement.querySelectorAll("svg path").length).toBeLessThanOrEqual(8);
    const i = canvasElement.querySelector("path[data-edge-batch='i|0']")!;
    await expect((i.getAttribute("d")!.match(/M/g) ?? []).length).toBe(99 * 100);
  },
};
