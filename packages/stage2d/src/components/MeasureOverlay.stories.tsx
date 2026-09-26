import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, waitFor } from "storybook/test";

import { MeasureOverlay, type MeasureOverlayProps, type MeasurePrimitive } from "./MeasureOverlay";
import { ImageStage, useStage } from "./stage/ImageStage";
import { StageReadout, StageToolbar } from "./stage/StageToolbar";
import type { StageView } from "./stage/view";

/** The synthetic part's pixel size — every primitive below is in this frame. */
const IMAGE = { width: 1280, height: 1024 };

/**
 * A deterministic stand-in for a backlit inspection image: a machined plate (x 240–1040,
 * y 192–832) with bores at (440, 400) r 90, (840, 400) r 90 and (640, 660) r 60, and a scratch
 * near (740, 275). Built as a string, so no network and no DOM.
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

/** Takes the live stage scale as `strokeScale`, which is how a real overlay layer is wired. */
function LiveOverlay(props: MeasureOverlayProps) {
  const stage = useStage();
  return <MeasureOverlay {...props} strokeScale={stage.view.scale} />;
}

function OverlayStage(args: MeasureOverlayProps) {
  const [view, setView] = useState<StageView | null>(null);
  return (
    <div style={{ height: 480 }}>
      <ImageStage
        image={{ width: args.nativeWidth, height: args.nativeHeight }}
        view={view}
        onView={setView}
        toolbar={<StageToolbar />}
        readout={<StageReadout />}
      >
        <img
          src={INSPECTION_IMAGE}
          alt="Synthetic inspection image: a machined plate with three bores and a scratch"
          draggable={false}
          className="absolute inset-0 h-full w-full"
        />
        <LiveOverlay {...args} />
      </ImageStage>
    </div>
  );
}

function overlay(root: HTMLElement): SVGSVGElement {
  const svg = root.querySelector<SVGSVGElement>("svg[role='presentation']");
  if (!svg) throw new Error("MeasureOverlay's <svg> was not rendered");
  return svg;
}

const meta = {
  title: "stage2d/MeasureOverlay",
  component: MeasureOverlay,
  parameters: {
    docs: {
      description: {
        component: `A pure-props SVG layer that draws measurement primitives — \`point\`, \`segment\`, \`circle\`,
\`arc\`, \`caliper\`, \`dimension\` — in **source-image pixel coordinates**, each with an optional \`tone\`
(\`signal\` / \`normal\` / \`defect\` / \`warn\` / \`muted\`, the same vocabulary as \`LineProfile\`'s edge
marks).

**Use** it as a child of \`ImageStage\`, so the one stage transform keeps it registered with the pixel it
measures. Pass the live scale (\`useStage().view.scale\`) as \`strokeScale\`: strokes, crosses and labels
stay a constant size on screen at any zoom. In these stories the overlay is wired exactly that way, so
the \`strokeScale\` arg is replaced by the stage's scale — zoom with the toolbar to see it.

**Don't** use it for interactive geometry (it is \`pointer-events-none\` and holds no state — build a
layer on \`useStage()\` for handles), for raster results (a mask or value plane is its own layer), or for
a verdict (\`Badge\`'s tones are a separate vocabulary).

**Accessibility**: the \`<svg>\` is \`role="presentation"\` and \`aria-hidden\` — the overlay is a picture
of results, and labels drawn in it are not read out. State every measurement that matters in text
beside the image (a table, a \`ReadoutStrip\`). Tone is colour: pair it with a label or a textual
verdict, never let colour alone carry pass/fail.`,
      },
    },
  },
  args: {
    nativeWidth: IMAGE.width,
    nativeHeight: IMAGE.height,
    strokeScale: 1,
    primitives: [],
  },
  render: (args) => <OverlayStage {...args} />,
} satisfies Meta<typeof MeasureOverlay>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Dots and subpixel-edge crosses along the plate's left edge. */
export const Points: Story = {
  args: {
    primitives: [
      { kind: "point", x: 240, y: 300, cross: true, label: "e1" },
      { kind: "point", x: 240.4, y: 420, cross: true, label: "e2" },
      { kind: "point", x: 239.7, y: 540, cross: true, label: "e3" },
      { kind: "point", x: 440, y: 400 },
      { kind: "point", x: 840, y: 400, radius: 5 },
    ],
  },
  play: async ({ canvasElement }) => {
    const svg = overlay(canvasElement);
    await expect(svg).toHaveAttribute("aria-hidden", "true");
    await expect(svg.querySelectorAll("line")).toHaveLength(6); // three crosses
    await expect(svg.querySelectorAll("circle")).toHaveLength(2); // two dots
  },
};

/** A fitted edge line, solid, and its extension dashed. */
export const Segments: Story = {
  args: {
    primitives: [
      { kind: "segment", x1: 264, y1: 192, x2: 1016, y2: 192, tone: "normal" },
      { kind: "segment", x1: 240, y1: 216, x2: 240, y2: 808, tone: "normal" },
      { kind: "segment", x1: 100, y1: 192, x2: 1180, y2: 192, dashed: true, tone: "muted" },
    ],
  },
  play: async ({ canvasElement }) => {
    const lines = overlay(canvasElement).querySelectorAll("line");
    await expect(lines).toHaveLength(3);
    await expect(lines[2]).toHaveAttribute("stroke-dasharray");
    await expect(lines[0]).not.toHaveAttribute("stroke-dasharray");
  },
};

/** Circle fits on the bores, and a filled confidence disc. */
export const Circles: Story = {
  args: {
    primitives: [
      { kind: "circle", cx: 440, cy: 400, r: 90, tone: "normal" },
      { kind: "circle", cx: 840, cy: 400, r: 90, tone: "normal" },
      { kind: "circle", cx: 640, cy: 660, r: 60, tone: "warn" },
      { kind: "circle", cx: 640, cy: 660, r: 6, tone: "warn", filled: true },
    ],
  },
  play: async ({ canvasElement }) => {
    const circles = overlay(canvasElement).querySelectorAll("circle");
    await expect(circles).toHaveLength(4);
    await expect(circles[0]).toHaveAttribute("fill", "none");
    await expect(circles[3]).toHaveAttribute("stroke", "none");
  },
};

/** Partial arcs — the inspected sector of a bore's rim. */
export const Arcs: Story = {
  args: {
    primitives: [
      { kind: "arc", cx: 640, cy: 660, r: 60, startAngle: -Math.PI * 0.8, endAngle: -Math.PI * 0.2, tone: "signal" },
      { kind: "arc", cx: 440, cy: 400, r: 90, startAngle: 0, endAngle: Math.PI / 2, tone: "normal" },
      { kind: "arc", cx: 840, cy: 400, r: 90, startAngle: Math.PI / 2, endAngle: Math.PI * 1.5, tone: "defect" },
    ],
  },
  play: async ({ canvasElement }) => {
    await expect(overlay(canvasElement).querySelectorAll("path")).toHaveLength(3);
  },
};

/** Caliper search boxes across edges, with and without the direction arrow, and rotated. */
export const Calipers: Story = {
  args: {
    primitives: [
      { kind: "caliper", cx: 240, cy: 512, width: 96, height: 48, angle: 0, label: "C1" },
      { kind: "caliper", cx: 1040, cy: 512, width: 96, height: 48, angle: Math.PI, label: "C2" },
      { kind: "caliper", cx: 640, cy: 192, width: 96, height: 48, angle: Math.PI / 2, showDirection: false },
      {
        kind: "caliper",
        cx: 440 + 90 * Math.SQRT1_2,
        cy: 400 + 90 * Math.SQRT1_2,
        width: 80,
        height: 36,
        angle: Math.PI / 4,
        tone: "warn",
        label: "C4",
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const svg = overlay(canvasElement);
    await expect(svg.querySelectorAll("polyline")).toHaveLength(3); // C3 has no arrow
    await expect(svg).toHaveTextContent("C1");
  },
};

/** Dimension lines with their value, offset off the measured span. */
export const Dimensions: Story = {
  args: {
    primitives: [
      { kind: "dimension", x1: 440, y1: 400, x2: 840, y2: 400, label: "400.0 px", offset: -120 },
      { kind: "dimension", x1: 240, y1: 832, x2: 1040, y2: 832, label: "800.0 px", offset: 40, tone: "normal" },
      { kind: "dimension", x1: 1040, y1: 192, x2: 1040, y2: 832, label: "640.0 px", tone: "muted" },
    ],
  },
  play: async ({ canvasElement }) => {
    const svg = overlay(canvasElement);
    await expect(svg.querySelectorAll("text")).toHaveLength(3);
    await expect(svg).toHaveTextContent("400.0 px");
  },
};

const TONES = ["signal", "normal", "defect", "warn", "muted"] as const;

/** The five tones side by side, on a circle and a labelled point each. */
export const Tones: Story = {
  args: {
    primitives: TONES.flatMap((tone, i): MeasurePrimitive[] => [
      { kind: "circle", cx: 320 + i * 160, cy: 920, r: 40, tone },
      { kind: "point", x: 320 + i * 160, y: 920, tone, label: tone },
    ]),
  },
  play: async ({ canvasElement }) => {
    const svg = overlay(canvasElement);
    const strokes = new Set([...svg.querySelectorAll("circle[fill='none']")].map((c) => c.getAttribute("stroke")));
    await expect(strokes.size).toBe(TONES.length);
    for (const tone of TONES) await expect(svg).toHaveTextContent(tone);
  },
};

/** A whole result — every kind, labelled — and the labels hold their screen size under zoom. */
export const LabelledResult: Story = {
  args: {
    primitives: [
      { kind: "segment", x1: 264, y1: 192, x2: 1016, y2: 192, tone: "normal" },
      { kind: "caliper", cx: 240, cy: 512, width: 96, height: 48, angle: 0, label: "C1" },
      { kind: "circle", cx: 440, cy: 400, r: 90, tone: "normal" },
      { kind: "circle", cx: 840, cy: 400, r: 90, tone: "normal" },
      { kind: "point", x: 440, y: 400, cross: true, label: "B1 Ø180.2" },
      { kind: "point", x: 840, y: 400, cross: true, label: "B2 Ø179.6" },
      { kind: "arc", cx: 640, cy: 660, r: 60, startAngle: -Math.PI * 0.8, endAngle: -Math.PI * 0.2, tone: "warn" },
      { kind: "point", x: 741, y: 276, tone: "defect", radius: 5, label: "scratch 0.9 mm" },
      { kind: "dimension", x1: 440, y1: 400, x2: 840, y2: 400, label: "400.0 px", offset: -120, tone: "signal" },
    ],
  },
  play: async ({ canvas, canvasElement }) => {
    const svg = overlay(canvasElement);
    await expect(svg).toHaveTextContent("scratch 0.9 mm");
    const hairline = () => Number(svg.querySelector("line")?.getAttribute("stroke-width"));
    await waitFor(() => expect(hairline()).toBeGreaterThan(1)); // at fit (< 100%), 1 screen px > 1 image px
    const atFit = hairline();
    await userEvent.click(canvas.getByRole("button", { name: "Zoom in" }));
    await userEvent.click(canvas.getByRole("button", { name: "Zoom in" }));
    await waitFor(() => expect(hairline()).toBeLessThan(atFit));
  },
};
