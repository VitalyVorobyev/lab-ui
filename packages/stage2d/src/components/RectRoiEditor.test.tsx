/**
 * The press decision and the click slop, which the stories show but cannot pin down to the
 * pixel: which part of the box a press grabs, what a sub-slop jitter does, and the handle an
 * app's own press target draws through.
 */

import { act, fireEvent, render } from "@testing-library/react";
import { createRef, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { Point } from "./measureGeometry";
import { RectRoiEditor, type RectRoiEditorHandle, type RectRoiEditorProps } from "./RectRoiEditor";
import { ImageStage } from "./stage/ImageStage";
import type { StagePress } from "./stage/StageSurface";
import type { Rect } from "./stage/view";

const IMAGE = { width: 400, height: 300 };
const BOX: Rect = { x: 100, y: 80, width: 200, height: 120 };

/**
 * The client position over image point `p`. happy-dom lays nothing out, so the viewport sits
 * at the origin and, at 1:1, client = image + 0.5 (the pixel-centre convention).
 */
const at = (p: Point) => ({ clientX: p.x + 0.5, clientY: p.y + 0.5, pointerId: 1, button: 0 });

function setup(props: Partial<RectRoiEditorProps> = {}, stage: { panTool?: boolean; extra?: ReactNode } = {}) {
  const onValueChange = vi.fn<(value: Rect) => void>();
  const onCommit = vi.fn<(value: Rect) => void>();
  const outer = vi.fn();
  const ref = createRef<RectRoiEditorHandle>();
  const result = render(
    <div onPointerDown={outer}>
      <ImageStage image={IMAGE} view={{ scale: 1, tx: 0, ty: 0 }} onView={() => {}} panTool={stage.panTool ?? false}>
        {stage.extra}
        <RectRoiEditor ref={ref} value={BOX} onValueChange={onValueChange} onCommit={onCommit} {...props} />
      </ImageStage>
    </div>,
  );
  const q = (selector: string) => result.container.querySelector(selector)!;
  return { ...result, onValueChange, onCommit, outer, ref, q };
}

/** Press on `target` at `from`, move through `path` (on the window, where the drag listens), release at the end. */
function gesture(target: Element, from: Point, ...path: Point[]) {
  fireEvent.pointerDown(target, at(from));
  for (const p of path) fireEvent.pointerMove(window, at(p));
  fireEvent.pointerUp(window, at(path.at(-1) ?? from));
}

describe("RectRoiEditor — the press", () => {
  it("moves from the interior by default, and declines it with interior none", () => {
    const moving = setup();
    gesture(moving.q("[data-roi-interior]"), { x: 200, y: 140 }, { x: 210, y: 150 });
    expect(moving.onValueChange).toHaveBeenLastCalledWith({ ...BOX, x: 110, y: 90 });
    expect(moving.onCommit).toHaveBeenCalledOnce();
    expect(moving.outer).not.toHaveBeenCalled();
    moving.unmount();

    const through = setup({ interior: "none" });
    const inside = through.q("[data-roi-interior]");
    expect(inside.getAttribute("class")).toContain("pointer-events-none");
    // Still the focusable button.
    expect(inside.getAttribute("tabindex")).toBe("0");
    gesture(inside, { x: 200, y: 140 }, { x: 210, y: 150 });
    expect(through.onValueChange).not.toHaveBeenCalled();
    // Not claimed: the press went on to the stage and beyond.
    expect(through.outer).toHaveBeenCalledOnce();
  });

  it("grabs the box from the band along its outline, on either side, with interior none", () => {
    const { q, onValueChange, outer } = setup({ interior: "none" });
    const band = q("[data-roi-band]");
    expect(band.getAttribute("stroke")).toBe("transparent");
    expect(band.getAttribute("stroke-width")).toBe("12");
    // 4 px inside the top edge, and 4 px outside it.
    gesture(band, { x: 150, y: 84 }, { x: 160, y: 94 });
    expect(onValueChange).toHaveBeenLastCalledWith({ ...BOX, x: 110, y: 90 });
    gesture(band, { x: 150, y: 76 }, { x: 150, y: 66 });
    expect(onValueChange).toHaveBeenLastCalledWith({ ...BOX, y: 70 });
    // 9 px inside is past a mouse's tolerance.
    onValueChange.mockClear();
    gesture(q("[data-roi-interior]"), { x: 150, y: 89 }, { x: 160, y: 99 });
    expect(onValueChange).not.toHaveBeenCalled();
    expect(outer).toHaveBeenCalledOnce();
  });

  it("gives a press near a handle to that handle, even from the interior", () => {
    const { q, onValueChange } = setup();
    // 3 px inside the south-east corner: on the interior, but the handle is nearer.
    gesture(q("[data-roi-interior]"), { x: 297, y: 197 }, { x: 320, y: 220 });
    expect(onValueChange).toHaveBeenLastCalledWith({ x: 100, y: 80, width: 220, height: 140 });
    gesture(q("[data-handle=n]"), { x: 200, y: 80 }, { x: 200, y: 60 });
    expect(onValueChange).toHaveBeenLastCalledWith({ x: 100, y: 60, width: 200, height: 140 });
  });

  it("leaves presses alone for the hand tool, other buttons, and a read-only box", () => {
    const panning = setup({}, { panTool: true });
    gesture(panning.q("[data-handle=se]"), { x: 300, y: 200 }, { x: 320, y: 220 });
    expect(panning.onValueChange).not.toHaveBeenCalled();
    panning.unmount();

    const right = setup();
    fireEvent.pointerDown(right.q("[data-handle=se]"), { ...at({ x: 300, y: 200 }), button: 2 });
    fireEvent.pointerMove(window, at({ x: 320, y: 220 }));
    expect(right.onValueChange).not.toHaveBeenCalled();
    right.unmount();

    const readOnly = setup({ editable: false });
    expect(readOnly.container.querySelector("[data-roi-band], [data-roi-interior], [data-handle]")).toBeNull();
    expect(readOnly.container.querySelector("svg")?.hasAttribute("data-editable")).toBe(false);
  });
});

describe("RectRoiEditor — the click slop", () => {
  it("changes and commits nothing for a jitter under 3 px, and edits past it", () => {
    const { q, onValueChange, onCommit } = setup();
    gesture(q("[data-handle=se]"), { x: 300, y: 200 }, { x: 301, y: 201 }, { x: 302, y: 199 });
    gesture(q("[data-roi-interior]"), { x: 200, y: 140 }, { x: 202, y: 141 });
    expect(onValueChange).not.toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
    gesture(q("[data-handle=se]"), { x: 300, y: 200 }, { x: 304, y: 200 });
    expect(onValueChange).toHaveBeenLastCalledWith({ ...BOX, width: 204 });
    expect(onCommit).toHaveBeenCalledOnce();
  });

  it("puts the box back and commits nothing when the drag is interrupted", () => {
    const { q, onValueChange, onCommit } = setup();
    fireEvent.pointerDown(q("[data-roi-interior]"), at({ x: 200, y: 140 }));
    fireEvent.pointerMove(window, at({ x: 220, y: 140 }));
    expect(onValueChange).toHaveBeenLastCalledWith({ ...BOX, x: 120 });
    fireEvent.pointerCancel(window, at({ x: 220, y: 140 }));
    expect(onValueChange).toHaveBeenLastCalledWith(BOX);
    expect(onCommit).not.toHaveBeenCalled();
    // A cancel before any move has nothing to put back.
    onValueChange.mockClear();
    fireEvent.pointerDown(q("[data-roi-interior]"), at({ x: 200, y: 140 }));
    fireEvent.pointerCancel(window, at({ x: 200, y: 140 }));
    expect(onValueChange).not.toHaveBeenCalled();
  });
});

describe("RectRoiEditor — drawing", () => {
  it("draws from its own surface, and has none with drawSurface off", () => {
    const own = setup({ value: null, draw: true });
    const surface = own.q("[data-draw-surface]");
    gesture(surface, { x: 50, y: 40 }, { x: 52, y: 41 });
    expect(own.onValueChange).not.toHaveBeenCalled();
    fireEvent.pointerDown(surface, at({ x: 50, y: 40 }));
    fireEvent.pointerMove(window, at({ x: 150, y: 120 }));
    expect(own.container.querySelector("svg")?.hasAttribute("data-drawing")).toBe(true);
    fireEvent.pointerUp(window, at({ x: 150, y: 120 }));
    expect(own.onValueChange).toHaveBeenLastCalledWith({ x: 50, y: 40, width: 100, height: 80 });
    expect(own.onCommit).toHaveBeenCalledOnce();
    // Only the primary button draws.
    fireEvent.pointerDown(surface, { ...at({ x: 50, y: 40 }), button: 1 });
    fireEvent.pointerMove(window, at({ x: 150, y: 120 }));
    fireEvent.pointerUp(window, at({ x: 150, y: 120 }));
    expect(own.onCommit).toHaveBeenCalledOnce();
    own.unmount();

    const external = setup({ value: null, draw: true, drawSurface: false });
    expect(external.container.querySelector("[data-draw-surface]")).toBeNull();
  });

  it("starts a draw from the app's own pointerdown through the ref", () => {
    const { ref, onValueChange, onCommit } = setup({ value: null });
    const { getByTestId: get2, unmount } = render(<div data-testid="own" onPointerDown={(e) => ref.current?.startDraw(e)} />);
    // The app's own target: the draw converts through the stage the editor is in.
    fireEvent.pointerDown(get2("own"), at({ x: 20, y: 30 }));
    fireEvent.pointerMove(window, at({ x: 10, y: 10 }));
    fireEvent.pointerUp(window, at({ x: 10, y: 10 }));
    expect(onValueChange).toHaveBeenLastCalledWith({ x: 10, y: 10, width: 10, height: 20 });
    expect(onCommit).toHaveBeenCalledOnce();
    // Too small to be a region: a click.
    fireEvent.pointerDown(get2("own"), at({ x: 20, y: 30 }));
    fireEvent.pointerMove(window, at({ x: 23, y: 33 }));
    fireEvent.pointerUp(window, at({ x: 23, y: 33 }));
    expect(onCommit).toHaveBeenCalledOnce();
    // A touch tap reported on release is not a press to draw from.
    fireEvent.pointerUp(get2("own"), at({ x: 20, y: 30 }));
    unmount();
  });

  it("draws through drawDrag for a StageSurface, past the slop and clamped to the bounds", () => {
    const { ref, onValueChange, onCommit, container } = setup({ value: null, bounds: { x: 0, y: 0, width: 200, height: 100 } });
    const press: StagePress = { point: { x: 20, y: 30 }, client: { x: 20.5, y: 30.5 }, touch: false, radius: 6, shiftKey: false, altKey: false, metaKey: false };
    const move = (p: Point) => new PointerEvent("pointermove", { clientX: p.x + 0.5, clientY: p.y + 0.5 });
    const drag = ref.current!.drawDrag(press);
    expect(drag.claimsTouch).toBe(true);
    act(() => drag.onMove?.({ x: 21, y: 31 }, move({ x: 21, y: 31 })));
    expect(container.querySelector("svg")?.hasAttribute("data-drawing")).toBe(false);
    act(() => drag.onMove?.({ x: 300, y: 300 }, move({ x: 300, y: 300 })));
    expect(container.querySelector("svg")?.hasAttribute("data-drawing")).toBe(true);
    act(() => drag.onEnd?.({ x: 300, y: 300 }, move({ x: 300, y: 300 }), true));
    expect(onValueChange).toHaveBeenLastCalledWith({ x: 20, y: 30, width: 180, height: 70 });
    expect(onCommit).toHaveBeenCalledOnce();

    // A jitter draws nothing; a cancel drops the draft.
    const jitter = ref.current!.drawDrag(press);
    act(() => jitter.onMove?.({ x: 21, y: 31 }, move({ x: 21, y: 31 })));
    act(() => jitter.onEnd?.({ x: 21, y: 31 }, move({ x: 21, y: 31 }), false));
    const cancelled = ref.current!.drawDrag(press);
    act(() => cancelled.onMove?.({ x: 120, y: 80 }, move({ x: 120, y: 80 })));
    act(() => cancelled.onCancel?.());
    expect(container.querySelector("svg")?.hasAttribute("data-drawing")).toBe(false);
    expect(onCommit).toHaveBeenCalledOnce();
  });

  it("draws nothing through the ref while read-only or panning", () => {
    const readOnly = setup({ value: null, editable: false });
    const press: StagePress = { point: { x: 20, y: 30 }, client: { x: 20.5, y: 30.5 }, touch: false, radius: 6, shiftKey: false, altKey: false, metaKey: false };
    expect(readOnly.ref.current!.drawDrag(press)).toEqual({});
    const own = render(<div data-testid="own" onPointerDown={(e) => readOnly.ref.current?.startDraw(e)} />);
    fireEvent.pointerDown(own.getByTestId("own"), at({ x: 20, y: 30 }));
    fireEvent.pointerMove(window, at({ x: 100, y: 100 }));
    fireEvent.pointerUp(window, at({ x: 100, y: 100 }));
    expect(readOnly.onValueChange).not.toHaveBeenCalled();
    own.unmount();
    readOnly.unmount();

    const panning = setup({ value: null }, { panTool: true });
    const own2 = render(<div data-testid="own" onPointerDown={(e) => panning.ref.current?.startDraw(e)} />);
    fireEvent.pointerDown(own2.getByTestId("own"), at({ x: 20, y: 30 }));
    fireEvent.pointerMove(window, at({ x: 100, y: 100 }));
    fireEvent.pointerUp(window, at({ x: 100, y: 100 }));
    expect(panning.onValueChange).not.toHaveBeenCalled();
  });
});

describe("RectRoiEditor — the tint", () => {
  it("tints in the stroke colour by default, in fill when given, and not at all at opacity 0", () => {
    const outline = (props: Partial<RectRoiEditorProps>) => {
      const { container, unmount } = setup(props);
      const rect = container.querySelector("rect[stroke-dasharray]")!;
      const attrs = { fill: rect.getAttribute("fill"), opacity: rect.getAttribute("fill-opacity") };
      unmount();
      return attrs;
    };
    expect(outline({ stroke: "#ff0000" })).toEqual({ fill: "#ff0000", opacity: "0.06" });
    expect(outline({ stroke: "#ff0000", fill: "#00ff00", fillOpacity: 0.2 })).toEqual({ fill: "#00ff00", opacity: "0.2" });
    expect(outline({ fillOpacity: 0 })).toEqual({ fill: "none", opacity: null });
  });
});
