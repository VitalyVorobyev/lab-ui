import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { ContourEditor } from "./ContourEditor";
import { ImageStage } from "./stage/ImageStage";
import type { StageView } from "./stage/view";
import type { Point } from "./measureGeometry";

function Example() {
  const [view, setView] = useState<StageView | null>(null);
  const [points, setPoints] = useState<Point[]>([{ x: 35, y: 32 }, { x: 165, y: 30 }, { x: 175, y: 125 }, { x: 28, y: 130 }]);
  return <div style={{ height: 440 }}><ImageStage image={{ width: 210, height: 160 }} view={view} onView={setView}><div className="absolute inset-0 bg-canvas" /><ContourEditor points={points} onChange={setPoints} editable /></ImageStage></div>;
}

const meta = { title: "stage2d/ContourEditor", component: ContourEditor } satisfies Meta<typeof ContourEditor>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Editable: Story = { args: { points: [], onChange: () => {} }, render: () => <Example /> };
