import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import { Button } from "./Button";
import { Callout, Empty, ErrorBox, ProgressBar, Skeleton, SkeletonRows } from "./Feedback";

const meta = {
  title: "ui/Feedback",
  component: Callout,
  parameters: {
    docs: {
      description: {
        component: `What the screen says when it has something other than data to show.

**Use** \`Callout\` for a message in a tone (\`info\`, \`warning\`, \`error\`, \`success\`), with an
optional title and actions; \`ErrorBox\` is its common error shape. \`Empty\` is an invitation to
act, so it carries the action rather than describing it. Loading is a shape, not a word:
\`Skeleton\`/\`SkeletonRows\` for content that is on its way, \`ProgressBar\` when the fraction is known.

**Don't** apologise or stay vague in an error — say what happened and what to do. Don't put
"Loading…" text where a skeleton keeps the layout from jumping.

**Accessibility**: an \`error\` callout is \`role="alert"\` (announced at once), every other tone
is \`role="status"\`; the icon is \`aria-hidden\`. \`SkeletonRows\` is a \`status\` labelled "Loading"
and its bars are \`aria-hidden\`. \`ProgressBar\` is a \`progressbar\` with \`aria-valuenow\` in percent,
named by \`aria-label\`, else by its \`label\`, else "Progress" — name the job when a screen shows
more than one bar.`,
      },
    },
  },
  args: { children: "The calibration board was found in 18 of 20 frames." },
} satisfies Meta<typeof Callout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InfoCallout: Story = {
  args: { tone: "info" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("status")).toHaveTextContent("18 of 20 frames");
  },
};

export const WarningCallout: Story = {
  args: {
    tone: "warning",
    title: "Two frames were skipped",
    children: "The board was out of focus in frames 7 and 12.",
  },
};

export const SuccessCallout: Story = {
  args: { tone: "success", children: "Calibration saved." },
};

export const ErrorCallout: Story = {
  args: {
    tone: "error",
    title: "Detection failed",
    children: "The model file could not be read. Re-upload it and run again.",
    actions: (
      <Button size="sm" variant="secondary">
        Retry
      </Button>
    ),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent("Detection failed");
    await expect(canvas.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  },
};

export const ErrorBoxStory: Story = {
  name: "ErrorBox",
  render: () => <ErrorBox>The dataset “bolts-2024” no longer exists. Pick another one.</ErrorBox>,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent("bolts-2024");
  },
};

export const EmptyState: Story = {
  render: () => (
    <Empty action={<Button variant="primary">Upload images</Button>}>No images in this dataset yet.</Empty>
  ),
};

export const EmptyWithoutAction: Story = {
  render: () => <Empty>No measurements match this filter.</Empty>,
};

export const SkeletonBlock: Story = {
  render: () => <Skeleton className="h-24 w-64" />,
};

export const Loading: Story = {
  render: () => <SkeletonRows rows={4} />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  },
};

export const Progress: Story = {
  render: () => <ProgressBar fraction={0.42} label="42 of 100 images" />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("progressbar", { name: "42 of 100 images" })).toHaveAttribute("aria-valuenow", "42");
  },
};

export const ProgressClamped: Story = {
  render: () => <ProgressBar fraction={1.7} />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("progressbar", { name: "Progress" })).toHaveAttribute("aria-valuenow", "100");
  },
};
