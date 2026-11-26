import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fireEvent, fn, waitFor } from "storybook/test";

import { ScatterChart, type ScatterPick, type ScatterSeries } from "./ScatterChart";

/** A deterministic pseudo-random sequence in [0, 1), so stories and screenshots do not change. */
function rng(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/** Residuals against distance from the centre: a slow trend plus noise, with a signed `value`. */
function residuals(count: number, seed: number, shift = 0): ScatterSeries["points"] {
  const next = rng(seed);
  return Array.from({ length: count }, () => {
    const r = next();
    const noise = next() + next() + next() - 1.5;
    const y = 0.12 * r * r + shift + 0.08 * noise;
    return { x: 800 * r, y, value: 0.4 * (next() - 0.5) + 0.5 * (r - 0.5) };
  });
}

const RUN_A: ScatterSeries = { name: "run A", points: residuals(160, 7) };
const RUN_B: ScatterSeries = { name: "run B", points: residuals(160, 19, 0.05) };

const meta = {
  title: "charts/ScatterChart",
  component: ScatterChart,
  parameters: {
    docs: {
      description: {
        component: `Points over two numeric axes — a residual against position, one measurement against another. It composes the
same frame, axes, palette and variants as \`LineChart\` and \`Histogram\`.

- **Series:** each \`ScatterSeries\` is a name, its points and an optional colour; the legend names them. A point with a
  non-finite coordinate is skipped.
- **\`colourBy\`:** colours each point by its \`value\` through a map, with the scale in the footer. A diverging map is centred on
  zero by default. A point with no value is muted.
- **\`referenceLines\`:** dashed rules at a value of either axis — a tolerance, a mean — with a label and a tone.
- **Pointer:** \`onHover\` rings the nearest point (within 10 plot units) and reads its numbers; \`onPick\` reports a click's point;
  \`highlighted\` rings one chosen elsewhere, such as a hovered table row.
- **Drawing:** a few batched paths (one per series, or per colour step), a thin surface-coloured outline under each marker so
  overlapping points stay apart.

**Use** it to look for structure between two quantities. **Don't** use it for a signal sampled along one axis (that is
\`LineChart\` or \`LineProfile\`) or for a distribution (\`Histogram\`).

**Accessibility**: the SVG is \`role="img"\` named by \`label\` (required); the legend or colour scale is real text below the plot.
Picking is by pointer only, so put the same points in a table beside the chart.`,
      },
    },
  },
  args: { label: "Residuals against radius", xLabel: "radius (px)", yLabel: "residual (px)", series: [RUN_A] },
} satisfies Meta<typeof ScatterChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Single: Story = {
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole("img", { name: "Residuals against radius" })).toBeInTheDocument();
    await expect(canvas.getByText("run A")).toBeInTheDocument();
    await expect(canvasElement.querySelectorAll("path[data-batch]")).toHaveLength(1);
  },
};

export const TwoSeries: Story = {
  args: { series: [RUN_A, RUN_B] },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvasElement.querySelectorAll("path[data-batch]")).toHaveLength(2);
    await expect(canvas.getByText("run B")).toBeInTheDocument();
  },
};

export const ColouredByValue: Story = {
  args: {
    series: [RUN_A],
    colourBy: { map: "blueOrange", label: "Signed shift", unit: "px" },
  },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByText("Signed shift")).toBeInTheDocument();
    await expect(canvasElement.querySelector("[data-colormap='blueOrange']")).not.toBeNull();
    await expect(canvasElement.querySelectorAll("path[data-batch]").length).toBeGreaterThan(4);
  },
};

export const SequentialColour: Story = {
  args: {
    series: [{ name: "run A", points: RUN_A.points.map((p) => ({ ...p, value: Math.abs(p.y) })) }],
    colourBy: { map: "viridis", label: "Residual", unit: "px" },
  },
};

export const ReferenceLines: Story = {
  args: {
    series: [RUN_A, RUN_B],
    referenceLines: [
      { axis: "y", value: 0.2, label: "tolerance", tone: "defect" },
      { axis: "y", value: 0, label: "ideal" },
      { axis: "x", value: 600, label: "edge of use" },
    ],
  },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvasElement.querySelectorAll("[data-reference-line]")).toHaveLength(3);
    await expect(canvas.getByText("tolerance")).toBeInTheDocument();
  },
};

export const Fluid: Story = {
  args: { variant: "fluid", height: 180 },
  decorators: [
    (Story) => (
      <div style={{ width: 360 }}>
        <Story />
      </div>
    ),
  ],
};

const hovered = fn();
const picked = fn();

function Interactive() {
  const [row, setRow] = useState<ScatterPick | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <ScatterChart
        label="Residuals against radius"
        xLabel="radius (px)"
        yLabel="residual (px)"
        series={[RUN_A, RUN_B]}
        onHover={(point) => {
          hovered(point);
          setRow(point);
        }}
        onPick={picked}
      />
      <output data-testid="row" className="font-mono text-xs text-fg-muted">
        {row ? `${row.series} at ${row.index}` : "none"}
      </output>
    </div>
  );
}

/** Moving over the plot rings the nearest point and reads its numbers; a click reports it. */
export const HoverAndPick: Story = {
  render: () => <Interactive />,
  play: async ({ canvas, canvasElement }) => {
    hovered.mockClear();
    picked.mockClear();
    const target = canvasElement.querySelector<SVGRectElement>("[data-plot-target]")!;
    // The first point of run A, found from the rendered marker: the batch path starts with its position.
    const first = canvasElement
      .querySelector("path[data-batch]")!
      .getAttribute("d")!
      .match(/M([\d.]+) ([\d.]+)/)!;
    const svg = target.ownerSVGElement!;
    const ctm = svg.getScreenCTM()!;
    const client = new DOMPoint(Number(first[1]), Number(first[2])).matrixTransform(ctm);
    await fireEvent.pointerMove(target, { clientX: client.x, clientY: client.y, pointerId: 1 });
    await waitFor(() => expect(canvas.getByTestId("row")).toHaveTextContent("run A at 0"));
    await expect(canvasElement.querySelector("[data-highlight]")).not.toBeNull();
    await expect(canvasElement.querySelector("[data-readout]")).not.toBeNull();
    await fireEvent.click(target, { clientX: client.x, clientY: client.y });
    await expect(picked).toHaveBeenCalledWith(expect.objectContaining({ series: "run A", index: 0 }));
    // React's onPointerLeave is driven by `pointerout`.
    await fireEvent.pointerOut(target, { relatedTarget: document.body });
    await waitFor(() => expect(canvas.getByTestId("row")).toHaveTextContent("none"));
    await expect(canvasElement.querySelector("[data-highlight]")).toBeNull();
  },
};

export const HighlightedFromOutside: Story = {
  args: { series: [RUN_A, RUN_B], highlighted: { series: "run B", index: 3 } },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("[data-highlight]")).not.toBeNull();
  },
};
