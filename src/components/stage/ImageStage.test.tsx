/**
 * What the pure view math cannot prove: that the DOM the stage builds is the one the math
 * describes, and that a press reaching the viewport is read as a pan while a press a layer
 * claims is not.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { ImageStage, useStage } from "./ImageStage";
import { fitView, type StageView } from "./view";

const IMAGE = { width: 1280, height: 1024 };
const BOX = { width: 800, height: 600 };

/**
 * happy-dom lays nothing out, so `getBoundingClientRect` is 0×0 and `ResizeObserver` never
 * fires. Both are stubbed to a fixed box: the component's contract is "whatever the
 * viewport measures", and the measurement itself is the browser's job, not this test's.
 */
function withLayout(box = BOX) {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement,
  ) {
    return { left: 0, top: 0, right: box.width, bottom: box.height, ...box, x: 0, y: 0, toJSON: () => ({}) };
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private readonly callback: ResizeObserverCallback) {}
      observe(element: Element) {
        this.callback(
          [{ target: element, contentRect: box } as unknown as ResizeObserverEntry],
          this as unknown as ResizeObserver,
        );
      }
      unobserve() {}
      disconnect() {}
    },
  );
}

function Harness({
  onViewChange,
  layer,
}: {
  onViewChange?: (view: StageView) => void;
  layer?: React.ReactNode;
}) {
  const [view, setView] = useState<StageView | null>(null);
  return (
    <ImageStage
      image={IMAGE}
      view={view}
      onView={(next) => {
        setView(next);
        onViewChange?.(next);
      }}
      toolbar={<Probe />}
    >
      <div data-testid="layer">{layer}</div>
    </ImageStage>
  );
}

/** Reads the context back out, which is how every real layer sees the transform. */
function Probe() {
  const stage = useStage();
  const corner = stage.toViewport({ x: 0, y: 0 });
  const far = stage.toViewport({ x: IMAGE.width, y: IMAGE.height });
  return (
    <span data-testid="probe">
      {`${stage.view.scale.toFixed(9)} ${corner.x.toFixed(6)},${corner.y.toFixed(6)} ` +
        `${far.x.toFixed(6)},${far.y.toFixed(6)} ${stage.isFit} ${stage.imageLength(10).toFixed(9)}`}
    </span>
  );
}

function probe() {
  const parts = screen.getByTestId("probe").textContent!.split(" ");
  return {
    scale: Number(parts[0]),
    corner: parts[1]!,
    far: parts[2]!,
    fit: parts[3] === "true",
    ten: Number(parts[4]),
  };
}

describe("ImageStage", () => {
  it("lays the stage out at the image's own pixel size, so a layer needs no scaling of its own", () => {
    withLayout();
    const { container } = render(<Harness />);
    const stage = container.querySelector("[data-stage]") as HTMLElement;
    expect(stage.style.width).toBe("1280px");
    expect(stage.style.height).toBe("1024px");
    expect(stage.style.transform).toMatch(/^translate\(-?[\d.]+px, -?[\d.]+px\) scale\([\d.]+\)$/);
  });

  it("opens at 1:1 when the image fits, and at fit when it does not", () => {
    withLayout({ width: 800, height: 600 });
    render(<Harness />);
    // 1280x1024 does not fit in 800x600.
    expect(probe().scale).toBeCloseTo(600 / 1024, 6);
    expect(probe().fit).toBe(true);
  });

  it("puts the whole image on screen at fit and reports it as fit", () => {
    withLayout();
    render(<Harness />);
    const { corner, far } = probe();
    const expected = fitView(BOX, IMAGE);
    expect(corner).toBe(`${expected.tx.toFixed(6)},${expected.ty.toFixed(6)}`);
    expect(far).toBe(
      `${(expected.tx + IMAGE.width * expected.scale).toFixed(6)},` +
        `${(expected.ty + IMAGE.height * expected.scale).toFixed(6)}`,
    );
  });

  it("reports the image length that covers a fixed screen length, for screen-constant handles", () => {
    withLayout();
    render(<Harness />);
    const { scale, ten } = probe();
    expect(ten).toBeCloseTo(10 / scale, 3);
  });

  it("pans on a drag that reaches the viewport", () => {
    withLayout();
    const { container } = render(<Harness />);
    const viewport = container.firstElementChild as HTMLElement;

    // At fit the image exactly fills one axis and under-fills the other, so `clampView`
    // legitimately absorbs the whole drag. Zoom in first, where a pan has somewhere to go.
    fireEvent.keyDown(viewport, { key: "1" });
    const before = probe();

    fireEvent.pointerDown(viewport, { button: 0, clientX: 400, clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(viewport, { clientX: 340, clientY: 260, pointerId: 1 });
    fireEvent.pointerUp(viewport, { button: 0, clientX: 340, clientY: 260, pointerId: 1 });

    const after = probe();
    expect(after.scale).toBeCloseTo(before.scale, 9);
    const [bx, by] = before.corner.split(",").map(Number);
    const [ax, ay] = after.corner.split(",").map(Number);
    expect(ax).toBeCloseTo(bx! - 60, 6);
    expect(ay).toBeCloseTo(by! - 40, 6);
  });

  it("does not pan when a layer claims the press", () => {
    withLayout();
    const { container } = render(
      <Harness
        layer={
          <button
            type="button"
            data-testid="claimer"
            onPointerDown={(event) => event.stopPropagation()}
          />
        }
      />,
    );
    const before = probe();

    const claimer = screen.getByTestId("claimer");
    fireEvent.pointerDown(claimer, { button: 0, clientX: 400, clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(container.firstElementChild!, { clientX: 460, clientY: 400, pointerId: 1 });
    fireEvent.pointerUp(container.firstElementChild!, { button: 0, clientX: 460, clientY: 400, pointerId: 1 });

    expect(probe().corner).toBe(before.corner);
  });

  it("reports a click on the background that never became a drag", () => {
    withLayout();
    const clicked = vi.fn();
    function Fixture() {
      const [view, setView] = useState<StageView | null>(null);
      return (
        <ImageStage image={IMAGE} view={view} onView={setView} onBackgroundClick={clicked}>
          <div />
        </ImageStage>
      );
    }
    const { container } = render(<Fixture />);
    const viewport = container.firstElementChild as HTMLElement;

    fireEvent.pointerDown(viewport, { button: 0, clientX: 400, clientY: 300, pointerId: 1 });
    fireEvent.pointerUp(viewport, { button: 0, clientX: 401, clientY: 300, pointerId: 1 });
    expect(clicked).toHaveBeenCalledTimes(1);

    // A press that travelled is a pan, not a click.
    fireEvent.pointerDown(viewport, { button: 0, clientX: 400, clientY: 300, pointerId: 2 });
    fireEvent.pointerMove(viewport, { clientX: 460, clientY: 340, pointerId: 2 });
    fireEvent.pointerUp(viewport, { button: 0, clientX: 460, clientY: 340, pointerId: 2 });
    expect(clicked).toHaveBeenCalledTimes(1);
  });

  it("toggles fit against the view you were just at, not against 1:1", () => {
    withLayout();
    const { container } = render(<Harness />);
    const viewport = container.firstElementChild as HTMLElement;

    // Leave fit by zooming in through the context's own control.
    fireEvent.keyDown(viewport, { key: "1" });
    const zoomed = probe();
    expect(zoomed.fit).toBe(false);
    expect(zoomed.scale).toBeCloseTo(1, 6);

    fireEvent.doubleClick(viewport, { clientX: 400, clientY: 300 });
    expect(probe().fit).toBe(true);

    fireEvent.doubleClick(viewport, { clientX: 400, clientY: 300 });
    const restored = probe();
    expect(restored.fit).toBe(false);
    expect(restored.scale).toBeCloseTo(zoomed.scale, 6);
    expect(restored.corner).toBe(zoomed.corner);
  });

  it("has keyboard fit and 100%", () => {
    withLayout();
    const { container } = render(<Harness />);
    const viewport = container.firstElementChild as HTMLElement;

    fireEvent.keyDown(viewport, { key: "1" });
    expect(probe().scale).toBeCloseTo(1, 6);
    fireEvent.keyDown(viewport, { key: "0" });
    expect(probe().fit).toBe(true);
  });
});
