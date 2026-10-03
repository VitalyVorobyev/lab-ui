import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fireEvent, fn, spyOn, waitFor } from "storybook/test";

import type { ValuePlane } from "../api/mapValues";
import { AreaSet } from "./AreaSet";
import { HeatmapLayer } from "./HeatmapLayer";
import type { Colormap } from "./heatmapRaster";
import { ImageStage } from "./stage/ImageStage";
import type { StageView } from "./stage/view";

const IMAGE = { width: 400, height: 300 };
/**
 * Rasterising goes through `canvas.toBlob`, which encodes off the main thread; on a CI runner
 * under coverage instrumentation that can take longer than `waitFor`'s 1 s default.
 */
const RASTER_WAIT = { timeout: 5000 };
const VIEW: StageView = { scale: 1, tx: 0, ty: 0 };

/** A dark-blue to yellow sequential map through five anchor colours. */
const ANCHORS: [number, number, number][] = [
  [68, 1, 84],
  [59, 82, 139],
  [33, 145, 140],
  [94, 201, 98],
  [253, 231, 37],
];
const viridisLike: Colormap = (t) => {
  const scaled = Math.min(1, Math.max(0, t)) * (ANCHORS.length - 1);
  const i = Math.min(ANCHORS.length - 2, Math.floor(scaled));
  const f = scaled - i;
  const a = ANCHORS[i]!;
  const b = ANCHORS[i + 1]!;
  return [a[0] + f * (b[0] - a[0]), a[1] + f * (b[1] - a[1]), a[2] + f * (b[2] - a[2])];
};

/** A 128×96 field: two Gaussian blobs, with a hole where nothing was measured. */
function field(shift = 0): ValuePlane {
  const width = 128;
  const height = 96;
  const values = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = Math.exp(-(((x - 40 - 2 * shift) / 18) ** 2 + ((y - 36) / 14) ** 2));
      const b = 0.6 * Math.exp(-(((x - 90) / 16) ** 2 + ((y - 64 + 2 * shift) / 16) ** 2));
      values[y * width + x] = x > 56 && x < 72 && y > 72 ? Number.NaN : a + b;
    }
  }
  return { width, height, stride: 1, channels: 1, values };
}

const PLANE = field();

/** A 32×24 left-to-right ramp, already coloured: opaque red fading to transparent. */
function ramp(): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(32 * 24 * 4);
  for (let k = 0; k < 32 * 24; k++) {
    const x = k % 32;
    rgba.set([230, 60, 60, Math.round((255 * x) / 31)], 4 * k);
  }
  return rgba;
}
const RAMP = ramp();

function Frame({ children, view = VIEW }: { children: React.ReactNode; view?: StageView }) {
  return (
    <ImageStage image={IMAGE} view={view} onView={() => {}} style={{ width: IMAGE.width + 2, height: IMAGE.height + 2 }}>
      <div className="absolute inset-0 bg-surface" />
      {children}
    </ImageStage>
  );
}

const ready = fn();
const failed = fn();
const tooShort = fn();

const meta = {
  title: "stage2d/HeatmapLayer",
  component: HeatmapLayer,
  parameters: {
    docs: {
      description: {
        component: `A scalar field or a pre-coloured buffer drawn as one image over or under the other layers: an anomaly map, a
corner response, a depth map. A heatmap is a raster, not vector geometry, so it is rendered once into an offscreen canvas,
handed to the browser as an object URL and shown by an \`<img>\` the stage scales with the photograph. Nothing is drawn
per pixel by React, and the object URL is revoked when the map changes and on unmount.

- **From a field:** \`plane\` (as \`decodePlane\` returns it) with a \`colormap\` \`(t) => [r, g, b]\` over \`range\` (default: the
  extent of the finite values). \`NaN\` pixels are transparent. The colour maps of \`@vitavision/charts\` fit:
  \`(t) => colormapRgb("viridis", t)\`; pass a stable function.
- **From pixels:** \`rgba\`, \`width\` and \`height\` for a buffer that is already coloured (a worker's output). A \`Uint8Array\` is
  read in place.
- **Placement:** by default the raster covers the whole image, whatever its resolution. \`rect\` places it elsewhere, in image
  coordinates (\`-0.5, -0.5\` is the image's own top-left corner).
- **Opacity and visibility:** \`opacity\` and \`visible\`; a hidden heatmap is not rasterised.
- **Pixelated** from 4 CSS pixels per heatmap pixel (\`pixelatedAbove\`), so the cells of a coarse map are not smoothed.
- **Stacking:** it is where it sits among the stage's children: before the overlays it is under them.
- **Input:** none. Presses go through it. To read the number under the pointer, use \`valueAt\` on the plane.

**Use** it for any map over the image that a person reads by colour, with a colour legend beside the stage.

**Don't** use it for sparse data (that is \`PointSet\`), or to colour regions by class (that is \`AreaSet\` with roles or a mask).

**Accessibility**: the image is decorative by default (\`alt=""\`): colour is not the only channel, so the legend and the
numbers carry the meaning. Pass \`alt\` to describe it.`,
      },
    },
  },
  args: { plane: PLANE, colormap: viridisLike },
  render: () => (
    <Frame>
      <HeatmapLayer plane={PLANE} colormap={viridisLike} opacity={0.75} onReady={ready} onError={failed} />
    </Frame>
  ),
} satisfies Meta<typeof HeatmapLayer>;

export default meta;
type Story = StoryObj<typeof meta>;

const heatmap = (root: Element) => root.querySelector<HTMLImageElement>("img[data-heatmap]");

export const Default: Story = {
  play: async ({ canvasElement }) => {
    ready.mockClear();
    await waitFor(() => expect(heatmap(canvasElement)).not.toBeNull(), RASTER_WAIT);
    const img = heatmap(canvasElement)!;
    await waitFor(() => expect(img).toHaveAttribute("data-ready"), RASTER_WAIT);
    await expect(ready).toHaveBeenCalled();
    // It covers the image 1:1: the image's top-left edge is (-0.5, -0.5) in image coordinates, CSS 0.
    await expect(img.style.left).toBe("0px");
    await expect(img.style.top).toBe("0px");
    await expect(img.style.width).toBe("400px");
    await expect(img.style.height).toBe("300px");
    await expect(img.style.opacity).toBe("0.75");
    await expect(img.src.startsWith("blob:")).toBe(true);
    // 400 px over 128 heatmap pixels at 1x: 3 CSS px per cell, smooth.
    await expect(img).not.toHaveAttribute("data-pixelated");
    await expect(img.alt).toBe("");
  },
};

export const FromRgba: Story = {
  render: () => (
    <Frame>
      <HeatmapLayer rgba={RAMP} width={32} height={24} />
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(heatmap(canvasElement)).toHaveAttribute("data-ready"), RASTER_WAIT);
  },
};

/** A `Uint8Array` view into a larger buffer is read in place, from its own offset. */
export const FromUint8ArrayView: Story = {
  render: () => {
    const backing = new Uint8Array(16 + RAMP.length);
    backing.set(RAMP, 16);
    return (
      <Frame>
        <HeatmapLayer rgba={new Uint8Array(backing.buffer, 16, RAMP.length)} width={32} height={24} />
      </Frame>
    );
  },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(heatmap(canvasElement)).toHaveAttribute("data-ready"), RASTER_WAIT);
  },
};

export const Placed: Story = {
  render: () => (
    <Frame>
      <HeatmapLayer plane={PLANE} colormap={viridisLike} rect={{ x: 99.5, y: 59.5, width: 200, height: 150 }} />
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(heatmap(canvasElement)).not.toBeNull(), RASTER_WAIT);
    const img = heatmap(canvasElement)!;
    await expect([img.style.left, img.style.top, img.style.width, img.style.height]).toEqual(["100px", "60px", "200px", "150px"]);
  },
};

export const FixedRangeAndChannel: Story = {
  render: () => (
    <Frame>
      <HeatmapLayer plane={{ ...PLANE, channels: 2, values: new Float32Array([...PLANE.values, ...PLANE.values.map((v) => 1 - v)]) }} colormap={viridisLike} range={{ low: 0, high: 1 }} channel={1} />
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(heatmap(canvasElement)).toHaveAttribute("data-ready"), RASTER_WAIT);
  },
};

/** A coarse map zoomed in: its cells are blocks, not a blur. */
export const PixelatedWhenZoomedIn: Story = {
  render: () => (
    <Frame view={{ scale: 5, tx: -400, ty: -300 }}>
      <HeatmapLayer plane={{ width: 8, height: 6, stride: 1, channels: 1, values: Float32Array.from({ length: 48 }, (_, k) => k) }} colormap={viridisLike} />
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(heatmap(canvasElement)).not.toBeNull(), RASTER_WAIT);
    const img = heatmap(canvasElement)!;
    // 400 image px over 8 heatmap px, at 5x: 250 CSS px per cell.
    await expect(img).toHaveAttribute("data-pixelated");
    await expect(img.style.imageRendering).toBe("pixelated");
  },
};

export const Hidden: Story = {
  render: () => (
    <Frame>
      <HeatmapLayer plane={PLANE} colormap={viridisLike} visible={false} />
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    await new Promise((resolve) => setTimeout(resolve, 50));
    await expect(heatmap(canvasElement)).toBeNull();
  },
};

/** An `rgba` buffer shorter than `width · height · 4` is an error, not an exception. */
export const BufferTooShort: Story = {
  render: () => (
    <Frame>
      <HeatmapLayer rgba={new Uint8ClampedArray(10)} width={32} height={24} onError={tooShort} />
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(tooShort).toHaveBeenCalled(), RASTER_WAIT);
    await expect(heatmap(canvasElement)).toBeNull();
  },
};

/** Under the overlays, and not in their way: a press on the heatmap reaches the layers above. */
export const UnderOverlays: Story = {
  render: () => (
    <Frame>
      <HeatmapLayer plane={PLANE} colormap={viridisLike} opacity={0.8} />
      <AreaSet items={[{ id: "roi", label: "ROI", points: [90, 60, 210, 60, 210, 150, 90, 150] }]} />
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(heatmap(canvasElement)).toHaveAttribute("data-ready"), RASTER_WAIT);
    await expect(heatmap(canvasElement)!.compareDocumentPosition(canvasElement.querySelector("svg[role=img]")!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    await expect(getComputedStyle(heatmap(canvasElement)!).pointerEvents).toBe("none");
  },
};

function Swap() {
  const [shift, setShift] = useState(0);
  const [plane, setPlane] = useState(() => field(0));
  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setShift(shift + 8);
          setPlane(field(shift + 8));
        }}
      >
        Next frame
      </button>
      <Frame>
        <HeatmapLayer plane={plane} colormap={viridisLike} />
      </Frame>
    </div>
  );
}

/** A new map replaces the old one and the old object URL is revoked; the last one is revoked on unmount. */
export const ReplacedMapRevokesItsUrl: Story = {
  render: () => <Swap />,
  play: async ({ canvas, canvasElement }) => {
    const revoke = spyOn(URL, "revokeObjectURL");
    await waitFor(() => expect(heatmap(canvasElement)).toHaveAttribute("data-ready"), RASTER_WAIT);
    const first = heatmap(canvasElement)!.src;
    await fireEvent.click(canvas.getByRole("button", { name: "Next frame" }));
    await waitFor(() => expect(heatmap(canvasElement)!.src).not.toBe(first), RASTER_WAIT);
    await waitFor(() => expect(revoke).toHaveBeenCalledWith(first), RASTER_WAIT);
    revoke.mockRestore();
  },
};
