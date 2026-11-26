import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fireEvent, fn, waitFor } from "storybook/test";

import type { Colormap } from "./heatmapRaster";
import { ImageStage } from "./stage/ImageStage";
import { StageReadout } from "./stage/StageToolbar";
import type { StageView } from "./stage/view";
import { VectorField, type VectorFieldProps } from "./VectorField";
import { VectorFieldKey } from "./VectorFieldKey";

const IMAGE = { width: 400, height: 300 };
const VIEW: StageView = { scale: 1, tx: 0, ty: 0 };

/** Dark blue to yellow through five anchors, standing in for a charts colormap. */
const ANCHORS: [number, number, number][] = [
  [68, 1, 84],
  [59, 82, 139],
  [33, 145, 140],
  [94, 201, 98],
  [253, 231, 37],
];
const sequential: Colormap = (t) => {
  const scaled = Math.min(1, Math.max(0, t)) * (ANCHORS.length - 1);
  const i = Math.min(ANCHORS.length - 2, Math.floor(scaled));
  const f = scaled - i;
  const a = ANCHORS[i]!;
  const b = ANCHORS[i + 1]!;
  return [a[0] + f * (b[0] - a[0]), a[1] + f * (b[1] - a[1]), a[2] + f * (b[2] - a[2])];
};

/**
 * A radial-plus-swirl field on a grid of `cols × rows` anchors, in data units of 0 to about
 * 0.4. The anchor at the centre is absent (NaN), as a missing measurement is.
 */
function swirl(cols: number, rows: number) {
  const anchors = new Float64Array(2 * cols * rows);
  const vectors = new Float64Array(2 * cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const k = r * cols + c;
      const x = (IMAGE.width * (c + 0.5)) / cols;
      const y = (IMAGE.height * (r + 0.5)) / rows;
      const u = (x - IMAGE.width / 2) / (IMAGE.width / 2);
      const v = (y - IMAGE.height / 2) / (IMAGE.height / 2);
      anchors[2 * k] = x;
      anchors[2 * k + 1] = y;
      vectors[2 * k] = 0.25 * u - 0.15 * v;
      vectors[2 * k + 1] = 0.25 * v + 0.15 * u;
    }
  }
  const centre = Math.floor(rows / 2) * cols + Math.floor(cols / 2);
  vectors[2 * centre] = Number.NaN;
  return { anchors, vectors };
}

const SMALL = swirl(20, 15);
const DENSE = swirl(100, 80);

function Frame({ children, view = VIEW, readout }: { children: React.ReactNode; view?: StageView; readout?: React.ReactNode }) {
  return (
    <ImageStage image={IMAGE} view={view} onView={() => {}} readout={readout} style={{ width: IMAGE.width + 2, height: IMAGE.height + 2 }}>
      <div className="absolute inset-0 bg-canvas" />
      {children}
    </ImageStage>
  );
}

const hover = fn();
const press = fn();
const viewport = (root: Element) => root.querySelector("[role=application]")!;

function Harness(props: Partial<VectorFieldProps>) {
  const [view, setView] = useState<StageView | null>(VIEW);
  return (
    <ImageStage
      image={IMAGE}
      view={view}
      onView={setView}
      readout={<StageReadout extra={<VectorFieldKey bare vectors={SMALL.vectors} scale={props.scale} unit="px" />} />}
      style={{ width: IMAGE.width + 2, height: IMAGE.height + 2 }}
    >
      <div className="absolute inset-0 bg-canvas" />
      <VectorField anchors={SMALL.anchors} vectors={SMALL.vectors} onHoverChange={hover} onItemPress={press} {...props} />
    </ImageStage>
  );
}

const meta = {
  title: "stage2d/VectorField",
  component: VectorField,
  parameters: {
    docs: {
      description: {
        component: `Many vectors over the image: a displacement, a flow, a gradient, the direction and size of an error. Each is an
anchor in image coordinates and a \`(dx, dy)\` in data units, as two flat arrays. The field is drawn as a few batched paths
(one halo, then one per colour step), never one element per vector, and picked through a spatial index over the anchors, so
ten thousand arrows stay smooth.

- **Scale:** a number is image pixels per data unit, so the arrows zoom with the image. \`{ length, percentile }\` makes the
  \`percentile\` vector (default the longest) span \`length\` screen pixels at every zoom. The default is the 95th percentile at
  28 screen pixels, so a few outliers do not shrink the rest.
- **Colour:** one tone (\`color\`, or a \`role\`), or by magnitude through \`colormap\` over \`range\`; magnitudes are quantised
  into 24 steps, one path each. Pair a magnitude colouring with a colour legend.
- **Absent data:** a non-finite anchor or component, or an arrow shorter than a screen pixel, is not drawn.
- **Key:** \`VectorFieldKey\` draws an arrow of a round length with its value ("0.1 px") at the field's own scale. Give it
  the same \`vectors\` and \`scale\`, and put it in the stage's readout.
- **Dense fields:** turn the halo off (\`halo={false}\`) past a few thousand arrows: the dark band under each one would be most of what is drawn.
- **Pointer:** \`onHoverChange\` and \`onItemPress\` pick the vector whose **anchor** is nearest. The hovered arrow is
  redrawn thicker in the selection colour.

**Use** it where direction and size both matter. **Don't** use it for a magnitude alone (that is \`HeatmapLayer\`) or for
a handful of annotated arrows (that is \`MeasureOverlay\`).

**Accessibility**: the layer is a named image with a count ("Vectors: 299 vectors"). The key and a legend carry the scale as text,
and what a vector means must also be available from the list or table beside the stage.`,
      },
    },
  },
  args: { anchors: SMALL.anchors, vectors: SMALL.vectors },
  render: () => <Harness />,
} satisfies Meta<typeof VectorField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas, canvasElement }) => {
    // 300 anchors, one of them absent.
    await expect(canvas.getByRole("img", { name: "Vectors: 299 vectors" })).toBeInTheDocument();
    await expect(canvasElement.querySelectorAll("path[data-batch]")).toHaveLength(1);
    // The key shares the field's scale: 95th percentile at 28 screen px, key a round length below it.
    await expect(canvasElement.querySelector("[data-vector-key]")).not.toBeNull();
  },
};

export const ColouredByMagnitude: Story = {
  render: () => (
    <Frame readout={<StageReadout extra={<VectorFieldKey bare vectors={SMALL.vectors} unit="px" />} />}>
      <VectorField anchors={SMALL.anchors} vectors={SMALL.vectors} colormap={sequential} scale={{ length: 30 }} />
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    const batches = canvasElement.querySelectorAll("path[data-batch]");
    await expect(batches.length).toBeGreaterThan(8);
    await expect(new Set([...batches].map((b) => b.getAttribute("stroke"))).size).toBe(batches.length);
  },
};

/** A fixed scale zooms with the image; a screen-length scale does not. */
export const FixedScaleZoomed: Story = {
  render: () => (
    <Frame view={{ scale: 2, tx: -100, ty: -75 }}>
      <VectorField anchors={SMALL.anchors} vectors={SMALL.vectors} scale={40} color="var(--stage-model)" />
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("path[data-batch]")?.getAttribute("stroke")).toBe("var(--stage-model)");
  },
};

export const Hover: Story = {
  play: async ({ canvasElement }) => {
    hover.mockClear();
    const stage = viewport(canvasElement);
    const rect = canvasElement.querySelector("[data-stage]")!.getBoundingClientRect();
    // The anchor of vector (r=2, c=3): x = 400 · 3.5 / 20, y = 300 · 2.5 / 15.
    await fireEvent.pointerMove(stage, { clientX: rect.left + 70.5, clientY: rect.top + 50.5, pointerId: 1 });
    await expect(hover).toHaveBeenLastCalledWith(2 * 20 + 3);
    await waitFor(() => expect(canvasElement.querySelector("[data-hovered-vector]")).not.toBeNull());
    await fireEvent.pointerMove(stage, { clientX: rect.left + 79.5, clientY: rect.top + 59.5, pointerId: 1 });
    await expect(hover).toHaveBeenLastCalledWith(null);
  },
};

export const DenseField: Story = {
  render: () => (
    <Frame>
      <VectorField
        anchors={DENSE.anchors}
        vectors={DENSE.vectors}
        colormap={sequential}
        scale={{ length: 6, percentile: 1 }}
        halo={false}
      />
    </Frame>
  ),
  play: async ({ canvas, canvasElement }) => {
    // Those that would be under a screen pixel near the centre are not drawn.
    const drawn = Number(canvasElement.querySelector("svg[data-count]")?.getAttribute("data-count"));
    await expect(canvas.getByRole("img", { name: `Vectors: ${drawn} vectors` })).toBeInTheDocument();
    await expect(drawn).toBeGreaterThan(7000);
    // Eight thousand arrows are a halo and at most 24 colour steps.
    await expect(canvasElement.querySelectorAll("path").length).toBeLessThanOrEqual(25);
  },
};
