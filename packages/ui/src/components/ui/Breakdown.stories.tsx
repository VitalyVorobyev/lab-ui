import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import { Breakdown, type BreakdownSegment, breakdownText } from "./Breakdown";
import { DensityProvider } from "./Density";

const STRINGS: BreakdownSegment[] = [
  { value: 412, tone: "normal", label: "done" },
  { value: 20, tone: "warn", label: "to check" },
  { value: 3, tone: "defect", label: "problems" },
];

/** The drawn segments, in order. */
function tones(bar: HTMLElement): (string | null)[] {
  return Array.from(bar.querySelectorAll("[data-tone]"), (segment) => segment.getAttribute("data-tone"));
}

const meta = {
  title: "ui/Breakdown",
  component: Breakdown,
  parameters: {
    docs: {
      description: {
        component: `How many things of a set are in each state, as one thin bar: 412 strings done, 20 to
check and 3 with problems out of 566, the rest still to do. A file list, a run summary or a
table cell shows it where a row of numbers would be too much to scan.

**Use** it with \`segments\` — a \`value\`, a \`tone\` and a \`label\` each — in the order they should
read, and a \`total\` when part of the set is not counted yet: the rest is drawn as empty track,
and \`remainderLabel\` names it ("to do"). Segments of 0 are left out, and a small count stays at
least 2 px wide so a single problem is not lost. \`breakdownText(segments, { total,
remainderLabel })\` gives the same counts in words, for a tooltip or a label beside the bar.

**Don't** use it for a continuous quantity or for series side by side. The tones are verdict
colours (\`normal\`, \`warn\`, \`defect\`), allowed here only because each segment counts things the
app has judged; \`neutral\` is for a category that is no verdict, such as "skipped". A single
amount done is a \`Progress\`; a share of a measurement or one series beside another is a chart.

**Accessibility**: a \`role="img"\` named with every non-zero count, "412 done, 20 to check, 3
problems, 131 to do of 566", so colour is never the only cue; \`aria-label\` or \`aria-labelledby\`
replaces the name (point \`aria-labelledby\` at the printed counts rather than having them read
twice). A neighbouring segment is set apart by a 1 px gap as well as by colour. \`data-state\` is
\`empty\`, \`partial\` or \`complete\`, and each segment carries its \`data-tone\`. The track matches
\`Progress\`: 1.5 units tall, 1 in the compact density. Width changes ease over 300 ms, and not at
all with reduced motion.`,
      },
    },
  },
  args: { segments: STRINGS, total: 566, remainderLabel: "to do", className: "w-64" },
} satisfies Meta<typeof Breakdown>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Part of the set is counted; the rest is empty track. */
export const Partial: Story = {
  play: async ({ canvas }) => {
    const bar = canvas.getByRole("img", { name: "412 done, 20 to check, 3 problems, 131 to do of 566" });
    await expect(bar).toHaveAttribute("data-state", "partial");
    await expect(tones(bar)).toEqual(["normal", "warn", "defect"]);
  },
};

/** The segments fill the total, which defaults to their sum. */
export const Complete: Story = {
  args: {
    segments: [
      { value: 540, tone: "normal", label: "done" },
      { value: 26, tone: "warn", label: "to check" },
      { value: 0, tone: "defect", label: "problems" },
    ],
    total: undefined,
  },
  play: async ({ canvas }) => {
    const bar = canvas.getByRole("img", { name: "540 done, 26 to check of 566" });
    await expect(bar).toHaveAttribute("data-state", "complete");
    // The zero segment is not drawn, and neither is a remainder.
    await expect(bar.children).toHaveLength(2);
  },
};

/** Nothing is counted yet: only the track, named by its remainder. */
export const Empty: Story = {
  args: { segments: STRINGS.map((segment) => ({ ...segment, value: 0 })) },
  play: async ({ canvas }) => {
    const bar = canvas.getByRole("img", { name: "566 to do of 566" });
    await expect(bar).toHaveAttribute("data-state", "empty");
    await expect(tones(bar)).toEqual([]);
  },
};

/** `neutral` is for a category that is no verdict, such as strings left untranslated on purpose. */
export const Neutral: Story = {
  args: { segments: [...STRINGS, { value: 40, tone: "neutral", label: "skipped" }] },
  play: async ({ canvas }) => {
    const bar = canvas.getByRole("img", { name: "412 done, 20 to check, 3 problems, 40 skipped, 91 to do of 566" });
    await expect(tones(bar)).toEqual(["normal", "warn", "defect", "neutral"]);
  },
};

/** One problem in 10,000 still shows: a non-zero count is at least 2 px wide. */
export const SmallCount: Story = {
  args: {
    segments: [
      { value: 9_000, tone: "normal", label: "done" },
      { value: 1, tone: "defect", label: "problem" },
    ],
    total: 10_000,
  },
  play: async ({ canvas }) => {
    const bar = canvas.getByRole("img", { name: "9,000 done, 1 problem, 999 to do of 10,000" });
    const problem = bar.querySelector('[data-tone="defect"]')!;
    await expect(problem.getBoundingClientRect().width).toBe(2);
  },
};

/** The counts printed beside the bar, which then names the bar. */
export const WithText: Story = {
  render: (args) => (
    <div className="flex w-96 items-center gap-3">
      <Breakdown {...args} className="w-32 shrink-0" aria-labelledby="breakdown-text" />
      <span id="breakdown-text" className="text-xs text-fg-muted">
        {breakdownText(args.segments, { total: args.total, remainderLabel: args.remainderLabel })}
      </span>
    </div>
  ),
  play: async ({ canvas }) => {
    const bar = canvas.getByRole("img", { name: "412 done, 20 to check, 3 problems, 131 to do of 566" });
    await expect(bar).not.toHaveAttribute("aria-label");
  },
};

/** An `aria-label` of your own, when the bar needs its subject in the name. */
export const AriaLabel: Story = {
  args: { "aria-label": "messages.po: 412 of 566 strings done, 3 with problems" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("img")).toHaveAccessibleName("messages.po: 412 of 566 strings done, 3 with problems");
  },
};

/** A thinner track in the compact density, as in a file list. */
export const Compact: Story = {
  decorators: [
    (Story) => (
      <DensityProvider value="compact">
        <Story />
      </DensityProvider>
    ),
  ],
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("img")).toHaveClass("h-1");
  },
};
