import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fireEvent, waitFor } from "storybook/test";

import { ContourEditor } from "./ContourEditor";
import { ImageStage } from "./stage/ImageStage";
import type { StageView } from "./stage/view";
import type { Point } from "./measureGeometry";

function Example() {
  const [view, setView] = useState<StageView | null>(null);
  const [points, setPoints] = useState<Point[]>([{ x: 35, y: 32 }, { x: 165, y: 30 }, { x: 175, y: 125 }, { x: 28, y: 130 }]);
  return <div style={{ height: 440 }}><ImageStage image={{ width: 210, height: 160 }} view={view} onView={setView}><div className="absolute inset-0 bg-canvas" /><ContourEditor points={points} onChange={setPoints} editable /></ImageStage></div>;
}

function BorderExample() {
  const [points, setPoints] = useState<Point[]>([{ x: 40, y: 40 }, { x: 150, y: 40 }, { x: 150, y: 120 }]);
  return <div style={{ height: 440 }}><ImageStage image={{ width: 210, height: 160 }} view={{ scale: 2, tx: 0, ty: 0 }} onView={() => {}}><div className="absolute inset-0 bg-canvas" /><ContourEditor points={points} onChange={setPoints} editable bounds={{ x: -0.5, y: -0.5, width: 210, height: 160 }} /></ImageStage></div>;
}

const meta = { title: "stage2d/ContourEditor", component: ContourEditor } satisfies Meta<typeof ContourEditor>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Editable: Story = { args: { points: [], onChange: () => {} }, render: () => <Example /> };

/** Polygons in the area convention may lie exactly on the image border: `bounds` is the whole image area. */
export const OnTheBorder: Story = {
  args: { points: [], onChange: () => {} },
  render: () => <BorderExample />,
  play: async ({ canvas }) => {
    const handle = canvas.getByRole("button", { name: "Contour point 1" });
    handle.focus();
    for (let i = 0; i < 41; i++) await fireEvent.keyDown(handle, { key: "ArrowLeft" });
    await waitFor(() => expect(canvas.getByRole("button", { name: "Contour point 1" }).getAttribute("cx")).toBe("-0.5"));
  },
};
