import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fireEvent, fn, userEvent, waitFor } from "storybook/test";

import { SegmentedControl } from "@vitavision/ui";
import { CompareLayer, type CompareLayerProps } from "./CompareLayer";
import type { CompareMode } from "./compareStyle";
import { ImageStage } from "./ImageStage";
import { StageToolbar, StageToolbarDivider } from "./StageToolbar";
import type { StageView } from "./view";

const IMAGE = { width: 640, height: 480 };
const VIEW: StageView = { scale: 1, tx: 0, ty: 0 };

/**
 * A synthetic part as an SVG data URL: a plate with two bores and a slot. `found` is the same
 * part as found in another image and rectified into the reference's frame: its right bore sits
 * 4 px off, it carries a scratch, and it is lit a little brighter. Built as a string, so no
 * network and no DOM.
 */
function part(found: boolean): string {
  const shift = found ? 4 : 0;
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${IMAGE.width}" height="${IMAGE.height}" viewBox="0 0 ${IMAGE.width} ${IMAGE.height}">`,
    `<defs><radialGradient id="m" cx="0.45" cy="0.4" r="0.8"><stop offset="0" stop-color="${found ? "#dfe2e6" : "#d6d9dd"}"/><stop offset="1" stop-color="${found ? "#989ea5" : "#8f959c"}"/></radialGradient></defs>`,
    `<rect width="${IMAGE.width}" height="${IMAGE.height}" fill="#1f2226"/>`,
    `<rect x="80" y="64" width="480" height="352" rx="16" fill="url(#m)"/>`,
    `<circle cx="220" cy="200" r="56" fill="#16181b"/>`,
    `<circle cx="${420 + shift}" cy="${200 + shift / 2}" r="56" fill="#16181b"/>`,
    `<rect x="200" y="320" width="240" height="36" rx="18" fill="#16181b"/>`,
    found ? `<path d="M300 110L340 132L372 160" stroke="#5b3b2e" stroke-width="3" fill="none"/>` : "",
    `</svg>`,
  ].join("");
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const REFERENCE = part(false);
const FOUND = part(true);

const splitChange = fn();

/** A fixed 1:1 view, so a play can aim at layer pixels; `view` overrides it. */
function Stage({ layer, view = VIEW, toolbar }: { layer: CompareLayerProps; view?: StageView; toolbar?: React.ReactNode }) {
  return (
    <ImageStage image={IMAGE} view={view} onView={() => {}} toolbar={toolbar} style={{ width: IMAGE.width + 2, height: IMAGE.height + 2 }}>
      <CompareLayer {...layer} />
    </ImageStage>
  );
}

/** The client point of layer pixel `p` at the fixed 1:1 view: from the viewport's content box, as the stage converts. */
function client(root: Element, p: { x: number; y: number }) {
  const viewport = root.querySelector("[role=application]")!;
  const rect = viewport.getBoundingClientRect();
  return { clientX: rect.left + viewport.clientLeft + p.x, clientY: rect.top + viewport.clientTop + p.y, pointerId: 1, button: 0 };
}

const meta = {
  title: "stage2d/CompareLayer",
  component: CompareLayer,
  parameters: {
    docs: {
      description: {
        component: `Two registered images of the same size, compared in place inside an \`ImageStage\`: a reference and
an instance rectified into its frame, a golden template and a part, a frame before and after a change.

- **\`checker\`**: alternate squares of A and B, \`cell\` image pixels across (32 by default), A at the top-left. An
  edge that does not line up breaks at every square.
- **\`wipe\`**: A before a divider, B after it. Drag the divider or its knob, which stays in the middle of the part of
  the divider on screen; \`orientation="horizontal"\` puts A above it. \`split\` / \`defaultSplit\` / \`onSplitChange\`
  hold the divider's place, as the fraction of the image before it.
- **\`difference\`**: \`mix-blend-mode: difference\`, so identical pixels are black and a change shows bright.
  \`gain\` brightens it. It is the per-channel difference of the sRGB-encoded values the browser composites, not of
  linear light: a picture of where the images differ, not a measurement of by how much.

Everything is CSS on the second image (a mask, a clip, a blend), so nothing is redrawn as the view moves. Past
\`pixelatedAbove\` (4× by default) both images are drawn as blocks, as \`ImageLayer\` draws one.

**Use** it when two images are already in one frame and the question is where they differ.

**Don't** use it for images of different sizes or not yet registered (rectify first), for a numeric difference (compute
it, and show it as a \`HeatmapLayer\`), or for one image (\`ImageLayer\`).

**Accessibility**: the two images are one picture, \`role="img"\` named by \`alt\`. In wipe mode the knob is a slider
(0 to 100, the share of A, read as "40 % A"): arrow keys move it 1 % (10 % with Shift), Page Up and Page Down 10 %,
Home and End to either edge, and the keys do not pan the stage. \`labels\` names the two images for the slider and for the
tags beside the knob.`,
      },
    },
  },
  args: { a: REFERENCE, b: FOUND, mode: "checker", alt: "Reference and found part compared", onSplitChange: splitChange },
  render: (args) => <Stage layer={args} />,
} satisfies Meta<typeof CompareLayer>;

export default meta;
type Story = StoryObj<typeof meta>;

const imageB = (root: Element) => root.querySelector<HTMLImageElement>("img[data-image=b]")!;

/** A checkerboard of 32 px squares: the shifted bore breaks at every square edge. */
export const Checker: Story = {
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole("img", { name: "Reference and found part compared" })).toBeInTheDocument();
    await expect(canvasElement.querySelector("[data-mode=checker]")).not.toBeNull();
    await expect(imageB(canvasElement).style.maskSize).toBe("64px 64px");
    // No divider outside wipe mode.
    await expect(canvas.queryByRole("slider")).toBeNull();
  },
};

/** A vertical wipe; the play drags the divider to a quarter of the width, then uses the keys. */
export const Wipe: Story = {
  args: { mode: "wipe", labels: ["Reference", "Found"] },
  play: async ({ canvas, canvasElement }) => {
    splitChange.mockClear();
    const knob = canvas.getByRole("slider", { name: "Split between Reference and Found" });
    await expect(knob).toHaveAttribute("aria-valuenow", "50");
    await expect(knob).toHaveAttribute("aria-valuetext", "50 % Reference");
    await expect(imageB(canvasElement).style.clipPath).toBe("inset(0px 0px 0px 50%)");
    const viewport = canvasElement.querySelector("[role=application]")!;
    await fireEvent.pointerDown(knob, client(canvasElement, { x: 320, y: 240 }));
    await expect(knob).toHaveAttribute("data-dragging");
    await fireEvent.pointerMove(window, client(canvasElement, { x: 160, y: 250 }));
    await fireEvent.pointerUp(window, client(canvasElement, { x: 160, y: 250 }));
    await waitFor(() => expect(knob).toHaveAttribute("aria-valuenow", "25"));
    await expect(splitChange).toHaveBeenLastCalledWith(0.25);
    await expect(knob).not.toHaveAttribute("data-dragging");
    // The drag was the divider's: the stage did not pan.
    await expect(viewport).not.toHaveAttribute("data-panning");
    await expect(canvasElement.querySelector("[data-tag=a]")).toHaveTextContent("Reference");
    // Keys: 1 %, 10 % with Shift, the edges.
    knob.focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(knob).toHaveAttribute("aria-valuenow", "26");
    await userEvent.keyboard("{Shift>}{ArrowLeft}{/Shift}");
    await expect(knob).toHaveAttribute("aria-valuenow", "16");
    await userEvent.keyboard("{End}");
    await expect(knob).toHaveAttribute("aria-valuetext", "100 % Reference");
    await userEvent.keyboard("{Home}");
    await expect(knob).toHaveAttribute("aria-valuenow", "0");
  },
};

/** A horizontal wipe: the reference above the divider, the found part below. */
export const WipeHorizontal: Story = {
  args: { mode: "wipe", orientation: "horizontal", defaultSplit: 0.4 },
  play: async ({ canvas, canvasElement }) => {
    const knob = canvas.getByRole("slider");
    await expect(knob).toHaveAttribute("aria-orientation", "vertical");
    await expect(knob).toHaveAttribute("aria-valuetext", "40 % A");
    await expect(imageB(canvasElement).style.clipPath).toBe("inset(40% 0px 0px)");
    knob.focus();
    await userEvent.keyboard("{ArrowDown}");
    await expect(knob).toHaveAttribute("aria-valuenow", "41");
  },
};

/** The difference: black where the images agree, the moved bore and the scratch bright. */
export const Difference: Story = {
  args: { mode: "difference" },
  play: async ({ canvasElement }) => {
    await expect(imageB(canvasElement).style.mixBlendMode).toBe("difference");
    const group = canvasElement.querySelector<HTMLElement>("[role=img]")!;
    await expect(group.style.isolation).toBe("isolate");
    await expect(group.style.filter).toBe("");
  },
};

/** The same difference brightened four times, so the small change in lighting shows too. */
export const DifferenceGain: Story = {
  args: { mode: "difference", gain: 4 },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector<HTMLElement>("[role=img]")!.style.filter).toBe("brightness(4)");
  },
};

const MODES: { value: CompareMode; label: string }[] = [
  { value: "checker", label: "Checker" },
  { value: "wipe", label: "Wipe" },
  { value: "difference", label: "Difference" },
];

function ModeSwitcherStage(args: CompareLayerProps) {
  const [mode, setMode] = useState<CompareMode>("wipe");
  return (
    <Stage
      layer={{ ...args, mode }}
      toolbar={
        <StageToolbar>
          <StageToolbarDivider />
          <SegmentedControl
            aria-label="Comparison"
            value={mode}
            options={MODES}
            onValueChange={(value) => setMode((value || "wipe") as CompareMode)}
          />
        </StageToolbar>
      }
    />
  );
}

/** The three modes behind a segmented control in the stage's toolbar. */
export const ModeSwitcher: Story = {
  render: (args) => <ModeSwitcherStage {...args} />,
  play: async ({ canvas, canvasElement }) => {
    await expect(canvasElement.querySelector("[data-mode=wipe]")).not.toBeNull();
    await userEvent.click(canvas.getByRole("radio", { name: "Difference" }));
    await waitFor(() => expect(canvasElement.querySelector("[data-mode=difference]")).not.toBeNull());
    await expect(canvas.queryByRole("slider")).toBeNull();
    await userEvent.click(canvas.getByRole("radio", { name: "Checker" }));
    await waitFor(() => expect(canvasElement.querySelector("[data-mode=checker]")).not.toBeNull());
  },
};

/** At 6× both images are drawn as blocks, so the comparison is of the sensor's own pixels. */
export const Pixelated: Story = {
  args: { mode: "wipe" },
  render: (args) => <Stage layer={args} view={{ scale: 6, tx: -1500, ty: -1000 }} />,
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("[data-mode=wipe]")).toHaveAttribute("data-pixelated");
    for (const image of canvasElement.querySelectorAll<HTMLImageElement>("img")) await expect(image.style.imageRendering).toBe("pixelated");
  },
};
