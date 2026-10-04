/** The click slop: a press that wanders less than 3 screen pixels is a click, not an edit. */

import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Point } from "./measureGeometry";
import type { RotatedShape } from "./shapeEdit";
import { ShapeEditor } from "./ShapeEditor";
import { ImageStage } from "./stage/ImageStage";

const SHAPE: RotatedShape = { cx: 200, cy: 150, width: 120, height: 80, rotation: 0 };

/** At 1:1 with the viewport at the origin (happy-dom lays nothing out), client = image + 0.5. */
const at = (p: Point) => ({ clientX: p.x + 0.5, clientY: p.y + 0.5, pointerId: 1, button: 0 });

function setup() {
  const onValueChange = vi.fn<(value: RotatedShape) => void>();
  const onCommit = vi.fn<(value: RotatedShape) => void>();
  const { container, getByRole } = render(
    <ImageStage image={{ width: 400, height: 300 }} view={{ scale: 1, tx: 0, ty: 0 }} onView={() => {}}>
      <ShapeEditor kind="rect" value={SHAPE} onValueChange={onValueChange} onCommit={onCommit} />
    </ImageStage>,
  );
  return { container, getByRole, onValueChange, onCommit };
}

describe("ShapeEditor — the click slop", () => {
  it("ignores moves within 3 px of the press, on the interior and on a handle", () => {
    const { container, getByRole, onValueChange, onCommit } = setup();
    const inside = getByRole("button", { name: /Shape/ });
    fireEvent.pointerDown(inside, at({ x: 200, y: 150 }));
    fireEvent.pointerMove(inside, at({ x: 202, y: 151 }));
    fireEvent.pointerUp(inside, at({ x: 202, y: 151 }));
    const handle = container.querySelector("[data-handle=e]")!;
    fireEvent.pointerDown(handle, at({ x: 260, y: 150 }));
    fireEvent.pointerMove(handle, at({ x: 261, y: 152 }));
    fireEvent.pointerUp(handle, at({ x: 261, y: 152 }));
    expect(onValueChange).not.toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("edits from the press point once the pointer has left the slop", () => {
    const { getByRole, onValueChange, onCommit } = setup();
    const inside = getByRole("button", { name: /Shape/ });
    fireEvent.pointerDown(inside, at({ x: 200, y: 150 }));
    fireEvent.pointerMove(inside, at({ x: 202, y: 150 }));
    fireEvent.pointerMove(inside, at({ x: 204, y: 150 }));
    expect(onValueChange).toHaveBeenLastCalledWith({ ...SHAPE, cx: 204 });
    // Once moved, a step back inside the slop still moves the shape.
    fireEvent.pointerMove(inside, at({ x: 201, y: 150 }));
    expect(onValueChange).toHaveBeenLastCalledWith({ ...SHAPE, cx: 201 });
    fireEvent.pointerUp(inside, at({ x: 201, y: 150 }));
    expect(onCommit).toHaveBeenCalledOnce();
  });
});
