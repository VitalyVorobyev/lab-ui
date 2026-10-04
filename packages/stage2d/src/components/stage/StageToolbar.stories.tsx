import type { Meta, StoryObj } from "@storybook/react-vite";
import { Crosshair, SquareDashed } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { ImageStage } from "./ImageStage";
import { StageButton, StageLayersMenu, StageReadout, StageToolbar, type StageLayer } from "./StageToolbar";
import type { StageView } from "./view";

const IMAGE = { width: 1280, height: 1024 };
const layerChange = fn();

const PLAIN_LAYERS: StageLayer[] = [
  { id: "region", label: "Region", visible: true, shortcut: "R" },
  { id: "contours", label: "Contours", visible: true },
  { id: "points", label: "Edge points", visible: false, disabled: true },
];

/** Layers named with a count beside the name, each with its colour on the canvas. */
const SWATCH_LAYERS: StageLayer[] = [
  {
    id: "edges",
    label: (
      <>
        Edges <span className="text-fg-muted tabular-nums">128</span>
      </>
    ),
    swatch: "#3fb6a8",
    visible: true,
  },
  {
    id: "fit",
    label: (
      <>
        Fitted circles <span className="text-fg-muted tabular-nums">3</span>
      </>
    ),
    swatch: "#d9a13b",
    visible: true,
  },
  { id: "grid", label: "Grid", swatch: "#8a94a0", visible: false },
];

/** An app's toolbar groups: tools with hints and keys, and a layers menu. */
function Workbench({
  width,
  initialLayers = PLAIN_LAYERS,
  heading,
}: {
  width?: number;
  initialLayers?: StageLayer[];
  heading?: ReactNode;
}) {
  const [view, setView] = useState<StageView | null>(null);
  const [tool, setTool] = useState<"select" | "region">("select");
  const [layers, setLayers] = useState<StageLayer[]>(initialLayers);
  return (
    <div style={{ height: 360, width }}>
      <ImageStage
        image={IMAGE}
        view={view}
        onView={setView}
        readout={<StageReadout cursor={{ x: 1023.4, y: 511.9 }} />}
        toolbar={
          <StageToolbar>
            <StageButton
              label="Select"
              hint="Click a contour; shift-drag to sweep."
              shortcut="V"
              pressed={tool === "select"}
              onClick={() => setTool("select")}
            >
              <Crosshair className="size-4" aria-hidden />
            </StageButton>
            <StageButton label="Region" shortcut="B" pressed={tool === "region"} onClick={() => setTool("region")}>
              <SquareDashed className="size-4" aria-hidden />
            </StageButton>
            <StageLayersMenu
              layers={layers}
              {...(heading === undefined ? {} : { heading })}
              onVisibleChange={(id, visible) => {
                layerChange(id, visible);
                setLayers((all) => all.map((layer) => (layer.id === id ? { ...layer, visible } : layer)));
              }}
            />
          </StageToolbar>
        }
      >
        <div className="absolute inset-0 bg-surface" />
      </ImageStage>
    </div>
  );
}

const meta = {
  title: "stage2d/StageToolbar",
  component: StageToolbar,
  subcomponents: { StageButton, StageLayersMenu },
  parameters: {
    docs: {
      description: {
        component: `The stage's floating controls and the parts an app builds its own groups from.

\`StageButton\` is the bar's icon button. Its tooltip is the native \`title\`; with \`hint\` and/or \`shortcut\` it is the
ui \`Tooltip\` instead — the label, the hint, and the key as a \`Kbd\` (this needs a \`TooltipProvider\` above the stage).
\`StageLayersMenu\` is a layers button opening a menu of layer toggles; it shows as pressed while any layer is hidden.
A layer's \`label\` may be rich content (a name and a count), and its \`swatch\` (a CSS colour) is drawn as a dot
before it to match the layer's colour on the canvas. \`label\` names the trigger; \`heading\` (defaulting to it)
titles the menu.

**Use** them for canvas controls: tools, layers, view commands.

**Don't** put task controls (thresholds, a model's settings) on the canvas — they belong in the inspector.

**Accessibility**: buttons are named by \`label\`; toggles expose \`aria-pressed\`; a \`shortcut\` is also
\`aria-keyshortcuts\` (binding the key is the app's). The layers menu is a \`menu\` of \`menuitemcheckbox\` items, each named by its label's text; a swatch is
\`aria-hidden\`, so the label must name the layer without its colour.`,
      },
    },
  },
  render: () => <Workbench />,
} satisfies Meta<typeof StageToolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ToolsWithHints: Story = {
  play: async ({ canvas }) => {
    const select = canvas.getByRole("button", { name: "Select" });
    await expect(select).toHaveAttribute("aria-keyshortcuts", "V");
    await expect(select).not.toHaveAttribute("title");
    // A plain StageButton keeps the native title.
    await expect(canvas.getByRole("button", { name: "Zoom in" })).toHaveAttribute("title", "Zoom in");
    select.focus();
    const tip = await within(document.body).findByRole("tooltip");
    await expect(tip).toHaveTextContent(/Click a contour/);
    await expect(tip).toHaveTextContent("V");
  },
};

export const LayersMenu: Story = {
  play: async ({ canvas }) => {
    layerChange.mockClear();
    const trigger = canvas.getByRole("button", { name: "Layers" });
    // Nothing switchable is hidden yet (the hidden layer is disabled).
    await expect(trigger).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(trigger);
    const body = within(document.body);
    const contours = await body.findByRole("menuitemcheckbox", { name: "Contours" });
    await userEvent.click(contours);
    await expect(layerChange).toHaveBeenCalledWith("contours", false);
    await waitFor(() => expect(contours).toHaveAttribute("aria-checked", "false"));
    await expect(body.getByRole("menuitemcheckbox", { name: "Edge points" })).toHaveAttribute("aria-disabled", "true");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(trigger).toHaveAttribute("aria-pressed", "true"));
  },
};

/**
 * A canvas narrower than 30rem: zoom out, zoom in and 100% collapse, and the readout wraps
 * onto its own line instead of being clipped.
 */
export const NarrowCanvas: Story = {
  render: () => <Workbench width={420} />,
  play: async ({ canvas, canvasElement }) => {
    const viewport = canvas.getByRole("application");
    // The collapse is CSS (a container query); check it only where the stylesheet is loaded.
    if (getComputedStyle(viewport).containerType === "inline-size") {
      const zoomIn = canvasElement.querySelector<HTMLElement>('button[aria-label="Zoom in"]')!;
      await expect(getComputedStyle(zoomIn).display).toBe("none");
      await expect(canvas.getByRole("button", { name: "Fit to window" })).toBeVisible();
    }
    const readout = canvasElement.querySelector("[data-readout-slot]")!;
    await expect(readout).toHaveTextContent("1023.4, 511.9 px");
    await expect((readout as HTMLElement).getBoundingClientRect().width).toBeGreaterThan(80);
  },
};

/**
 * Layers named with rich labels (a name and a count) and colour swatches, under a heading
 * of their own; the trigger keeps its short name.
 */
export const LayerSwatches: Story = {
  render: () => <Workbench initialLayers={SWATCH_LAYERS} heading="Overlays on this frame" />,
  play: async ({ canvas }) => {
    layerChange.mockClear();
    const trigger = canvas.getByRole("button", { name: "Layers" });
    // The grid is hidden and switchable, so the trigger says so.
    await expect(trigger).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(trigger);
    const body = within(document.body);
    await expect(await body.findByText("Overlays on this frame")).toBeInTheDocument();
    const edges = await body.findByRole("menuitemcheckbox", { name: "Edges 128" });
    const swatch = edges.querySelector<HTMLElement>("[data-swatch]");
    await expect(swatch).toHaveAttribute("aria-hidden", "true");
    await expect(swatch?.style.backgroundColor).toBe("rgb(63, 182, 168)");
    await userEvent.click(body.getByRole("menuitemcheckbox", { name: "Grid" }));
    await expect(layerChange).toHaveBeenCalledWith("grid", true);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(trigger).toHaveAttribute("aria-pressed", "false"));
  },
};
