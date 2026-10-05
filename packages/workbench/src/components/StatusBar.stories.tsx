import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";

import { Button, DensityProvider, ProgressBar } from "@vitavision/ui";

import { AppShell } from "./AppShell";
import { StatusBar, type StatusBarProps } from "./StatusBar";

/** The bar at the width of a small app window, with the bottom slot's own border and surface. */
function Frame(args: StatusBarProps) {
  return (
    <div style={{ width: 720 }} className="border-t border-line bg-surface">
      <StatusBar {...args} />
    </div>
  );
}

const meta = {
  title: "workbench/StatusBar",
  component: StatusBar,
  parameters: {
    docs: {
      description: {
        component: `The status line along the foot of a studio app, for \`AppShell\`'s \`bottom\` slot: one 24 px row with
a \`ReadoutStrip\` of \`start\` facts at the left end, one of \`end\` facts at the right end, and \`children\`
between them — a \`ProgressBar\` while an operation runs. Items are \`ReadoutItem\`s (\`{ label?, value, href?,
link? }\`), and an item whose \`value\` is \`null\` or \`undefined\` is skipped, so a fact that is not known yet
needs no condition around it.

**Use** it for the few facts about what the app is doing and showing — the last operation's duration, the
current frame, the model in use.

**Don't** use it for controls (that is the header or a toolbar), for messages a person must act on (that is a
toast or a \`Callout\`), or for more facts than fit one line: it does not wrap.

**Accessibility**: a \`role="group"\` named by \`aria-label\` ("Status"). With \`live\` it is a \`role="status"\`
instead, a polite live region, so a screen reader reads out what changes in it; keep \`live\` for changes
worth hearing (an operation finished), not for a value that changes many times a second.`,
      },
    },
  },
  args: {
    start: [
      { label: "frame", value: "dome_0003.bmp" },
      { label: "model", value: "ring-12" },
    ],
  },
  render: (args) => <Frame {...args} />,
} satisfies Meta<typeof StatusBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const StartOnly: Story = {
  play: async ({ canvas }) => {
    const bar = canvas.getByRole("group", { name: "Status" });
    await expect(within(bar).getAllByRole("listitem")).toHaveLength(2);
    await expect(bar).toHaveTextContent("dome_0003.bmp");
  },
};

/** Facts at both ends; an item without a value (no last run yet) is skipped. */
export const StartAndEnd: Story = {
  args: {
    end: [
      { label: "last run", value: undefined },
      { value: "1920×1080" },
      { label: "zoom", value: "125%" },
    ],
  },
  play: async ({ canvas }) => {
    const [start, end] = canvas.getAllByRole("list");
    await expect(within(start!).getAllByRole("listitem")).toHaveLength(2);
    await expect(within(end!).getAllByRole("listitem")).toHaveLength(2);
    await expect(end).not.toHaveTextContent("last run");
    // The end strip sits at the bar's right end (measured only where the stylesheet is loaded).
    const bar = canvas.getByRole("group", { name: "Status" });
    if (getComputedStyle(bar).display === "flex") {
      const gap = bar.getBoundingClientRect().right - end!.getBoundingClientRect().right;
      await expect(gap).toBeLessThanOrEqual(12);
    }
  },
};

/** An operation in progress, drawn between the two ends. */
export const WithProgress: Story = {
  args: {
    end: [{ label: "detecting", value: "42 / 100" }],
    children: <ProgressBar fraction={0.42} aria-label="Detecting" className="w-40" />,
  },
  play: async ({ canvas }) => {
    const bar = canvas.getByRole("group", { name: "Status" });
    await expect(within(bar).getByRole("progressbar", { name: "Detecting" })).toHaveAttribute("aria-valuenow", "42");
  },
};

function LiveStatus() {
  const [lastRun, setLastRun] = useState<string | undefined>(undefined);
  return (
    <div style={{ width: 720 }} className="flex flex-col gap-3">
      <Button size="sm" className="w-fit" onClick={() => setLastRun("38 ms")}>
        Detect
      </Button>
      <div className="border-t border-line bg-surface">
        <StatusBar
          live
          start={[{ label: "frame", value: "dome_0003.bmp" }]}
          end={[{ label: "last run", value: lastRun }]}
        />
      </div>
    </div>
  );
}

/** A live bar: the screen reader hears "last run 38 ms" when the run finishes. */
export const Live: Story = {
  render: () => <LiveStatus />,
  play: async ({ canvas }) => {
    const bar = canvas.getByRole("status", { name: "Status" });
    await expect(bar).toHaveAttribute("aria-live", "polite");
    await expect(bar).toHaveAttribute("data-live");
    await expect(bar).not.toHaveTextContent("last run");
    await userEvent.click(canvas.getByRole("button", { name: "Detect" }));
    await expect(bar).toHaveTextContent("last run38 ms");
  },
};

/** In `AppShell`'s `bottom` slot, across the whole width. */
export const InAppShell: Story = {
  render: () => (
    <DensityProvider value="compact">
      <div style={{ width: 900, height: 320 }} className="overflow-hidden rounded-panel border border-line">
        <AppShell
          className="h-full"
          header={<div className="flex h-9 items-center px-3 text-sm font-semibold tracking-tight">Inspection</div>}
          left={<div className="p-3 text-sm">Navigator</div>}
          main={<div className="grid h-full place-items-center bg-raised text-xs text-fg-muted">Canvas</div>}
          bottom={
            <StatusBar
              start={[
                { label: "frame", value: "dome_0003.bmp" },
                { label: "model", value: "ring-12" },
              ]}
              end={[
                { label: "last run", value: "38 ms" },
                { value: "1920×1080" },
              ]}
            />
          }
        />
      </div>
    </DensityProvider>
  ),
  play: async ({ canvas }) => {
    const bar = canvas.getByRole("group", { name: "Status" });
    await expect(bar).toHaveTextContent("38 ms");
    // The bar is outside the main landmark: the shell's foot.
    await expect(canvas.getByRole("main")).not.toContainElement(bar);
  },
};
