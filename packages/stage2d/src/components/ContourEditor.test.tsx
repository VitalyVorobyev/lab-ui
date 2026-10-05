import { render, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ContourEditor, nearestContourSegment } from "./ContourEditor";
import { ImageStage } from "./stage/ImageStage";
import { STAGE_HIT_PRIORITY, type HitId } from "./stage/hitTest";
import { useStageHitLayer, useStageHitTest } from "./stage/useStageHitTest";
import type { Point } from "./measureGeometry";

const points = [{ x: 2, y: 2 }, { x: 8, y: 2 }, { x: 8, y: 8 }, { x: 2, y: 8 }];

const viewportOf = (container: HTMLElement) => container.querySelector<HTMLElement>("[aria-label='Image canvas']")!;

describe("ContourEditor", () => {
  it("chooses the closest segment for a new point", () => {
    expect(nearestContourSegment(points, { x: 5, y: 2.4 })).toBe(0);
    expect(nearestContourSegment(points, { x: 7.8, y: 5 })).toBe(1);
  });

  it("has a closing segment only when closed", () => {
    // Left of the square: the closing segment, from (2, 8) back to (2, 2).
    expect(nearestContourSegment(points, { x: 1, y: 5 })).toBe(3);
    expect(nearestContourSegment(points, { x: 1, y: 5 }, true)).toBe(3);
    // Open, the nearest of the remaining three: the top and the bottom are as near, the first wins.
    expect(nearestContourSegment(points, { x: 1, y: 5 }, false)).toBe(0);
    expect(nearestContourSegment(points, { x: 1, y: 7 }, false)).toBe(2);
    expect(nearestContourSegment([], { x: 1, y: 7 }, false)).toBe(0);
  });

  it("draws an open contour as a polyline that keeps two vertices, and edits it without wrapping", () => {
    const onChange = vi.fn<(points: Point[]) => void>();
    const line = [{ x: 10, y: 10 }, { x: 50, y: 10 }];
    const render2 = (pts: Point[]) => (
      <ImageStage image={{ width: 100, height: 100 }} view={{ scale: 1, tx: 0, ty: 0 }} onView={() => {}}>
        <ContourEditor points={pts} closed={false} onChange={onChange} editable />
      </ImageStage>
    );
    const { container, getByRole, rerender } = render(render2(line));
    expect(container.querySelector("polyline")).not.toBeNull();
    expect(container.querySelector("polygon")).toBeNull();
    // Two vertices are the fewest an open contour keeps.
    fireEvent.keyDown(getByRole("button", { name: "Contour point 1" }), { key: "Delete" });
    expect(onChange).not.toHaveBeenCalled();
    // Insert on the last vertex goes midway to the one before it.
    fireEvent.keyDown(getByRole("button", { name: "Contour point 2" }), { key: "Insert" });
    expect(onChange).toHaveBeenLastCalledWith([{ x: 10, y: 10 }, { x: 30, y: 10 }, { x: 50, y: 10 }]);
    // A double-click past the open end's gap is not on a segment.
    const three = [{ x: 10, y: 10 }, { x: 50, y: 10 }, { x: 50, y: 50 }];
    rerender(render2(three));
    onChange.mockClear();
    fireEvent.doubleClick(viewportOf(container), { clientX: 28.5, clientY: 32.5 });
    expect(onChange).not.toHaveBeenCalled();
    // On the second segment it inserts after its start.
    fireEvent.doubleClick(viewportOf(container), { clientX: 52.5, clientY: 30.5 });
    expect(onChange).toHaveBeenLastCalledWith([{ x: 10, y: 10 }, { x: 50, y: 10 }, { x: 52, y: 30 }, { x: 50, y: 50 }]);
    // Three vertices: one may go.
    fireEvent.keyDown(getByRole("button", { name: "Contour point 2" }), { key: "Delete" });
    expect(onChange).toHaveBeenLastCalledWith([{ x: 10, y: 10 }, { x: 50, y: 50 }]);
  });

  it("registers pixel-center geometry and keyboard editing", () => {
    const onChange = vi.fn<(points: Point[]) => void>();
    const { container, getByRole } = render(<ImageStage image={{ width: 100, height: 80 }} view={{ scale: 1, tx: 0, ty: 0 }} onView={() => {}}><ContourEditor points={points} onChange={onChange} editable /></ImageStage>);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("viewBox")).toBe("-0.5 -0.5 100 80");
    fireEvent.keyDown(getByRole("button", { name: "Contour point 1" }), { key: "ArrowRight" });
    expect(onChange.mock.calls[0]?.[0][0]).toEqual({ x: 3, y: 2 });
    fireEvent.keyDown(getByRole("button", { name: "Contour point 1" }), { key: "Delete" });
    expect(onChange.mock.calls[1]?.[0]).toHaveLength(3);
  });

  it("inserts, nudges precisely, and preserves a three-point contour", () => {
    const onChange = vi.fn<(points: Point[]) => void>();
    const onCommit = vi.fn();
    const triangle = points.slice(0, 3);
    const { getByRole } = render(<ImageStage image={{ width: 10, height: 10 }} view={{ scale: 1, tx: 0, ty: 0 }} onView={() => {}}><ContourEditor points={triangle} onChange={onChange} onCommit={onCommit} editable label="Weld" /></ImageStage>);
    const handle = getByRole("button", { name: "Weld point 1" });
    fireEvent.keyDown(handle, { key: "Delete" });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.keyDown(handle, { key: "ArrowLeft", shiftKey: true });
    expect(onChange.mock.lastCall?.[0][0]).toEqual({ x: 1.9, y: 2 });
    fireEvent.keyDown(handle, { key: "Insert" });
    expect(onChange.mock.lastCall?.[0][1]).toEqual({ x: 5, y: 2 });
    expect(onCommit).toHaveBeenCalledTimes(2);
  });

  it("clamps edits to image bounds and adds a point on double-click", () => {
    const onChange = vi.fn<(points: Point[]) => void>();
    const onCommit = vi.fn();
    const { container, getByRole } = render(<ImageStage image={{ width: 10, height: 10 }} view={{ scale: 1, tx: 0, ty: 0 }} onView={() => {}}><ContourEditor points={points} onChange={onChange} onCommit={onCommit} editable /></ImageStage>);
    fireEvent.keyDown(getByRole("button", { name: "Contour point 1" }), { key: "ArrowUp" });
    expect(onChange.mock.lastCall?.[0][0]).toEqual({ x: 2, y: 1 });
    // No band of its own: the double-click reaches the stage, which offers it to the contour.
    expect(container.querySelector('polygon[stroke="transparent"]')).toBeNull();
    fireEvent.doubleClick(viewportOf(container), { clientX: 5, clientY: 2 });
    expect(onChange.mock.lastCall?.[0]).toHaveLength(5);
    expect(onCommit).toHaveBeenCalledTimes(2);
  });

  it("drags vertices and commits once when the gesture ends", () => {
    const onChange = vi.fn<(points: Point[]) => void>();
    const onCommit = vi.fn();
    const { getByRole } = render(<ImageStage image={{ width: 10, height: 10 }} view={{ scale: 1, tx: 0, ty: 0 }} onView={() => {}}><ContourEditor points={points} onChange={onChange} onCommit={onCommit} editable /></ImageStage>);
    const handle = getByRole("button", { name: "Contour point 1" });
    handle.setPointerCapture = vi.fn();
    fireEvent.pointerDown(handle, { button: 0, pointerId: 4 });
    fireEvent.pointerMove(handle, { clientX: 100, clientY: -10, pointerId: 4 });
    expect(onChange.mock.lastCall?.[0][0]).toEqual({ x: 9, y: 0 });
    fireEvent.pointerUp(handle, { pointerId: 4 });
    expect(onCommit).toHaveBeenCalledOnce();
  });

  it("commits only edits that change the contour", () => {
    const onChange = vi.fn<(points: Point[]) => void>();
    const onCommit = vi.fn();
    const edge = [{ x: 0, y: 0 }, { x: 8, y: 2 }, { x: 8, y: 8 }];
    const { getByRole } = render(<ImageStage image={{ width: 10, height: 10 }} view={{ scale: 1, tx: 0, ty: 0 }} onView={() => {}}><ContourEditor points={edge} onChange={onChange} onCommit={onCommit} editable /></ImageStage>);
    const handle = getByRole("button", { name: "Contour point 1" });
    handle.setPointerCapture = vi.fn();
    fireEvent.pointerDown(handle, { button: 0, pointerId: 2 });
    fireEvent.pointerUp(handle, { pointerId: 2 });
    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    expect(onChange).not.toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("clamps a double-clicked point into the image and keeps vertex double-clicks from the stage", () => {
    const onChange = vi.fn<(points: Point[]) => void>();
    const outer = vi.fn();
    const { container, getByRole } = render(<div onDoubleClick={outer}><ImageStage image={{ width: 10, height: 10 }} view={{ scale: 1, tx: 0, ty: 0 }} onView={() => {}}><ContourEditor points={points} onChange={onChange} editable /></ImageStage></div>);
    fireEvent.doubleClick(viewportOf(container), { clientX: -3, clientY: 5.5 });
    expect(onChange.mock.lastCall?.[0][4]).toEqual({ x: 0, y: 5 });
    outer.mockClear();
    fireEvent.doubleClick(getByRole("button", { name: "Contour point 2" }));
    expect(outer).not.toHaveBeenCalled();
  });

  it("does not edit when read-only or the pan tool is active", () => {
    const onChange = vi.fn<(points: Point[]) => void>();
    const { getByRole, rerender } = render(<ImageStage image={{ width: 10, height: 10 }} view={{ scale: 1, tx: 0, ty: 0 }} onView={() => {}}><ContourEditor points={points} onChange={onChange} editable /></ImageStage>);
    const handle = getByRole("button", { name: "Contour point 1" });
    fireEvent.pointerDown(handle, { button: 1, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 6, clientY: 6 });
    expect(onChange).not.toHaveBeenCalled();
    rerender(<ImageStage image={{ width: 10, height: 10 }} view={{ scale: 1, tx: 0, ty: 0 }} onView={() => {}} panTool><ContourEditor points={points} onChange={onChange} editable /></ImageStage>);
    fireEvent.keyDown(getByRole("button", { name: "Contour point 1" }), { key: "ArrowRight" });
    expect(onChange).not.toHaveBeenCalled();
    rerender(<ImageStage image={{ width: 10, height: 10 }} view={{ scale: 1, tx: 0, ty: 0 }} onView={() => {}}><ContourEditor points={points} onChange={onChange} /></ImageStage>);
    expect(getByRole("img", { name: "Contour" })).toBeTruthy();
  });

  it("clamps drags and nudges to custom bounds, reaching the image border", () => {
    const onChange = vi.fn<(points: Point[]) => void>();
    const bounds = { x: -0.5, y: -0.5, width: 10, height: 10 };
    const { getByRole } = render(<ImageStage image={{ width: 10, height: 10 }} view={{ scale: 1, tx: 0, ty: 0 }} onView={() => {}}><ContourEditor points={points} onChange={onChange} editable bounds={bounds} /></ImageStage>);
    const handle = getByRole("button", { name: "Contour point 1" });
    handle.setPointerCapture = vi.fn();
    fireEvent.pointerDown(handle, { button: 0, pointerId: 4 });
    fireEvent.pointerMove(handle, { clientX: -50, clientY: -50, pointerId: 4 });
    expect(onChange.mock.lastCall?.[0][0]).toEqual({ x: -0.5, y: -0.5 });
    fireEvent.pointerMove(handle, { clientX: 100, clientY: 100, pointerId: 4 });
    expect(onChange.mock.lastCall?.[0][0]).toEqual({ x: 9.5, y: 9.5 });
    fireEvent.pointerUp(handle, { pointerId: 4 });
  });

  it("nudges to a custom border and stops there", () => {
    const onChange = vi.fn<(points: Point[]) => void>();
    const edge = [{ x: 9.4, y: 5 }, { x: 5, y: 2 }, { x: 5, y: 8 }];
    const { getByRole } = render(<ImageStage image={{ width: 10, height: 10 }} view={{ scale: 1, tx: 0, ty: 0 }} onView={() => {}}><ContourEditor points={edge} onChange={onChange} editable bounds={{ x: -0.5, y: -0.5, width: 10, height: 10 }} /></ImageStage>);
    fireEvent.keyDown(getByRole("button", { name: "Contour point 1" }), { key: "ArrowRight" });
    expect(onChange.mock.lastCall?.[0][0]).toEqual({ x: 9.5, y: 5 });
  });

  it("drags a vertex only once the pointer has left the click slop", () => {
    const onChange = vi.fn<(points: Point[]) => void>();
    const onCommit = vi.fn();
    const { getByRole } = render(<ImageStage image={{ width: 100, height: 100 }} view={{ scale: 1, tx: 0, ty: 0 }} onView={() => {}}><ContourEditor points={points} onChange={onChange} onCommit={onCommit} editable /></ImageStage>);
    const handle = getByRole("button", { name: "Contour point 2" });
    handle.setPointerCapture = vi.fn();
    // Pressed at (8, 2), which is client (8.5, 2.5) at 1:1.
    fireEvent.pointerDown(handle, { button: 0, pointerId: 3, clientX: 8.5, clientY: 2.5 });
    fireEvent.pointerMove(handle, { pointerId: 3, clientX: 10, clientY: 4 });
    fireEvent.pointerUp(handle, { pointerId: 3, clientX: 10, clientY: 4 });
    expect(onChange).not.toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.pointerDown(handle, { button: 0, pointerId: 3, clientX: 8.5, clientY: 2.5 });
    fireEvent.pointerMove(handle, { pointerId: 3, clientX: 12.5, clientY: 2.5 });
    expect(onChange.mock.lastCall?.[0][1]).toEqual({ x: 12, y: 2 });
    // Once moving, it follows the pointer back inside the slop.
    fireEvent.pointerMove(handle, { pointerId: 3, clientX: 9.5, clientY: 2.5 });
    expect(onChange.mock.lastCall?.[0][1]).toEqual({ x: 9, y: 2 });
    fireEvent.pointerUp(handle, { pointerId: 3 });
    expect(onCommit).toHaveBeenCalledOnce();
  });

  it("leaves presses on the outline to the layers below, and answers the hit-test while editable", () => {
    const onPress = vi.fn();
    let hitAt: (p: Point) => HitId | null = () => null;
    function Probe() {
      const { hitTest } = useStageHitTest();
      useStageHitLayer({ layerId: "below", priority: STAGE_HIT_PRIORITY.area, pick: () => ({ id: "area", dist: 0 }), onPress });
      hitAt = (p) => hitTest(p)?.id ?? null;
      return null;
    }
    const view = { scale: 1, tx: 0, ty: 0 };
    const { container, rerender } = render(<ImageStage image={{ width: 10, height: 10 }} view={view} onView={() => {}}><Probe /><ContourEditor points={points} onChange={() => {}} editable layerId="contour" /></ImageStage>);
    // A press on the top edge: the contour takes no presses, so the area below gets it.
    fireEvent.pointerDown(viewportOf(container), { button: 0, pointerId: 1, clientX: 5.5, clientY: 2.5 });
    expect(onPress).toHaveBeenCalledWith("area", expect.anything());
    // The hit-test finds the top segment (index 0) over the area, and the right side (1).
    expect(hitAt({ x: 5, y: 2 })).toBe(0);
    expect(hitAt({ x: 8, y: 5 })).toBe(1);
    // Read-only, it does not.
    rerender(<ImageStage image={{ width: 10, height: 10 }} view={view} onView={() => {}}><Probe /><ContourEditor points={points} onChange={() => {}} layerId="contour" /></ImageStage>);
    expect(hitAt({ x: 5, y: 2 })).toBe("area");
  });

  it("takes a double-click near the outline instead of the stage's fit, and leaves one elsewhere to it", () => {
    const onChange = vi.fn<(points: Point[]) => void>();
    const square = [{ x: 20, y: 20 }, { x: 80, y: 20 }, { x: 80, y: 80 }, { x: 20, y: 80 }];
    const stage = (props: { panTool?: boolean; editable?: boolean }) => (
      <ImageStage image={{ width: 100, height: 100 }} view={{ scale: 1, tx: 0, ty: 0 }} onView={() => {}} panTool={props.panTool ?? false}>
        <ContourEditor points={square} onChange={onChange} editable={props.editable ?? true} />
      </ImageStage>
    );
    const { container, rerender } = render(stage({}));
    const viewport = viewportOf(container);
    // Just below the bottom side (index 2): the vertex goes after its start.
    fireEvent.doubleClick(viewport, { clientX: 50.5, clientY: 84.5 });
    expect(onChange.mock.lastCall?.[0][3]).toEqual({ x: 50, y: 84 });
    // In the middle, far from every side: not the contour's.
    onChange.mockClear();
    fireEvent.doubleClick(viewport, { clientX: 50.5, clientY: 50.5 });
    expect(onChange).not.toHaveBeenCalled();
    // The hand tool outranks it, and so does a read-only contour.
    rerender(stage({ panTool: true }));
    fireEvent.doubleClick(viewport, { clientX: 50.5, clientY: 84.5 });
    rerender(stage({ editable: false }));
    fireEvent.doubleClick(viewport, { clientX: 50.5, clientY: 84.5 });
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("ContourEditor — brush and erase", () => {
  /** A 100 px horizontal line at y = 50, in a 200 × 100 image at 1:1. */
  const LINE: Point[] = [{ x: 50, y: 50 }, { x: 150, y: 50 }];
  /** At 1:1 with the viewport at the origin, client = image + 0.5. */
  const at = (p: Point) => ({ clientX: p.x + 0.5, clientY: p.y + 0.5, pointerId: 1, button: 0 });

  function setup(props: Partial<Parameters<typeof ContourEditor>[0]> & { mode: "brush" | "erase" }, panTool = false) {
    const onChange = vi.fn<(points: Point[]) => void>();
    const onCommit = vi.fn();
    const onErase = vi.fn<(pieces: Point[][], range: { start: number; end: number }) => void>();
    const outer = vi.fn();
    const result = render(
      <div onPointerDown={outer} onDoubleClick={outer}>
        <ImageStage image={{ width: 200, height: 100 }} view={{ scale: 1, tx: 0, ty: 0 }} onView={() => {}} panTool={panTool}>
          <ContourEditor points={LINE} closed={false} onChange={onChange} onCommit={onCommit} onErase={onErase} editable brushRadius={10} {...props} />
        </ImageStage>
      </div>,
    );
    const surface = result.container.querySelector("[data-tool-surface]")!;
    return { ...result, onChange, onCommit, onErase, outer, surface };
  }

  it("covers the image with a tool surface and hides the vertex handles", () => {
    const { container, surface, queryByRole } = setup({ mode: "brush" });
    expect(surface).not.toBeNull();
    expect(container.querySelector("svg[data-mode='brush']")).not.toBeNull();
    expect(queryByRole("button", { name: /Contour point/ })).toBeNull();
  });

  it("pushes the contour from a snapshot past the slop, live, and commits on release", () => {
    const { surface, onChange, onCommit, outer } = setup({ mode: "brush" });
    fireEvent.pointerDown(surface, at({ x: 100, y: 50 }));
    expect(outer).not.toHaveBeenCalled();
    fireEvent.pointerMove(window, at({ x: 100, y: 52 }));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.pointerMove(window, at({ x: 100, y: 56 }));
    fireEvent.pointerMove(window, at({ x: 100, y: 58 }));
    const pushed = onChange.mock.lastCall![0];
    // Divided under the brush every 2.5 px, the centre pushed the whole 8 px, the ends untouched.
    expect(pushed.find((p) => p.x === 100)).toEqual({ x: 100, y: 58 });
    expect(pushed[0]).toEqual({ x: 50, y: 50 });
    expect(pushed.at(-1)).toEqual({ x: 150, y: 50 });
    // Every move starts again from the contour as it was at the press: one push, not two.
    expect(Math.max(...pushed.map((p) => p.y))).toBe(58);
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.pointerUp(window, at({ x: 100, y: 58 }));
    expect(onCommit).toHaveBeenCalledOnce();
  });

  it("keeps the pushed contour inside the bounds, and puts it back when interrupted", () => {
    const { surface, onChange, onCommit } = setup({ mode: "brush", bounds: { x: 0, y: 0, width: 199, height: 54 } });
    fireEvent.pointerDown(surface, at({ x: 100, y: 50 }));
    fireEvent.pointerMove(window, at({ x: 100, y: 70 }));
    expect(Math.max(...onChange.mock.lastCall![0].map((p) => p.y))).toBe(54);
    fireEvent.pointerCancel(window);
    expect(onChange).toHaveBeenLastCalledWith(LINE);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("declines a press whose brush does not reach the contour, a jitter, and presses in pan mode", () => {
    const far = setup({ mode: "brush" });
    fireEvent.pointerDown(far.surface, at({ x: 100, y: 75 }));
    expect(far.outer).toHaveBeenCalledOnce();
    fireEvent.pointerMove(window, at({ x: 100, y: 90 }));
    expect(far.onChange).not.toHaveBeenCalled();
    fireEvent.pointerDown(far.surface, at({ x: 100, y: 50 }));
    fireEvent.pointerMove(window, at({ x: 101, y: 51 }));
    fireEvent.pointerUp(window, at({ x: 101, y: 51 }));
    expect(far.onChange).not.toHaveBeenCalled();
    expect(far.onCommit).not.toHaveBeenCalled();
    far.unmount();

    const panning = setup({ mode: "erase" }, true);
    fireEvent.pointerDown(panning.surface, at({ x: 100, y: 50 }));
    fireEvent.pointerMove(window, at({ x: 130, y: 50 }));
    fireEvent.pointerUp(window, at({ x: 130, y: 50 }));
    expect(panning.onErase).not.toHaveBeenCalled();
  });

  it("previews the swept stretch and reports what is left on release", () => {
    const { container, surface, onErase, onChange } = setup({ mode: "erase" });
    fireEvent.pointerDown(surface, at({ x: 70, y: 52 }));
    fireEvent.pointerMove(window, at({ x: 110, y: 47 }));
    const preview = container.querySelector("[data-erase-preview]")!;
    expect(preview.getAttribute("points")).toBe("70,50 110,50");
    expect(preview.getAttribute("stroke")).toBe("var(--defect)");
    // Backwards past the press: the stretch still runs forward.
    fireEvent.pointerMove(window, at({ x: 60, y: 50 }));
    expect(container.querySelector("[data-erase-preview]")!.getAttribute("points")).toBe("60,50 70,50");
    fireEvent.pointerMove(window, at({ x: 120, y: 50 }));
    fireEvent.pointerUp(window, at({ x: 120, y: 50 }));
    expect(onErase).toHaveBeenCalledWith(
      [
        [{ x: 50, y: 50 }, { x: 70, y: 50 }],
        [{ x: 120, y: 50 }, { x: 150, y: 50 }],
      ],
      { start: 20, end: 70 },
    );
    expect(container.querySelector("[data-erase-preview]")).toBeNull();
    // The editor leaves the points to the app.
    expect(onChange).not.toHaveBeenCalled();
  });

  it("erases the shorter way round a closed contour, leaving one open piece", () => {
    const square = [{ x: 50, y: 20 }, { x: 150, y: 20 }, { x: 150, y: 80 }, { x: 50, y: 80 }];
    const { surface, onErase } = setup({ mode: "erase", points: square, closed: true });
    // From the left side just below the first vertex, up across it and along the top.
    fireEvent.pointerDown(surface, at({ x: 50, y: 30 }));
    fireEvent.pointerMove(window, at({ x: 70, y: 20 }));
    fireEvent.pointerUp(window, at({ x: 70, y: 20 }));
    // Perimeter 320. The press is at 310 (on the left side, 10 below the first vertex), the
    // release at 20: 30 forward across the first vertex, not 290 back.
    expect(onErase).toHaveBeenCalledOnce();
    const [pieces, range] = onErase.mock.calls[0]!;
    expect(range).toEqual({ start: 310, end: 20 });
    expect(pieces).toEqual([[{ x: 70, y: 20 }, { x: 150, y: 20 }, { x: 150, y: 80 }, { x: 50, y: 80 }, { x: 50, y: 30 }]]);
  });

  it("does nothing on release for a jitter, and draws the footprint under a hovering pointer", () => {
    const { container, surface, onErase, outer } = setup({ mode: "erase" });
    fireEvent.pointerDown(surface, at({ x: 100, y: 50 }));
    fireEvent.pointerMove(window, at({ x: 101, y: 51 }));
    fireEvent.pointerUp(window, at({ x: 101, y: 51 }));
    expect(onErase).not.toHaveBeenCalled();
    fireEvent.pointerMove(surface, at({ x: 30, y: 30 }));
    const brush = container.querySelector("[data-draft-brush]")!;
    expect(brush).not.toBeNull();
    expect(brush.getAttribute("stroke")).toBe("var(--defect)");
    fireEvent.pointerLeave(surface);
    expect(container.querySelector("[data-draft-brush]")).toBeNull();
    // A touch does not hover.
    fireEvent.pointerMove(surface, { ...at({ x: 30, y: 30 }), pointerType: "touch" });
    expect(container.querySelector("[data-draft-brush]")).toBeNull();
    // A double-click on the tool surface is the tool's, not the stage's.
    outer.mockClear();
    fireEvent.doubleClick(surface, at({ x: 100, y: 50 }));
    expect(outer).not.toHaveBeenCalled();
  });
});
