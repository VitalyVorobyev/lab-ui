import { fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MaskEditor, paintMask } from "./MaskEditor";
import { ImageStage } from "./stage/ImageStage";

const image = { width: 8, height: 8 };
const view = { scale: 1, tx: 0, ty: 0 };
let putImageData: ReturnType<typeof vi.fn>;

beforeEach(() => {
  putImageData = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }),
    putImageData,
  } as unknown as CanvasRenderingContext2D);
});
afterEach(() => vi.restoreAllMocks());

describe("MaskEditor", () => {
  it("paints a continuous, bounded source-pixel stroke without mutating input", () => {
    const empty = new Uint8Array(64);
    const painted = paintMask(empty, 8, 8, { x: -2, y: 2 }, { x: 10, y: 2 }, 0.5, 1);
    expect([...painted.slice(16, 24)]).toEqual(Array(8).fill(1));
    expect(empty.every((value) => value === 0)).toBe(true);
    expect(paintMask(painted, 8, 8, { x: 3, y: 2 }, { x: 3, y: 2 }, 0.5, 0)[19]).toBe(0);
    expect(paintMask(empty, 8, 8, { x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 }, 0.5, 1).some(Boolean)).toBe(true);
    expect(() => paintMask(new Uint8Array(2), 8, 8, { x: 0, y: 0 }, { x: 0, y: 0 }, 1, 1)).toThrow(RangeError);
    expect(() => paintMask(empty, 8, 8, { x: NaN, y: 0 }, { x: 0, y: 0 }, 1, 1)).toThrow(RangeError);
  });

  it("renders a mask in the stage and paints one committed pointer stroke", () => {
    const mask = new Uint8Array(64);
    mask[9] = 1;
    const onChange = vi.fn<(mask: Uint8Array) => void>();
    const onCommit = vi.fn();
    const { getByRole } = render(<ImageStage image={image} view={view} onView={() => {}}><MaskEditor mask={mask} onChange={onChange} onCommit={onCommit} editable brushRadius={0.5} /></ImageStage>);
    expect(putImageData).toHaveBeenCalledOnce();
    const canvas = getByRole("button", { name: "Mask brush" });
    canvas.setPointerCapture = vi.fn();
    fireEvent.pointerDown(canvas, { button: 0, pointerId: 1, clientX: 1.5, clientY: 2.5 });
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 4.5, clientY: 2.5 });
    fireEvent.pointerUp(canvas, { pointerId: 1 });
    expect(onChange.mock.lastCall?.[0].slice(16, 24)).toEqual(new Uint8Array([0, 1, 1, 1, 1, 0, 0, 0]));
    expect(onCommit).toHaveBeenCalledOnce();
    expect(mask[17]).toBe(0);
  });

  it("supports keyboard paint, erase, and read-only display", () => {
    const onChange = vi.fn<(mask: Uint8Array) => void>();
    const onCommit = vi.fn();
    const { getByRole, rerender } = render(<ImageStage image={image} view={view} onView={() => {}}><MaskEditor mask={new Uint8Array(64)} onChange={onChange} onCommit={onCommit} editable brushRadius={0.5} /></ImageStage>);
    fireEvent.keyDown(getByRole("button", { name: "Mask brush" }), { key: "ArrowRight" });
    fireEvent.keyDown(getByRole("button", { name: "Mask brush" }), { key: "Enter" });
    expect(onChange.mock.lastCall?.[0][1]).toBe(1);
    rerender(<ImageStage image={image} view={view} onView={() => {}}><MaskEditor mask={onChange.mock.lastCall![0]} onChange={onChange} onCommit={onCommit} editable mode="erase" brushRadius={0.5} /></ImageStage>);
    fireEvent.keyDown(getByRole("button", { name: "Mask brush" }), { key: "Enter" });
    expect(onChange.mock.lastCall?.[0][1]).toBe(0);
    expect(onCommit).toHaveBeenCalledTimes(2);
    rerender(<ImageStage image={image} view={view} onView={() => {}}><MaskEditor mask={new Uint8Array(64)} onChange={onChange} /></ImageStage>);
    expect(getByRole("img", { name: "Mask brush" })).toBeTruthy();
  });

  it("defers to pan mode", () => {
    const onChange = vi.fn<(mask: Uint8Array) => void>();
    const { getByRole } = render(<ImageStage image={image} view={view} onView={() => {}} panTool><MaskEditor mask={new Uint8Array(64)} onChange={onChange} editable /></ImageStage>);
    const canvas = getByRole("button", { name: "Mask brush" });
    fireEvent.pointerDown(canvas, { button: 0, pointerId: 1 });
    fireEvent.keyDown(canvas, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
  });
});
