import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fireEvent, fn, waitFor } from "storybook/test";

import { LineProfile, type ProfileSeries } from "./LineProfile";

/**
 * Intensity along a scan line crossing a bright stripe: a smooth step up at `rise`, down at
 * `fall`, with a deterministic texture on the plateau.
 */
function stripe(name: string, rise: number, fall: number, phase: number): ProfileSeries {
  return {
    name,
    points: Array.from({ length: 121 }, (_, index) => {
      const x = index * 0.5;
      const up = 1 / (1 + Math.exp(-(x - rise) * 2.2));
      const down = 1 / (1 + Math.exp((x - fall) * 2.2));
      const texture = 4 * Math.sin(x * 1.3 + phase) + 2 * Math.cos(x * 3.1 + phase);
      return { x, y: 28 + 190 * up * down + texture };
    }),
  };
}

const ROW_40 = stripe("row 40", 18.2, 41.6, 0);
const ROW_41 = stripe("row 41", 18.5, 41.3, 0.8);
const ROW_42 = stripe("row 42", 18.9, 41.1, 1.9);

const meta = {
  title: "charts/LineProfile",
  component: LineProfile,
  parameters: {
    docs: {
      description: {
        component: `A 1-D profile — intensity (or any value) against arc length in pixels along a scan line or a caliper
axis — with the positions where a decision landed (a detected edge, a caliper's chosen crossing) drawn
as dashed vertical rules, each with an optional label and a measurement tone. Same \`Frame\` and scales
as every other chart here; defaults to the \`wide\` variant. The legend appears only when there is more
than one series to tell apart.

**Don't** use it for a metric over training steps (\`LineChart\`), or to show the scan line itself —
that belongs on the image, in \`@vitavision/stage2d\`.

**Accessibility**: the plot is \`role="img"\` named by \`label\`. Edge labels are SVG text inside that
image, so they are not read out separately — state the measured positions in the surrounding text.`,
      },
    },
  },
  args: { label: "Stripe profile", series: [ROW_40] },
} satisfies Meta<typeof LineProfile>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SingleSeries: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("img", { name: "Stripe profile" })).toBeInTheDocument();
    // One series has nothing to distinguish, so no legend.
    await expect(canvas.queryByText("row 40")).toBeNull();
  },
};

export const MultiSeries: Story = {
  args: { series: [ROW_40, ROW_41, ROW_42] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("row 42")).toBeInTheDocument();
  },
};

/** Detected edges, in the measurement tones. */
export const WithEdges: Story = {
  args: {
    series: [ROW_40],
    edges: [
      { position: 18.2, label: "rise 18.2", tone: "signal" },
      { position: 41.6, label: "fall 41.6", tone: "normal" },
      { position: 52.0, label: "rejected", tone: "defect" },
    ],
    yLabel: "intensity",
  },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvasElement.querySelectorAll("line[stroke-dasharray]")).toHaveLength(3);
    await expect(canvas.getByText("rise 18.2")).toBeInTheDocument();
  },
};

/** A rule with no label, and one outside the sampled range (the axis extends to include it). */
export const UnlabelledEdges: Story = {
  args: {
    series: [ROW_40, ROW_41],
    edges: [{ position: 18.4 }, { position: 64, tone: "warn" }],
  },
};

/** The `panel` variant, for a two-column grid. */
export const Panel: Story = {
  args: {
    variant: "panel",
    series: [ROW_40, ROW_41],
    edges: [{ position: 18.2, label: "edge", tone: "signal" }],
  },
};

export const SinglePoint: Story = {
  args: { series: [{ name: "s", points: [{ x: 0, y: 5 }] }] },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll("circle")).toHaveLength(1);
  },
};

export const Empty: Story = {
  args: { series: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("arc length (px)")).toBeInTheDocument();
  },
};

/**
 * A caliper profile as an inspector shows it: fluid width, the canvas's pointer as a cursor,
 * the gap between two edges as a band, sample positions ticked, hover and click reading back.
 */
function LinkedProfile() {
  const [picked, setPicked] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  return (
    <div style={{ width: 520 }}>
      <LineProfile
        series={[ROW_40]}
        label="Caliper 3 profile"
        variant="fluid"
        height={180}
        edges={[
          { position: 18.2, label: "rise", tone: "normal" },
          { position: 41.6, label: "fall", tone: "normal" },
        ]}
        bands={[{ from: 18.2, to: 41.6, label: "width 23.4 px", tone: "signal" }]}
        markers={[10, 20, 30, 40, 50].map((position) => ({ position, label: `sample ${position}` }))}
        cursor={picked ?? 30}
        onHover={(x) => {
          setHovered(x);
          hover(x);
        }}
        onPick={(x) => {
          setPicked(x);
          pick(x);
        }}
      />
      <output data-testid="hovered">{hovered === null ? "none" : hovered.toFixed(1)}</output>
    </div>
  );
}

const hover = fn();
const pick = fn();

export const Interactive: Story = {
  render: () => <LinkedProfile />,
  play: async ({ canvasElement }) => {
    const svg = canvasElement.querySelector("svg[role='img']")!;
    // Fluid: the viewBox is the container's own width, so text is drawn at its true size.
    const figure = svg.closest("figure")!;
    await waitFor(() =>
      expect(svg.getAttribute("viewBox")).toBe(`0 0 ${Math.round(figure.getBoundingClientRect().width)} 180`),
    );
    await expect(svg.querySelectorAll("[data-bands] rect")).toHaveLength(1);
    await expect(svg.querySelectorAll("[data-markers] line")).toHaveLength(5);
    // The external cursor is drawn without hovering.
    await expect(svg.querySelector("[data-crosshair]")).not.toBeNull();
    const target = svg.querySelector("[data-plot-target]")!;
    const box = target.getBoundingClientRect();
    await fireEvent.pointerMove(target, { clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 });
    await waitFor(() => expect(svg.querySelector("[data-readout]")).not.toBeNull());
    await expect(svg.querySelector("[data-readout]")!.textContent).toMatch(/row 40/);
    await expect(hover).toHaveBeenCalled();
    await fireEvent.click(target, { clientX: box.left + 2, clientY: box.top + 4 });
    await expect(pick).toHaveBeenCalled();
    // A pointer outside the domain reads back clamped to it.
    await expect(pick.mock.lastCall?.[0]).toBeGreaterThanOrEqual(0);
    await fireEvent.pointerLeave(target);
    await fireEvent.pointerOut(target, { relatedTarget: document.body });
    await waitFor(() => expect(hover).toHaveBeenLastCalledWith(null));
  },
};
