import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, waitFor } from "storybook/test";

import { SequenceNavigator, type SequenceItem, type SequenceNavigatorProps } from "./SequenceNavigator";

/** A synthetic frame thumbnail, as a data URL, so no network is involved. */
function thumb(i: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="40"><rect width="56" height="40" fill="rgb(${30 + i * 4} 34 38)"/><circle cx="${10 + i * 3}" cy="20" r="8" fill="rgb(180 184 190)"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const FRAMES: SequenceItem[] = Array.from({ length: 12 }, (_, i) => ({
  id: `f${i + 1}`,
  label: `dome_${String(i + 1).padStart(4, "0")}.bmp`,
  thumbnail: thumb(i),
}));

const change = fn();

function Stateful(args: SequenceNavigatorProps) {
  const [value, setValue] = useState(args.value);
  return (
    <div style={{ width: 560 }}>
      <SequenceNavigator
        {...args}
        value={value}
        onValueChange={(id) => {
          setValue(id);
          change(id);
        }}
      />
    </div>
  );
}

const meta = {
  title: "workbench/SequenceNavigator",
  component: SequenceNavigator,
  parameters: {
    docs: {
      description: {
        component: `The current item of an ordered set — a frame of a capture — as a strip of lazily loaded thumbnails between
previous and next, with the position and \`[\` / \`]\` from anywhere outside a text field. \`renderThumbnail\` draws a
thumbnail whose URL must be fetched first. An item's \`status\` (\`{ tone, label }\`) draws a dot in the thumbnail's
corner — "not found" in a batch run — over any thumbnail rendering. The strip is as wide as its thumbnails, so
previous and next stay beside a short sequence; a long one scrolls.

**Use** it where a person steps through a capture one frame at a time: a header, under a canvas.

**Don't** use it for an unordered collection (that is a grid) or for choosing among a handful of options (that is
\`SegmentedControl\` or \`Select\`).

**Accessibility**: the strip is a named list of buttons, each named by its item; the current one has
\`aria-current="true"\`. A status is said in words: the item is named, and titled, \`"label, status"\`, and the dot
is decoration. Previous and next declare \`aria-keyshortcuts\`.`,
      },
    },
  },
  args: { items: FRAMES, value: "f3", onValueChange: change, "aria-label": "Frames" },
  render: (args) => <Stateful {...args} />,
} satisfies Meta<typeof SequenceNavigator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "dome_0003.bmp" })).toHaveAttribute("aria-current", "true");
    await expect(canvas.getByText("3 / 12")).toBeVisible();
  },
};

export const Stepping: Story = {
  play: async ({ canvas }) => {
    change.mockClear();
    await userEvent.click(canvas.getByRole("button", { name: "Next" }));
    await expect(change).toHaveBeenLastCalledWith("f4");
    await userEvent.click(canvas.getByRole("button", { name: "Previous" }));
    await expect(change).toHaveBeenLastCalledWith("f3");
    // `[` / `]` from anywhere outside a text field.
    await userEvent.keyboard("]]");
    await waitFor(() => expect(canvas.getByText("5 / 12")).toBeVisible());
    // user-event reads `[` as a key descriptor; `[[` types one.
    await userEvent.keyboard("[[");
    await expect(change).toHaveBeenLastCalledWith("f4");
    // A click picks directly.
    await userEvent.click(canvas.getByRole("button", { name: "dome_0010.bmp" }));
    await expect(change).toHaveBeenLastCalledWith("f10");
  },
};

export const AtTheEnds: Story = {
  args: { value: "f12" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Next" })).toBeDisabled();
    await userEvent.click(canvas.getByRole("button", { name: "Previous" }));
    await expect(change).toHaveBeenLastCalledWith("f11");
  },
};

export const Wrapping: Story = {
  args: { value: "f12", wrap: true },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Next" }));
    await expect(change).toHaveBeenLastCalledWith("f1");
  },
};

export const CustomThumbnails: Story = {
  args: {
    value: null,
    keys: false,
    items: FRAMES.slice(0, 4).map(({ id, label }) => ({ id, label })),
    renderThumbnail: (item: SequenceItem) => <span className="block p-1 font-mono text-[10px]">{item.id}</span>,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("– / 4")).toBeVisible();
    await expect(canvas.getByText("f2")).toBeVisible();
    change.mockClear();
    await userEvent.keyboard("]");
    await expect(change).not.toHaveBeenCalled();
  },
};

export const LabelsWithoutThumbnails: Story = {
  args: { items: FRAMES.slice(0, 3).map(({ id, label }) => ({ id, label })), value: "f1" },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("dome_0002.bmp")).toBeVisible();
  },
};

/** A batch run's verdicts as per-item status: a dot in the corner, the status in each item's name. */
export const WithStatus: Story = {
  args: {
    items: FRAMES.map((frame, i) => ({
      ...frame,
      status:
        i === 2 || i === 7
          ? { tone: "defect" as const, label: "not found" }
          : i === 4
            ? { tone: "warning" as const, label: "low contrast" }
            : i < 9
              ? { tone: "normal" as const, label: "found" }
              : undefined,
    })),
  },
  play: async ({ canvas }) => {
    const missing = canvas.getByRole("button", { name: "dome_0003.bmp, not found" });
    await expect(missing).toHaveAttribute("aria-current", "true");
    await expect(missing).toHaveAttribute("data-status", "defect");
    await expect(missing).toHaveAttribute("title", "dome_0003.bmp, not found");
    await expect(missing.querySelector('[data-tone="defect"]')).not.toBeNull();
    await expect(canvas.getByRole("button", { name: "dome_0005.bmp, low contrast" })).toHaveAttribute(
      "data-status",
      "warning",
    );
    // An item without a status keeps its plain name and draws no dot.
    const plain = canvas.getByRole("button", { name: "dome_0010.bmp" });
    await expect(plain).not.toHaveAttribute("data-status");
    await expect(plain.querySelector("[data-tone]")).toBeNull();
  },
};

/**
 * Three frames in a wide row: the strip is as wide as its thumbnails, so Next sits beside the
 * last one instead of at the far end of the row.
 */
export const ShortSequence: Story = {
  args: {
    items: FRAMES.slice(0, 3).map(({ id, label }, i) => ({
      id,
      label,
      status: i === 1 ? { tone: "defect" as const, label: "not found" } : undefined,
    })),
    value: "f1",
  },
  play: async ({ canvas }) => {
    const list = canvas.getByRole("list", { name: "Frames" });
    const next = canvas.getByRole("button", { name: "Next" });
    await expect(canvas.getByText("1 / 3")).toBeVisible();
    // The layout is CSS; measure it only where the stylesheet is loaded.
    if (getComputedStyle(list).display === "flex") {
      const last = canvas.getByRole("button", { name: "dome_0003.bmp" }).getBoundingClientRect();
      const gap = next.getBoundingClientRect().left - last.right;
      await expect(gap).toBeGreaterThanOrEqual(0);
      await expect(gap).toBeLessThanOrEqual(12);
      await expect(list.getBoundingClientRect().width).toBeLessThan(560 / 2);
    }
    await userEvent.click(next);
    await expect(change).toHaveBeenLastCalledWith("f2");
  },
};
