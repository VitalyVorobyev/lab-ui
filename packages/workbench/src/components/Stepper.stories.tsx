import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";

import { Stepper, type StepperProps, type StepperStep } from "./Stepper";

const change = fn();

/** Teach a model, find it in the images, verify the finds. */
const OPEN: StepperStep[] = [
  { id: "teach", label: "Teach" },
  { id: "find", label: "Find" },
  { id: "verify", label: "Verify" },
];

/** Nothing taught yet: Find and Verify wait on what comes before them. */
const GATED: StepperStep[] = [
  { id: "teach", label: "Teach" },
  { id: "find", label: "Find", blockedBy: "Teach a model first." },
  { id: "verify", label: "Verify", blockedBy: "Run Find first." },
];

/** The stepper as an app wires it: the app owns the current step. */
function Controlled(args: StepperProps) {
  const [value, setValue] = useState(args.value);
  return (
    <Stepper
      {...args}
      value={value}
      onValueChange={(id) => {
        setValue(id);
        change(id);
      }}
    />
  );
}

const meta = {
  title: "workbench/Stepper",
  component: Stepper,
  parameters: {
    docs: {
      description: {
        component: `The steps of a gated sequence — Teach, then Find, then Verify — numbered, with the current one marked
and done ones checked. \`steps\` are \`{ id, label, blockedBy?, complete? }\`; the current step is \`value\` /
\`onValueChange\`, or kept by the stepper from \`defaultValue\` (the first step by default). A step with a
\`blockedBy\` reason cannot be entered yet, and says why. \`orientation\` lays the steps in a row (the default)
or a column. \`stepStates\` is the rule on its own: each step's state and whether it can be chosen.

**Use** it where the parts of a task must happen in order and a later one depends on an earlier one's result.

**Don't** use it for parts a person may do in any order (that is \`Tabs\`), for switching workspaces (that is
\`NavRail\`), or for progress through a running operation (that is a \`ProgressBar\`).

**Accessibility**: an ordered list of buttons, each its own Tab stop; the current step has
\`aria-current="step"\`. A blocked step stays focusable, carries \`aria-disabled="true"\` and is described by
its reason (\`aria-describedby\`), which its tooltip also shows on hover or focus; choosing it does nothing.
The marker (number, check or lock) is decoration, and each step carries \`data-state\` (\`current\`,
\`complete\`, \`blocked\` or \`upcoming\`).`,
      },
    },
  },
  args: { steps: OPEN, value: "teach", onValueChange: change, "aria-label": "Inspection steps" },
  render: (args) => <Controlled {...args} />,
} satisfies Meta<typeof Stepper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    change.mockClear();
    const teach = canvas.getByRole("button", { name: "Teach" });
    await expect(teach).toHaveAttribute("aria-current", "step");
    await expect(teach).toHaveAttribute("data-state", "current");
    await expect(canvas.getByRole("button", { name: "Find" })).toHaveAttribute("data-state", "upcoming");
    await userEvent.click(canvas.getByRole("button", { name: "Verify" }));
    await expect(change).toHaveBeenLastCalledWith("verify");
    await expect(canvas.getByRole("button", { name: "Verify" })).toHaveAttribute("aria-current", "step");
    // The current step again is not a change.
    await userEvent.click(canvas.getByRole("button", { name: "Verify" }));
    await expect(change).toHaveBeenCalledTimes(1);
  },
};

/** Find and Verify wait on what comes before them; each says why, and choosing it does nothing. */
export const Blocked: Story = {
  args: { steps: GATED },
  play: async ({ canvas, canvasElement }) => {
    change.mockClear();
    const find = canvas.getByRole("button", { name: "Find" });
    await expect(find).toHaveAttribute("aria-disabled", "true");
    await expect(find).toHaveAttribute("data-state", "blocked");
    await expect(find).toHaveAccessibleDescription("Teach a model first.");
    await userEvent.click(find);
    await expect(change).not.toHaveBeenCalled();
    await expect(canvas.getByRole("button", { name: "Teach" })).toHaveAttribute("aria-current", "step");

    // Still a Tab stop, and the reason is its tooltip on focus.
    canvas.getByRole("button", { name: "Teach" }).focus();
    await userEvent.tab();
    await expect(find).toHaveFocus();
    const tooltip = await within(canvasElement.ownerDocument.body).findByRole("tooltip");
    await expect(tooltip).toHaveTextContent("Teach a model first.");
    await userEvent.keyboard("{Enter}");
    await expect(change).not.toHaveBeenCalled();
  },
};

/** Teach and Find done, Verify current. */
export const Completed: Story = {
  args: {
    value: "verify",
    steps: [
      { id: "teach", label: "Teach", complete: true },
      { id: "find", label: "Find", complete: true },
      { id: "verify", label: "Verify" },
    ],
  },
  play: async ({ canvas }) => {
    change.mockClear();
    const teach = canvas.getByRole("button", { name: "Teach" });
    await expect(teach).toHaveAttribute("data-state", "complete");
    // A done step can be gone back to.
    await userEvent.click(teach);
    await expect(change).toHaveBeenLastCalledWith("teach");
  },
};

export const Vertical: Story = {
  args: {
    orientation: "vertical",
    value: "find",
    steps: [
      { id: "teach", label: "Teach", complete: true },
      { id: "find", label: "Find" },
      { id: "verify", label: "Verify", blockedBy: "Run Find first." },
    ],
  },
  play: async ({ canvas }) => {
    const list = canvas.getByRole("list", { name: "Inspection steps" });
    await expect(list).toHaveAttribute("data-orientation", "vertical");
    // The steps stack (measured only where the stylesheet is loaded).
    if (getComputedStyle(list).display === "flex") {
      const teach = canvas.getByRole("button", { name: "Teach" }).getBoundingClientRect();
      const find = canvas.getByRole("button", { name: "Find" }).getBoundingClientRect();
      await expect(find.top).toBeGreaterThan(teach.bottom);
    }
  },
};

/** No `value`: the stepper keeps the current step itself, starting from `defaultValue`. */
export const Uncontrolled: Story = {
  args: { value: undefined, defaultValue: "find" },
  render: (args) => <Stepper {...args} />,
  play: async ({ canvas }) => {
    change.mockClear();
    await expect(canvas.getByRole("button", { name: "Find" })).toHaveAttribute("aria-current", "step");
    await userEvent.click(canvas.getByRole("button", { name: "Teach" }));
    await expect(change).toHaveBeenLastCalledWith("teach");
    await expect(canvas.getByRole("button", { name: "Teach" })).toHaveAttribute("aria-current", "step");
  },
};
