import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import type { ValuePlane } from "../api/mapValues";
import { ContourLayer } from "./ContourLayer";
import { ImageStage } from "./stage/ImageStage";
import type { StageView } from "./stage/view";

const IMAGE = { width: 400, height: 300 };
const VIEW: StageView = { scale: 1, tx: 0, ty: 0 };

/** A 100 x 75 field of a radial distortion, in px: two lobes, a negative one and a positive one, zero between. */
function distortion(hole = false): ValuePlane {
  const width = 100;
  const height = 75;
  const values = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = 1.4 * Math.exp(-(((x - 30) / 18) ** 2 + ((y - 35) / 16) ** 2));
      const b = -1.0 * Math.exp(-(((x - 72) / 16) ** 2 + ((y - 40) / 18) ** 2));
      values[y * width + x] = hole && x > 44 && x < 56 && y > 20 && y < 52 ? Number.NaN : a + b;
    }
  }
  return { width, height, stride: 1, channels: 1, values };
}

const PLANE = distortion();
const HOLED = distortion(true);

/** A 2 x 2 saddle blown up to 40 x 30 nodes: x * y around the centre. */
const SADDLE: ValuePlane = (() => {
  const width = 40;
  const height = 30;
  const values = new Float32Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) values[y * width + x] = ((x - 19.5) * (y - 14.5)) / 100;
  return { width, height, stride: 1, channels: 1, values };
})();

function Frame({ children, view = VIEW }: { children: React.ReactNode; view?: StageView }) {
  return (
    <ImageStage image={IMAGE} view={view} onView={() => {}} style={{ width: IMAGE.width + 2, height: IMAGE.height + 2 }}>
      <div className="absolute inset-0 bg-canvas" />
      {children}
    </ImageStage>
  );
}

const meta = {
  title: "stage2d/ContourLayer",
  component: ContourLayer,
  parameters: {
    docs: {
      description: {
        component: `Iso-lines of a scalar field over the image: the level sets of a distortion map, a residual field, the boundary
of the region a calibration supports. They are found by marching squares over the plane's nodes (the pixel centres), linear along
the cell edges, and drawn as one path per style (a halo, the solid levels, the dashed ones), stroked at a constant screen width.

- **Field:** \`plane\` and \`channel\`, as for \`HeatmapLayer\`; the same plane in both lines up. \`rect\` places it as the
  heatmap's does. \`NaN\` is "no data".
- **Levels:** a list, or \`{ step, origin? }\` for every multiple of \`step\` in the finite range (a step that gives more than 64 levels is
  widened by whole multiples). Lines are recomputed when \`plane\`, \`channel\` or the levels change, not on pan or zoom: pass a stable plane.
- **\`dashedLevels\`:** levels drawn dashed (a significance threshold, zero). They are drawn even when \`levels\` lacks them.
- **\`labels\`:** the level written on the line, horizontal, on lines at least 90 screen pixels long (again every 280), inside the
  viewport, at most 200.
- **Holes:** a cell touching a \`NaN\` node holds no line, so a line ends at a hole and never bridges it. Where the four corners of a
  cell disagree (a saddle) the mean of the four decides which pair is joined.
- **Colour:** the \`structure\` role by default, or \`role\` / \`color\`. Lines sit over a halo (\`halo={false}\` drops it).

**Use** it to read a map's shape beside its colours: where it crosses zero, where it passes a tolerance. **Don't** use it for a
magnitude map on its own (that is \`HeatmapLayer\`) or for a handful of drawn curves (that is \`PolylineSet\`).

**Accessibility**: the layer is a named image with the line count and the first levels ("Contours: 6 lines at 0.5, 1, …") and takes
no pointer or keyboard input. The levels are available as text through \`labels\` or a colour legend beside the stage; read exact
numbers from the plane.`,
      },
    },
  },
  args: { plane: PLANE, levels: { step: 0.5 } },
  render: (args) => (
    <Frame>
      <ContourLayer {...args} />
    </Frame>
  ),
} satisfies Meta<typeof ContourLayer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole("img", { name: /^Contours: \d+ lines at / })).toBeInTheDocument();
    await expect(canvasElement.querySelectorAll("path[data-contours]")).toHaveLength(1);
    await expect(Number(canvasElement.querySelector("svg[data-count]")!.getAttribute("data-count"))).toBeGreaterThanOrEqual(4);
  },
};

/** Zero is the finding: dashed, with the step lines solid, and every line labelled. */
export const DashedZeroWithLabels: Story = {
  args: { levels: { step: 0.5 }, dashedLevels: [0], labels: (v: number) => `${v > 0 ? "+" : ""}${v} px` },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvasElement.querySelector("path[data-contours='dashed']")).not.toBeNull();
    await expect(canvasElement.querySelector("path[data-contours='solid']")).not.toBeNull();
    await expect(canvas.getAllByText("+0.5 px").length).toBeGreaterThan(0);
  },
};

/** A significance threshold that is not on the step. */
export const ThresholdOffTheStep: Story = {
  args: { levels: [-0.5, 0.5, 1], dashedLevels: [0.35], role: "model" },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("svg[data-count]")!.getAttribute("data-levels")).toBe("-0.5,0.35,0.5,1");
    await expect(canvasElement.querySelector("path[data-contours='dashed']")).not.toBeNull();
  },
};

/** The lines end at the hole; none crosses it. */
export const HoleInTheData: Story = {
  args: { plane: HOLED, levels: [0.25, 0.75], labels: true },
  play: async ({ canvasElement }) => {
    const d = canvasElement.querySelector("path[data-contours='solid']")!.getAttribute("d")!;
    // The hole covers nodes x 45..55, y 21..51 of a 100 x 75 plane at 4 px a node: image x ~ 180..220, y ~ 84..204.
    for (const [x, y] of [...d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])] as const)) {
      await expect(x > 182 && x < 218 && y > 86 && y < 202).toBe(false);
    }
  },
};

/** A saddle: the two crossing zero lines meet in the middle without merging. */
export const Saddle: Story = {
  args: { plane: SADDLE, levels: [-0.5, 0, 0.5], dashedLevels: [0], labels: true },
  play: async ({ canvasElement }) => {
    await expect(Number(canvasElement.querySelector("svg[data-count]")!.getAttribute("data-count"))).toBeGreaterThanOrEqual(4);
  },
};

/** Placed over a part of the image, as a heatmap of the same plane would be. */
export const Placed: Story = {
  args: { rect: { x: 100, y: 75, width: 200, height: 150 }, levels: [0.5, 1] },
  play: async ({ canvasElement }) => {
    const d = canvasElement.querySelector("path[data-contours='solid']")!.getAttribute("d")!;
    for (const m of d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)) {
      await expect(Number(m[1])).toBeGreaterThanOrEqual(100);
      await expect(Number(m[1])).toBeLessThanOrEqual(300);
    }
  },
};

/** Zoomed in: the strokes and the labels keep their screen size, the lines are as sharp as the plane. */
export const Zoomed: Story = {
  render: (args) => (
    <Frame view={{ scale: 3, tx: -100, ty: -60 }}>
      <ContourLayer {...args} />
    </Frame>
  ),
  args: { levels: [0.5, 1], dashedLevels: [0], labels: true },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("[data-labels]")).not.toBeNull();
  },
};

export const Hidden: Story = {
  args: { visible: false },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("svg[data-count]")).toBeNull();
  },
};

/** A level the field never reaches draws nothing, and says so in its name. */
export const NoLinesAtTheseLevels: Story = {
  args: { levels: [10] },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("img", { name: "Contours: 0 lines at 10" })).toBeInTheDocument();
  },
};
