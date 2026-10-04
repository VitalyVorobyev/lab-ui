import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fireEvent, fn, waitFor } from "storybook/test";

import { Histogram } from "./Histogram";

/** A small linear-congruential generator, so the "random" values are the same on every run. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

/** `count` roughly normal values (sum of four uniforms) around `mean`. */
function samples(seed: number, count: number, mean: number, spread: number): number[] {
  const next = seeded(seed);
  return Array.from({ length: count }, () => mean + (next() + next() + next() + next() - 2) * spread);
}

/** 64 luminance counts over [0, 256): a dark mode, a bright mode and a clipped last bin. */
const LUMINANCE = Array.from({ length: 64 }, (_, bin) => {
  const x = bin / 63;
  const dark = Math.exp(-(((x - 0.22) / 0.1) ** 2)) * 90_000;
  const bright = Math.exp(-(((x - 0.7) / 0.14) ** 2)) * 60_000;
  return Math.round(dark + bright + (bin === 63 ? 25_000 : 0));
});

const meta = {
  title: "charts/Histogram",
  component: Histogram,
  parameters: {
    docs: {
      description: {
        component: `One distribution as bars over equal-width bins. Give it raw \`values\` (binned here, \`bins\`
and \`domain\` optional) or already-binned \`counts\` with their \`domain\` — the second is for a caller that
cannot hand over its samples, such as a luminance histogram of a 20 MP image.

\`markers\` tick the x axis (a decision threshold), \`bands\` shade a range, \`onHover\` reports the x under
the pointer, \`onPick\` the x of a click, and \`cursor\` highlights the bin containing an x chosen elsewhere
in the selection colour. All x values are in data units. \`variant="fluid"\` takes the container's width.

**Don't** use it for two classes with a verdict — that is \`ScoreHistogram\` — or for a handful of
categories, where \`StackedBars\` reads better. Empty data is an empty frame, not an error.

**Accessibility**: the plot is \`role="img"\` named by \`label\`. The highlighted bin differs by colour
only; put the value it stands for in \`footer\` or next to the chart. The pointer layer is a mouse and
touch affordance and has no keyboard equivalent, so anything it reveals must also exist elsewhere.`,
      },
    },
  },
  args: { label: "Anomaly scores" },
} satisfies Meta<typeof Histogram>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One population of scores with a decision threshold ticked on the axis. */
export const ValuesWithThreshold: Story = {
  args: {
    values: samples(7, 600, 0.3, 0.12),
    bins: 40,
    xLabel: "anomaly score",
    yLabel: "samples",
    markers: [{ position: 0.41, tone: "defect", label: "threshold 0.41" }],
    variant: "wide",
  },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole("img", { name: "Anomaly scores" })).toBeInTheDocument();
    await expect(canvasElement.querySelectorAll("path[data-bars]")).toHaveLength(1);
    await expect(canvasElement.querySelectorAll("[data-markers] line")).toHaveLength(1);
    await expect(canvasElement.querySelector("[data-cursor-bin]")).toBeNull();
  },
};

const pick = fn();
const hover = fn();

function LuminanceInspector() {
  const [cursor, setCursor] = useState<number | null>(40);
  return (
    <div style={{ width: 320 }}>
      <Histogram
        label="Luminance histogram"
        counts={LUMINANCE}
        domain={[0, 256]}
        variant="fluid"
        height={96}
        unit="DN"
        cursor={cursor}
        onHover={hover}
        onPick={(x) => {
          setCursor(x);
          pick(x);
        }}
      />
    </div>
  );
}

/** Pre-binned 64-bin luminance with the cursor's bin highlighted, as an image inspector shows it. */
export const PreBinnedWithCursor: Story = {
  args: { counts: LUMINANCE, domain: [0, 256] },
  render: () => <LuminanceInspector />,
  play: async ({ canvasElement }) => {
    const svg = canvasElement.querySelector("svg[role='img']")!;
    const figure = svg.closest("figure")!;
    await waitFor(() =>
      expect(svg.getAttribute("viewBox")).toBe(`0 0 ${Math.round(figure.getBoundingClientRect().width)} 96`),
    );
    // x = 40 DN of 256 is bin floor(40 * 64 / 256) = 10.
    await expect(svg.querySelector("[data-cursor-bin]")?.getAttribute("data-cursor-bin")).toBe("10");
    await expect(svg.querySelectorAll("[data-cursor-bin]")).toHaveLength(1);

    const target = svg.querySelector("[data-plot-target]")!;
    const box = target.getBoundingClientRect();
    await fireEvent.pointerMove(target, { clientX: box.left + box.width * 0.5, clientY: box.top + 2 });
    await waitFor(() => expect(hover).toHaveBeenCalled());
    const hovered = hover.mock.lastCall?.[0] as number;
    await expect(hovered).toBeGreaterThan(110);
    await expect(hovered).toBeLessThan(146);

    // A click reports the x and the cursor bin moves to it.
    await fireEvent.click(target, { clientX: box.left + box.width * 0.75, clientY: box.top + 2 });
    await expect(pick).toHaveBeenCalled();
    const picked = pick.mock.lastCall?.[0] as number;
    await waitFor(() =>
      expect(svg.querySelector("[data-cursor-bin]")?.getAttribute("data-cursor-bin")).toBe(String(Math.floor((picked * 64) / 256))),
    );

    await fireEvent.pointerLeave(target);
    await fireEvent.pointerOut(target, { relatedTarget: document.body });
    await waitFor(() => expect(hover).toHaveBeenLastCalledWith(null));
  },
};

/** A cursor outside the domain highlights nothing. */
export const CursorOutsideDomain: Story = {
  args: { counts: LUMINANCE, domain: [0, 256], cursor: 300 },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("[data-cursor-bin]")).toBeNull();
  },
};

/** Nothing measured yet: an empty frame. */
export const Empty: Story = {
  args: { values: [] },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole("img", { name: "Anomaly scores" })).toBeInTheDocument();
    await expect(canvasElement.querySelector("path[data-bars]")?.getAttribute("d")).toBe("");
  },
};

/** A long tail on a log axis, where a linear one would flatten it onto the floor. */
export const LogY: Story = {
  args: {
    values: [...samples(3, 4000, 0.2, 0.05), ...samples(9, 40, 0.7, 0.1)],
    bins: 48,
    logY: true,
    xLabel: "residual",
    unit: "px",
    yLabel: "count",
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("path[data-bars]")?.getAttribute("d")).not.toMatch(/NaN/);
  },
};
