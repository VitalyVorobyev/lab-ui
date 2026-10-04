import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, waitFor } from "storybook/test";

import { ImageLayer, type ImageLayerProps } from "./ImageLayer";
import { ImageStage } from "./ImageStage";
import { StageToolbar } from "./StageToolbar";
import type { StageView } from "./view";

const IMAGE = { width: 1280, height: 1024 };

/** A synthetic frame as an SVG data URL; `tone` tells the two tiers apart on screen. */
function frame(tone: string, label: string): string {
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${IMAGE.width}" height="${IMAGE.height}">`,
    `<rect width="100%" height="100%" fill="${tone}"/>`,
    `<rect x="240" y="192" width="800" height="640" rx="24" fill="#b9bec4"/>`,
    `<circle cx="640" cy="512" r="140" fill="#16181b"/>`,
    `<text x="40" y="80" font-family="monospace" font-size="48" fill="#e8ebed">${label}</text>`,
    `</svg>`,
  ].join("");
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const FULL = frame("#2b3036", "full");
const PREVIEW = frame("#3b3027", "preview");

function Stage({ layer, view: initial = null }: { layer: ImageLayerProps; view?: StageView | null }) {
  const [view, setView] = useState<StageView | null>(initial);
  return (
    <div style={{ height: 400 }}>
      <ImageStage image={IMAGE} view={view} onView={setView} toolbar={<StageToolbar />}>
        <ImageLayer {...layer} />
      </ImageStage>
    </div>
  );
}

const meta = {
  title: "stage2d/ImageLayer",
  component: ImageLayer,
  parameters: {
    docs: {
      description: {
        component: `The photograph inside an \`ImageStage\`, at its natural size. With a \`preview\` tier it shows the
preview until the stage would magnify it — when the screen shows more pixels than the preview has — then requests
\`src\` and keeps it (zooming out does not swap back). The preview stays underneath while the full image loads.
When the full image is costly to produce, leave \`src\` out: \`onFullNeeded\` fires once per preview when the same
rule trips, the preview carries \`data-wants-full\` until the full image has loaded, and the full image is shown as
soon as \`src\` arrives. Past \`pixelatedAbove\` (default 4×) pixels are drawn as blocks: the sensor's own samples, not interpolated ones.

**Use** it for the image under every overlay in a stage.

**Don't** size or position it yourself — the stage is already laid out at the image's pixel size.

**Accessibility**: give \`alt\` the image's description, or \`""\` when the surrounding text describes it. While both
tiers are on screen the preview is \`aria-hidden\`, so the image is announced once. Each \`<img>\` carries
\`data-tier\`, and the full one \`data-loaded\` once loaded.`,
      },
    },
  },
  args: { src: FULL, alt: "Synthetic inspection frame", onLoad: fn() },
  render: (args) => <Stage layer={args} />,
} satisfies Meta<typeof ImageLayer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FullOnly: Story = {
  play: async ({ canvas, args }) => {
    const image = canvas.getByRole("img", { name: "Synthetic inspection frame" });
    await expect(image).toHaveAttribute("data-tier", "full");
    await waitFor(() => expect(image).toHaveAttribute("data-loaded"));
    await expect(args.onLoad).toHaveBeenCalled();
  },
};

export const PreviewThenFull: Story = {
  args: { preview: { src: PREVIEW, width: 1024 } },
  play: async ({ canvas, canvasElement }) => {
    // At fit the screen shows fewer pixels than the preview has: the preview is enough.
    await waitFor(() => expect(canvasElement.querySelector("[data-tier=preview]")).not.toBeNull());
    await expect(canvasElement.querySelector("[data-tier=full]")).toBeNull();
    // At 100% the preview would be magnified (1280 > 1024): the full image comes in.
    await userEvent.click(canvas.getByRole("button", { name: "Actual size (100%)" }));
    await waitFor(() => expect(canvasElement.querySelector("[data-tier=full][data-loaded]")).not.toBeNull());
    await waitFor(() => expect(canvasElement.querySelector("[data-tier=preview]")).toBeNull());
    // Back at fit, it stays.
    await userEvent.click(canvas.getByRole("button", { name: "Fit to window" }));
    await expect(canvasElement.querySelector("[data-tier=full]")).not.toBeNull();
    await expect(canvasElement.querySelector("[data-tier=preview]")).toBeNull();
  },
};

/**
 * The full image is costly to produce, so the app leaves `src` out and supplies it when
 * `onFullNeeded` says the preview would be magnified. Until then the preview carries
 * `data-wants-full`.
 */
function LazyStage({ layer, delay }: { layer: ImageLayerProps; delay: number }) {
  const [src, setSrc] = useState<string | undefined>(undefined);
  const { src: full = FULL, onFullNeeded, preview = { src: PREVIEW, width: 1024 }, ...rest } = layer;
  return (
    <Stage
      layer={{
        ...rest,
        preview,
        src,
        onFullNeeded: () => {
          onFullNeeded?.();
          setTimeout(() => setSrc(full), delay);
        },
      }}
    />
  );
}

export const LazyFull: Story = {
  args: { preview: { src: PREVIEW, width: 1024 }, onFullNeeded: fn() },
  render: (args) => <LazyStage layer={args} delay={150} />,
  play: async ({ canvas, canvasElement, args }) => {
    const preview = () => canvasElement.querySelector("[data-tier=preview]");
    // At fit the preview is enough: nothing is asked for.
    await waitFor(() => expect(preview()).not.toBeNull());
    await expect(preview()).not.toHaveAttribute("data-wants-full");
    await expect(args.onFullNeeded).not.toHaveBeenCalled();
    // At 100% the preview would be magnified: the app is asked once, and the preview waits.
    await userEvent.click(canvas.getByRole("button", { name: "Actual size (100%)" }));
    await waitFor(() => expect(args.onFullNeeded).toHaveBeenCalledOnce());
    await expect(preview()).toHaveAttribute("data-wants-full");
    // The URL arrives; the full image loads and replaces the preview.
    await waitFor(() => expect(canvasElement.querySelector("[data-tier=full][data-loaded]")).not.toBeNull());
    await waitFor(() => expect(preview()).toBeNull());
    // Zooming further does not ask again.
    await userEvent.click(canvas.getByRole("button", { name: "Zoom in" }));
    await expect(args.onFullNeeded).toHaveBeenCalledOnce();
  },
};

export const Pixelated: Story = {
  render: (args) => <Stage layer={args} view={{ scale: 6, tx: -3200, ty: -2600 }} />,
  play: async ({ canvas }) => {
    const image = canvas.getByRole("img", { name: "Synthetic inspection frame" });
    await waitFor(() => expect(image).toHaveAttribute("data-pixelated"));
    await expect(image.style.imageRendering).toBe("pixelated");
  },
};

export const LoadError: Story = {
  args: { src: "data:image/png;base64,AAAA", onError: fn() },
  play: async ({ args }) => {
    await waitFor(() => expect(args.onError).toHaveBeenCalled());
  },
};
