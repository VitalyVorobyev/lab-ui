import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import type { ComponentProps } from "react";
import { expect, fn, userEvent, waitFor } from "storybook/test";

import { MeasureOverlay, type MeasurePrimitive } from "./MeasureOverlay";
import { RESET_VIEW, ZoomPanCanvas, type View } from "./ZoomPanCanvas";

/** The synthetic part's pixel size; the frame is laid out at this aspect ratio, as it must be. */
const IMAGE = { width: 1280, height: 1024 };
const FRAME_HEIGHT = 480;

/**
 * A deterministic stand-in for a backlit inspection image: a machined plate with three bores
 * and a scratch on a dark, gridded background. Built as a string, so no network and no DOM.
 */
const INSPECTION_IMAGE = (() => {
  const grid: string[] = [];
  for (let x = 64; x < IMAGE.width; x += 64) grid.push(`M${x} 0V${IMAGE.height}`);
  for (let y = 64; y < IMAGE.height; y += 64) grid.push(`M0 ${y}H${IMAGE.width}`);
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${IMAGE.width}" height="${IMAGE.height}" viewBox="0 0 ${IMAGE.width} ${IMAGE.height}">`,
    `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1f2226"/><stop offset="1" stop-color="#3b4046"/></linearGradient>`,
    `<radialGradient id="metal" cx="0.45" cy="0.4" r="0.75"><stop offset="0" stop-color="#d6d9dd"/><stop offset="1" stop-color="#8f959c"/></radialGradient></defs>`,
    `<rect width="${IMAGE.width}" height="${IMAGE.height}" fill="url(#bg)"/>`,
    `<path d="${grid.join("")}" stroke="#ffffff" stroke-opacity="0.07" stroke-width="1"/>`,
    `<rect x="240" y="192" width="800" height="640" rx="24" fill="url(#metal)"/>`,
    `<circle cx="440" cy="400" r="90" fill="#16181b"/>`,
    `<circle cx="840" cy="400" r="90" fill="#16181b"/>`,
    `<circle cx="640" cy="660" r="60" fill="#16181b"/>`,
    `<path d="M700 250L735 268L782 302" stroke="#5b3b2e" stroke-width="3" fill="none"/>`,
    `</svg>`,
  ].join("");
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
})();

const PRIMITIVES: MeasurePrimitive[] = [
  { kind: "circle", cx: 440, cy: 400, r: 90, tone: "normal" },
  { kind: "circle", cx: 840, cy: 400, r: 90, tone: "normal" },
  { kind: "point", x: 741, y: 276, tone: "defect", radius: 5, label: "scratch" },
];

function StatefulCanvas(args: ComponentProps<typeof ZoomPanCanvas>) {
  const [view, setView] = useState<View>(args.view);
  // Image px → screen px at zoom 1 is the frame's height over the image's.
  const fit = FRAME_HEIGHT / IMAGE.height;
  return (
    <ZoomPanCanvas
      {...args}
      view={view}
      onView={(next) => {
        setView(next);
        args.onView(next);
      }}
    >
      <img
        src={INSPECTION_IMAGE}
        alt="Synthetic inspection image: a machined plate with three bores and a scratch"
        draggable={false}
        className="h-full w-full"
      />
      <MeasureOverlay
        nativeWidth={IMAGE.width}
        nativeHeight={IMAGE.height}
        primitives={PRIMITIVES}
        strokeScale={view.zoom * fit}
      />
    </ZoomPanCanvas>
  );
}

const meta = {
  title: "stage2d/ZoomPanCanvas",
  component: ZoomPanCanvas,
  parameters: {
    docs: {
      description: {
        component: `**Deprecated — use \`ImageStage\`.** Kept exported and unchanged for consumers that have not
migrated; new code must not adopt it.

A pannable, zoomable frame that transforms its stacked children together. Zoom 1 is fit (so the frame
must be laid out at the source aspect ratio via \`style.aspectRatio\`), double-click toggles fit against
1:1 native pixels, and a "Fit" button appears once zoomed in.

**Don't** use it — for anything. It scales layers by the *frame's* size, so a frame not laid out at the
image's aspect draws overlays stretched against a letterboxed picture; and it captures every
\`pointerdown\` to pan, so an interactive layer (an ROI handle, a clickable contour) cannot live inside
it. \`ImageStage\` fixes both structurally.

**Accessibility**: it has no role, no label, no focus and no keyboard control — zoom and pan are
pointer-only; the "Fit" button is a real button. \`ImageStage\` is keyboard-operable.`,
      },
    },
  },
  args: {
    view: RESET_VIEW,
    onView: fn(),
    onHover: fn(),
    nativeWidth: IMAGE.width,
    label: `${IMAGE.width}×${IMAGE.height}`,
    style: { aspectRatio: `${IMAGE.width} / ${IMAGE.height}`, height: FRAME_HEIGHT },
    children: null,
  },
  render: (args) => <StatefulCanvas {...args} />,
} satisfies Meta<typeof ZoomPanCanvas>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Zoom 1, which is fit — no "Fit" button to show. */
export const Fit: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("img", { name: /Synthetic inspection image/ })).toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: "Fit" })).not.toBeInTheDocument();
  },
};

/** Zoomed in, with the "Fit" button that resets the view. */
export const Zoomed: Story = {
  args: { view: { zoom: 3, x: -120, y: 180 } },
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Fit" }));
    await expect(args.onView).toHaveBeenCalledWith(RESET_VIEW);
    await waitFor(() => expect(canvas.queryByRole("button", { name: "Fit" })).not.toBeInTheDocument());
  },
};
