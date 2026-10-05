import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DatumEditor, type DatumEditorProps } from "./DatumEditor";
import { ImageStage } from "./stage/ImageStage";

const IMAGE = { width: 201, height: 101 };

/** A 1:1 stage with the viewport at the page's origin: client and image coordinates differ by the pixel centre. */
function Stage(props: DatumEditorProps) {
  return (
    <ImageStage image={IMAGE} view={{ scale: 1, tx: 0, ty: 0 }} onView={() => {}}>
      <DatumEditor {...props} />
    </ImageStage>
  );
}

const at = (x: number, y: number, extra: Record<string, unknown> = {}) => ({
  clientX: x + 0.5,
  clientY: y + 0.5,
  button: 0,
  pointerId: 1,
  pointerType: "mouse",
  ...extra,
});

const button = (container: HTMLElement) => container.querySelector<SVGElement>("[role=button]")!;

describe("DatumEditor", () => {
  it("starts at the image's centre, pointing along +x, when given nothing", () => {
    const { container } = render(<Stage />);
    expect(button(container).getAttribute("aria-label")).toBe("Datum: origin 100, 50, angle 0°");
    expect(container.querySelector("[data-datum-ring]")?.getAttribute("stroke")).toBeNull();
    expect(container.querySelector("[data-datum] g:last-child")?.getAttribute("stroke")).toBe("var(--stage-model)");
  });

  it("moves on its own state, reporting each change, when uncontrolled", () => {
    const onValueChange = vi.fn();
    const onCommit = vi.fn();
    const { container } = render(<Stage defaultValue={{ origin: { x: 50, y: 50 }, angle: 0 }} onValueChange={onValueChange} onCommit={onCommit} />);
    fireEvent.pointerDown(button(container), at(50, 50));
    fireEvent.pointerMove(window, at(70, 60));
    fireEvent.pointerUp(window, at(70, 60));
    expect(onValueChange).toHaveBeenLastCalledWith({ origin: { x: 70, y: 60 }, angle: 0 });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(button(container).getAttribute("aria-label")).toBe("Datum: origin 70, 60, angle 0°");
  });

  it("treats a press that never leaves the slop as a click: no change, no commit", () => {
    const onValueChange = vi.fn();
    const onCommit = vi.fn();
    const { container } = render(<Stage onValueChange={onValueChange} onCommit={onCommit} />);
    fireEvent.pointerDown(button(container), at(100, 50));
    fireEvent.pointerMove(window, at(102, 51));
    fireEvent.pointerUp(window, at(102, 51));
    expect(onValueChange).not.toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("reverts a drag that is cancelled", () => {
    const onValueChange = vi.fn();
    const onCommit = vi.fn();
    const { container } = render(<Stage onValueChange={onValueChange} onCommit={onCommit} />);
    fireEvent.pointerDown(button(container), at(100, 50));
    fireEvent.pointerMove(window, at(120, 50));
    fireEvent.pointerCancel(window, at(120, 50));
    expect(onValueChange).toHaveBeenLastCalledWith({ origin: { x: 100, y: 50 }, angle: 0 });
    expect(onCommit).not.toHaveBeenCalled();
    expect(container.querySelector("svg[data-dragging]")).toBeNull();
  });

  it("ignores a secondary button and a press away from the glyph", () => {
    const onValueChange = vi.fn();
    const { container } = render(<Stage onValueChange={onValueChange} />);
    fireEvent.pointerDown(button(container), at(100, 50, { button: 2 }));
    fireEvent.pointerMove(window, at(130, 50));
    // The origin target is wider than the reach of a mouse press: its edge declines.
    fireEvent.pointerDown(button(container), at(100, 63.5));
    fireEvent.pointerMove(window, at(130, 70));
    expect(onValueChange).not.toHaveBeenCalled();
    expect(container.querySelector("svg[data-dragging]")).toBeNull();
  });

  it("snaps every turn with snapAlways, and turns from the arm without jumping to the pointer", () => {
    const onValueChange = vi.fn();
    const { container, rerender } = render(<Stage onValueChange={onValueChange} snapAlways angleSnap={Math.PI / 4} />);
    const arm = container.querySelector("[data-datum-arm]")!;
    // Grab the arm 4 px below its line, 25 px out, and carry that point a quarter turn about the
    // origin (to (−4, 25) from it): the datum turns a quarter, not to the pointer's own angle.
    fireEvent.pointerDown(arm, at(125, 54));
    fireEvent.pointerMove(window, at(96, 75));
    const last = onValueChange.mock.lastCall![0] as { angle: number };
    expect(last.angle).toBeCloseTo(Math.PI / 2, 9);
    fireEvent.pointerUp(window, at(96, 75));
    onValueChange.mockClear();
    // Back to +x, unsnapped: the turn follows the pointer.
    rerender(<Stage value={{ origin: { x: 100, y: 50 }, angle: 0 }} onValueChange={onValueChange} angleSnap={0} />);
    fireEvent.pointerDown(container.querySelector("[data-datum-arm]")!, at(125, 50));
    fireEvent.pointerMove(window, at(100 + 25 * Math.cos(0.3), 50 + 25 * Math.sin(0.3)));
    expect((onValueChange.mock.lastCall![0] as { angle: number }).angle).toBeCloseTo(0.3, 2);
  });

  it("takes no turn and no turning keys when not rotatable", () => {
    const onValueChange = vi.fn();
    const { container } = render(<Stage onValueChange={onValueChange} rotatable={false} />);
    expect(container.querySelector("[data-datum-arm]")).toBeNull();
    expect(container.querySelector("[data-handle=rotate]")).toBeNull();
    fireEvent.keyDown(button(container), { key: "]" });
    fireEvent.keyDown(button(container), { key: "Enter" });
    expect(onValueChange).not.toHaveBeenCalled();
    fireEvent.keyDown(button(container), { key: "ArrowUp" });
    expect(onValueChange).toHaveBeenLastCalledWith({ origin: { x: 100, y: 49 }, angle: 0 });
  });

  it("keeps the keys from the stage and steps by the grid", () => {
    const onView = vi.fn();
    const onValueChange = vi.fn();
    const { container } = render(
      <ImageStage image={IMAGE} view={{ scale: 1, tx: 0, ty: 0 }} onView={onView}>
        <DatumEditor value={{ origin: { x: 40, y: 40 }, angle: 0 }} onValueChange={onValueChange} originSnap={5} />
      </ImageStage>,
    );
    onView.mockClear();
    fireEvent.keyDown(button(container), { key: "ArrowRight", shiftKey: true });
    expect(onValueChange).toHaveBeenLastCalledWith({ origin: { x: 90, y: 40 }, angle: 0 });
    expect(onView).not.toHaveBeenCalled();
  });

  it("draws an arrowhead instead of a handle when it cannot be turned, and nothing to press when read-only", () => {
    const { container } = render(<Stage editable={false} className="extra" stroke="red" />);
    expect(button(container)).toBeNull();
    expect(container.querySelector("[data-datum] polyline")).not.toBeNull();
    expect(container.querySelector("svg")?.classList.contains("extra")).toBe(true);
    fireEvent.keyDown(container.querySelector("svg")!, { key: "ArrowUp" });
  });
});
