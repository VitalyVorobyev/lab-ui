import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { MaskEditor } from "./MaskEditor";
import { ImageStage } from "./stage/ImageStage";
import type { StageView } from "./stage/view";

const width = 210;
const height = 160;
const initialMask = new Uint8Array(width * height);
for (let y = 38; y < 125; y++) {
  for (let x = 43; x < 170; x++) {
    if (((x - 107) / 63) ** 2 + ((y - 81) / 43) ** 2 <= 1) initialMask[y * width + x] = 1;
  }
}

function Example() {
  const [view, setView] = useState<StageView | null>(null);
  const [mask, setMask] = useState<Uint8Array>(initialMask);
  return <div style={{ height: 440 }}><ImageStage image={{ width, height }} view={view} onView={setView}><div className="absolute inset-0 bg-canvas" /><MaskEditor mask={mask} onChange={setMask} editable /></ImageStage></div>;
}

const meta = { title: "stage2d/MaskEditor", component: MaskEditor } satisfies Meta<typeof MaskEditor>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Editable: Story = { args: { mask: initialMask, onChange: () => {} }, render: () => <Example /> };
