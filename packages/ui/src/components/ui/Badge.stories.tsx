import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import { Badge, CountRun, StatusDot, type Tone } from "./Badge";

const TONES: Tone[] = ["neutral", "normal", "defect", "unlabeled", "warning", "info"];

const meta = {
  title: "ui/Badge",
  component: Badge,
  parameters: {
    docs: {
      description: {
        component: `A short status label, coloured by a verdict tone.

**Use** a tone for what the colour *means*: \`normal\` for a normal sample or an in-tolerance
measurement, \`defect\` for a defect or an out-of-tolerance one, \`warning\` for a caveat, \`info\`
only for statements of fact about a method. \`neutral\` and \`unlabeled\` carry no verdict.
\`StatusDot\` is the same answer as a dot and a word; \`CountRun\` renders counts as a compact
\`12 normal · 9 defect\` run, skipping the zeroes.

**Don't** use a tone for decoration or emphasis — the chrome has no saturation so that a colour
on screen always means something. A badge is not interactive; don't make it a button.

**Accessibility**: colour is never the only signal — the badge's text (or the \`StatusDot\`'s
word) carries the meaning, and the dot itself is \`aria-hidden\`. A \`StatusDot\` without
children says nothing to a screen reader.`,
      },
    },
  },
  args: { children: "defect", tone: "defect" },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Neutral: Story = { args: { tone: "neutral", children: "draft" } };

export const Normal: Story = { args: { tone: "normal", children: "normal" } };

export const Defect: Story = { args: { tone: "defect", children: "defect" } };

export const Unlabeled: Story = { args: { tone: "unlabeled", children: "unlabeled" } };

export const Warning: Story = { args: { tone: "warning", children: "low contrast" } };

export const Info: Story = { args: { tone: "info", children: "anomaly maps" } };

export const AllTones: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {TONES.map((tone) => (
        <Badge key={tone} tone={tone}>
          {tone}
        </Badge>
      ))}
    </div>
  ),
};

export const StatusDots: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      {TONES.map((tone) => (
        <StatusDot key={tone} tone={tone}>
          {tone}
        </StatusDot>
      ))}
    </div>
  ),
};

export const Counts: Story = {
  render: () => (
    <CountRun
      counts={[
        ["normal", 12, "normal"],
        ["defect", 9, "defect"],
        ["unlabeled", 0, "unlabeled"],
      ]}
    />
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByText("normal")).toBeInTheDocument();
    await expect(canvas.getByText("defect")).toBeInTheDocument();
    // Zero counts are skipped.
    await expect(canvas.queryByText("unlabeled")).not.toBeInTheDocument();
  },
};

export const CountsEmpty: Story = {
  render: () => <CountRun counts={[["defect", 0, "defect"]]} />,
  play: async ({ canvas }) => {
    await expect(canvas.getByText("empty")).toBeInTheDocument();
  },
};
