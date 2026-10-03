/**
 * The React side of the hit-test: layers register through `useStageHitLayer`, and an app asks
 * through `useStageHitTest`. The ranking itself is `hitTest.test.ts`.
 */

import { act, render } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ImageStage } from "./ImageStage";
import { STAGE_HIT_PRIORITY } from "./hitTest";
import { useStageHitLayer, useStageHitTest, type StageHitTestApi } from "./useStageHitTest";

const IMAGE = { width: 1000, height: 800 };

afterEach(() => vi.restoreAllMocks());

/** A stage at 1:1 with a fixed 1000×800 viewport, so image and screen pixels coincide. */
function Stage({ children }: { children: React.ReactNode }) {
  const [view, setView] = useState<{ scale: number; tx: number; ty: number } | null>({ scale: 2, tx: 0, ty: 0 });
  return (
    <ImageStage image={IMAGE} view={view} onView={setView}>
      {children}
    </ImageStage>
  );
}

function Layer({ id, x, priority, picks }: { id: string; x: number; priority: number; picks?: () => void }) {
  useStageHitLayer({
    layerId: id,
    priority,
    pick: (p, radius) => {
      picks?.();
      return Math.abs(p.x - x) <= radius ? { id: `${id}-item`, dist: Math.abs(p.x - x) } : null;
    },
  });
  return null;
}

function Asker({ onApi }: { onApi: (api: StageHitTestApi) => void }) {
  onApi(useStageHitTest());
  return null;
}

describe("useStageHitTest", () => {
  it("asks every registered layer and ranks the answers", () => {
    let api!: StageHitTestApi;
    render(
      <Stage>
        <Layer id="lines" x={100} priority={STAGE_HIT_PRIORITY.line} />
        <Layer id="points" x={102} priority={STAGE_HIT_PRIORITY.point} />
        <Asker onApi={(a) => (api = a)} />
      </Stage>,
    );
    const best = api.hitTest({ x: 100, y: 0 });
    expect(best).toMatchObject({ layerId: "points", id: "points-item", priority: 300, dist: 2 });
    expect(api.hitTestAll({ x: 100, y: 0 }).map((h) => h.layerId)).toEqual(["points", "lines"]);
    expect(api.hitTest({ x: 500, y: 0 })).toBeNull();
  });

  it("converts the screen-px radius to image pixels at the current zoom", () => {
    let api!: StageHitTestApi;
    render(
      <Stage>
        <Layer id="points" x={100} priority={300} />
        <Asker onApi={(a) => (api = a)} />
      </Stage>,
    );
    // The stage is at 2×, so 6 screen px (the default) is 3 image px.
    expect(api.hitTest({ x: 103, y: 0 })).not.toBeNull();
    expect(api.hitTest({ x: 103.5, y: 0 })).toBeNull();
    expect(api.hitTest({ x: 108, y: 0 }, 16)).not.toBeNull();
    expect(api.hitTestAll({ x: 108, y: 0 }, 2)).toEqual([]);
  });

  it("stops asking a layer once it unmounts, and reports ids that are stable and distinct", () => {
    let api!: StageHitTestApi;
    const ids: string[] = [];
    function Anonymous() {
      ids.push(useStageHitLayer({ priority: 1, pick: () => ({ id: 1, dist: 0 }) }));
      return null;
    }
    function Toggle() {
      const [on, setOn] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setOn(false)}>
            off
          </button>
          {on && <Anonymous />}
          <Asker onApi={(a) => (api = a)} />
        </>
      );
    }
    const { getByText } = render(
      <Stage>
        <Anonymous />
        <Toggle />
      </Stage>,
    );
    const hits = api.hitTestAll({ x: 0, y: 0 });
    expect(hits).toHaveLength(2);
    expect(new Set(hits.map((h) => h.layerId)).size).toBe(2);
    expect(ids[0]).toBeTruthy();
    act(() => getByText("off").click());
    expect(api.hitTestAll({ x: 0, y: 0 })).toHaveLength(1);
  });

  it("calls the latest pick without re-registering", () => {
    let api!: StageHitTestApi;
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(
      <Stage>
        <Layer id="a" x={0} priority={1} picks={first} />
        <Asker onApi={(a) => (api = a)} />
      </Stage>,
    );
    api.hitTest({ x: 0, y: 0 });
    expect(first).toHaveBeenCalledTimes(1);
    rerender(
      <Stage>
        <Layer id="a" x={0} priority={1} picks={second} />
        <Asker onApi={(a) => (api = a)} />
      </Stage>,
    );
    api.hitTest({ x: 0, y: 0 });
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledTimes(1);
  });

  it("limits to layers that claim presses on request", () => {
    let api!: StageHitTestApi;
    function Pressable() {
      useStageHitLayer({ layerId: "press", priority: 1, pick: () => ({ id: 1, dist: 0 }), onPress: () => true });
      return null;
    }
    render(
      <Stage>
        <Layer id="quiet" x={0} priority={500} />
        <Pressable />
        <Asker onApi={(a) => (api = a)} />
      </Stage>,
    );
    expect(api.hitTest({ x: 0, y: 0 })?.layerId).toBe("quiet");
    expect(api.hitTest({ x: 0, y: 0 }, 6, { pressable: true })?.layerId).toBe("press");
  });

  it("is a wiring error outside a stage", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Asker onApi={() => {}} />)).toThrow(/inside <ImageStage>/);
    function Orphan() {
      useStageHitLayer({ priority: 1, pick: () => null });
      return null;
    }
    expect(() => render(<Orphan />)).toThrow(/inside <ImageStage>/);
  });
});
