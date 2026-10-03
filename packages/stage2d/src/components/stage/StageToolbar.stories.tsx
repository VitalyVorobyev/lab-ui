import type { Meta, StoryObj } from "@storybook/react-vite";
import { Crosshair, SquareDashed } from "lucide-react";
import { useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { ImageStage } from "./ImageStage";
import { StageButton, StageLayersMenu, StageToolbar, type StageLayer } from "./StageToolbar";
import type { StageView } from "./view";

const IMAGE = { width: 1280, height: 1024 };
const layerChange = fn();

/** An app's toolbar groups: tools with hints and keys, and a layers menu. */
function Workbench() {
  const [view, setView] = useState<StageView | null>(null);
  const [tool, setTool] = useState<"select" | "region">("select");
  const [layers, setLayers] = useState<StageLayer[]>([
    { id: "region", label: "Region", visible: true, shortcut: "R" },
    { id: "contours", label: "Contours", visible: true },
    { id: "points", label: "Edge points", visible: false, disabled: true },
  ]);
  return (
    <div style={{ height: 360 }}>
      <ImageStage
        image={IMAGE}
        view={view}
        onView={setView}
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

**Use** them for canvas controls: tools, layers, view commands.

**Don't** put task controls (thresholds, a model's settings) on the canvas — they belong in the inspector.

**Accessibility**: buttons are named by \`label\`; toggles expose \`aria-pressed\`; a \`shortcut\` is also
\`aria-keyshortcuts\` (binding the key is the app's). The layers menu is a \`menu\` of \`menuitemcheckbox\` items.`,
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
