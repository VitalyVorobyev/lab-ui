import type { Meta, StoryObj } from "@storybook/react-vite";
import { ColormapLegend, colormapRgb, symmetricDomain, type ColormapName } from "@vitavision/charts";
import { HeatmapLayer, ImageStage, StageReadout, VectorField, VectorFieldKey, type StageView, type ValuePlane } from "@vitavision/stage2d";
import { expect, waitFor } from "storybook/test";

/**
 * A scalar field and a vector field drawn over one image, with their scales beside the stage:
 * the way a map of values and the direction of a displacement are read together. Nothing here
 * is specific to one kind of data.
 */

const IMAGE = { width: 480, height: 360 };
const VIEW: StageView = { scale: 1, tx: 0, ty: 0 };
const STAGE = { width: IMAGE.width + 2, height: IMAGE.height + 2 };

/** A signed field on a 96×72 grid: a ridge through the centre and a trough toward one corner. */
function signedField(): ValuePlane {
  const width = 96;
  const height = 72;
  const values = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = (x - width / 2) / (width / 2);
      const v = (y - height / 2) / (height / 2);
      const ridge = 0.3 * Math.exp(-((u * 1.4) ** 2 + (v * 0.9) ** 2) * 2.5);
      const trough = -0.22 * Math.exp(-(((u + 0.7) * 2.2) ** 2 + ((v - 0.6) * 2.2) ** 2));
      values[y * width + x] = ridge + trough;
    }
  }
  return { width, height, stride: 1, channels: 1, values };
}

/** A displacement on a 24×18 lattice: outward from the centre, plus a gentle turn. */
function displacement() {
  const cols = 24;
  const rows = 18;
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
      vectors[2 * k] = 0.12 * u * (1 + u * u) - 0.05 * v;
      vectors[2 * k + 1] = 0.12 * v * (1 + v * v) + 0.05 * u;
    }
  }
  return { anchors, vectors };
}

const PLANE = signedField();
/** The same field's size, for a map of magnitude. */
const MAGNITUDE: ValuePlane = { ...PLANE, values: PLANE.values.map(Math.abs) };
const FIELD = displacement();

/** A stand-in photograph: a dark ground with a faint grid, so the overlays have something to sit on. */
function Backdrop() {
  return (
    <div
      className="absolute inset-0 bg-canvas"
      style={{
        backgroundImage:
          "repeating-linear-gradient(0deg, rgb(255 255 255 / 0.05) 0 1px, transparent 1px 30px), repeating-linear-gradient(90deg, rgb(255 255 255 / 0.05) 0 1px, transparent 1px 30px)",
      }}
    />
  );
}

function Composition({ map, symmetric, plane }: { map: ColormapName; symmetric: boolean; plane: ValuePlane }) {
  const range = (() => {
    let low = Infinity;
    let high = -Infinity;
    for (const v of plane.values) {
      if (v < low) low = v;
      if (v > high) high = v;
    }
    const [a, b] = symmetric ? symmetricDomain([low, high]) : [low, high];
    return { low: a, high: b };
  })();
  return (
    <div className="flex items-start gap-4">
      <ImageStage
        image={IMAGE}
        view={VIEW}
        onView={() => {}}
        readout={<StageReadout extra={<VectorFieldKey bare vectors={FIELD.vectors} unit="px" />} />}
        style={STAGE}
      >
        <Backdrop />
        <HeatmapLayer plane={plane} colormap={(t) => colormapRgb(map, t)} range={range} opacity={0.8} alt="Field of values" />
        <VectorField anchors={FIELD.anchors} vectors={FIELD.vectors} role="label" label="Displacement" />
      </ImageStage>
      <ColormapLegend
        map={map}
        domain={[range.low, range.high]}
        symmetric={symmetric}
        label={symmetric ? "Signed value" : "Magnitude"}
        unit="px"
        orientation="vertical"
        length={200}
        ticks={5}
      />
    </div>
  );
}

const meta = {
  title: "Compositions/Field over an image",
  parameters: {
    docs: {
      description: {
        component: `A scalar map and a vector field over one image, with their scales beside the stage.

- \`HeatmapLayer\` draws the values through any \`(t) => rgb\` map from \`@vitavision/charts\`, over a range centred on zero
  (\`symmetricDomain\`) for a signed quantity.
- \`ColormapLegend\` stands vertical beside the stage with the same map and range, ticked at round values, and \`symmetric\` keeps the
  neutral middle at zero.
- \`VectorField\` draws the displacement over it as arrows at one tone; \`VectorFieldKey\` in the stage's readout gives the arrow's length in data units.

The layers are in drawing order: the heatmap under the arrows, both under the stage's own toolbar and readout.`,
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const SignedField: Story = {
  render: () => <Composition map="blueOrange" symmetric plane={PLANE} />,
  play: async ({ canvas, canvasElement }) => {
    await waitFor(() => expect(canvasElement.querySelector("img[data-heatmap][data-ready]")).not.toBeNull(), { timeout: 5000 });
    await expect(canvas.getByRole("img", { name: /^Displacement: \d+ vectors$/ })).toBeInTheDocument();
    await expect(canvasElement.querySelector("[data-colormap='blueOrange'][data-orientation='vertical']")).not.toBeNull();
    await expect(canvasElement.querySelector("[data-vector-key]")).not.toBeNull();
    await expect(canvas.getByText("0")).toBeInTheDocument();
  },
};

export const MagnitudeField: Story = {
  render: () => <Composition map="magma" symmetric={false} plane={MAGNITUDE} />,
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(canvasElement.querySelector("img[data-heatmap][data-ready]")).not.toBeNull(), { timeout: 5000 });
    await expect(canvasElement.querySelector("[data-colormap='magma']")).not.toBeNull();
  },
};
