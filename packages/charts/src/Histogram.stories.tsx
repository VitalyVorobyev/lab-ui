import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import { ScoreHistogram } from "./Histogram";

/** A small linear-congruential generator, so the "random" scores are the same on every run. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

/** `count` roughly normal scores (sum of four uniforms) around `mean`. */
function scores(seed: number, count: number, mean: number, spread: number): number[] {
  const next = seeded(seed);
  return Array.from({ length: count }, () => {
    const sum = next() + next() + next() + next();
    return Math.max(0, mean + (sum - 2) * spread);
  });
}

const meta = {
  title: "charts/ScoreHistogram",
  component: ScoreHistogram,
  parameters: {
    docs: {
      description: {
        component: `Anomaly-score distribution by class (normal in green, defect in red) with the decision threshold as
a dashed rule — the chart that says *why* a threshold misclassifies: two distributions that barely
separate, or a long normal tail crossing the line. Both classes share one set of bin edges over the
union of their scores, so the overlap is real rather than a binning artefact. Always \`wide\`.

**Don't** use it for more than two classes, or for a single distribution with no verdict — a plain
\`LineChart\` or a table reads better. The colours are the fixed verdict pair; the legend carries the
counts and the threshold as text.

**Accessibility**: the plot is \`role="img"\` named by \`label\`; the class counts and the threshold value
are real text in the legend, so neither depends on telling green from red.`,
      },
    },
  },
  args: {
    label: "Validation scores",
    normal: scores(7, 400, 0.22, 0.08),
    defect: scores(11, 60, 0.62, 0.12),
  },
} satisfies Meta<typeof ScoreHistogram>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Separated: Story = {
  args: { threshold: 0.41 },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole("img", { name: "Validation scores" })).toBeInTheDocument();
    await expect(canvas.getByText("normal (400)")).toBeInTheDocument();
    await expect(canvas.getByText("threshold 0.4100")).toBeInTheDocument();
    await expect(canvasElement.querySelectorAll("line[stroke-dasharray]")).toHaveLength(1);
  },
};

export const Overlapping: Story = {
  args: {
    normal: scores(3, 400, 0.3, 0.14),
    defect: scores(5, 80, 0.42, 0.14),
    threshold: 0.38,
    bins: 48,
  },
};

export const NoThreshold: Story = {
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll("line[stroke-dasharray]")).toHaveLength(0);
  },
};

/** A subset with no defects at all. */
export const NormalsOnly: Story = {
  args: { defect: [], threshold: 0.41 },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("defect (0)")).toBeInTheDocument();
  },
};

/** Nothing scored yet. */
export const Empty: Story = {
  args: { normal: [], defect: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("img", { name: "Validation scores" })).toBeInTheDocument();
  },
};
