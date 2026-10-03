import { describe, expect, it, vi } from "vitest";

import {
  STAGE_HIT_PRIORITY,
  bestHit,
  compareHits,
  createHitRegistry,
  sortHits,
  type HitCandidate,
  type HitId,
  type StageHit,
  type StageHitLayerSpec,
} from "./hitTest";

const hit = (layerId: string, priority: number, dist: number, id: HitId = 1): StageHit => ({ layerId, priority, dist, id });

describe("ranking", () => {
  it("puts a higher priority first, whatever the distance", () => {
    const point = hit("points", STAGE_HIT_PRIORITY.point, 5);
    const line = hit("lines", STAGE_HIT_PRIORITY.line, 0);
    const area = hit("areas", STAGE_HIT_PRIORITY.area, 0);
    expect(sortHits([area, line, point]).map((h) => h.layerId)).toEqual(["points", "lines", "areas"]);
    expect(bestHit([area, line, point])).toBe(point);
  });

  it("breaks a priority tie by distance, then by layer id", () => {
    const near = hit("b", 300, 1);
    const far = hit("a", 300, 4);
    expect(sortHits([far, near])).toEqual([near, far]);
    const x = hit("x", 300, 2);
    const y = hit("y", 300, 2);
    expect(sortHits([y, x])).toEqual([x, y]);
    expect(compareHits(x, y)).toBeLessThan(0);
    expect(compareHits(y, x)).toBeGreaterThan(0);
    expect(compareHits(x, { ...x })).toBe(0);
  });

  it("does not mutate its input, and finds no best of nothing", () => {
    const input = [hit("b", 1, 1), hit("a", 2, 1)];
    sortHits(input);
    expect(input.map((h) => h.layerId)).toEqual(["b", "a"]);
    expect(bestHit([])).toBeNull();
  });
});

/** A layer over fixed points: picks the nearest within the radius. */
function layerOver(
  id: string,
  priority: number,
  points: Record<string, [number, number]>,
  extra: Partial<StageHitLayerSpec<string>> = {},
): StageHitLayerSpec<string> {
  return {
    id,
    priority,
    pick: (p, radius): HitCandidate | null => {
      let best: HitCandidate | null = null;
      for (const [key, [x, y]] of Object.entries(points)) {
        const dist = Math.hypot(p.x - x, p.y - y);
        if (dist <= radius && (best === null || dist < best.dist)) best = { id: key, dist };
      }
      return best;
    },
    ...extra,
  };
}

describe("the registry", () => {
  it("combines every layer's answer, best first", () => {
    const registry = createHitRegistry<string>();
    registry.register(layerOver("areas", STAGE_HIT_PRIORITY.area, { cell: [10, 10] }));
    registry.register(layerOver("points", STAGE_HIT_PRIORITY.point, { corner: [12, 10] }));
    expect(registry.hitTest({ x: 10, y: 10 }, 5)).toEqual({ layerId: "points", priority: 300, id: "corner", dist: 2 });
    expect(registry.hitTestAll({ x: 10, y: 10 }, 5).map((h) => h.layerId)).toEqual(["points", "areas"]);
    expect(registry.hitTest({ x: 500, y: 500 }, 5)).toBeNull();
    expect(registry.hitTestAll({ x: 500, y: 500 }, 5)).toEqual([]);
  });

  it("stops answering for a layer that unregistered", () => {
    const registry = createHitRegistry<string>();
    const remove = registry.register(layerOver("points", 300, { a: [0, 0] }));
    expect(registry.hitTest({ x: 0, y: 0 }, 1)).not.toBeNull();
    remove();
    expect(registry.hitTest({ x: 0, y: 0 }, 1)).toBeNull();
  });

  it("limits to pressable layers on request", () => {
    const registry = createHitRegistry<string>();
    registry.register(layerOver("quiet", 300, { a: [0, 0] }));
    registry.register(layerOver("loud", 200, { b: [0, 0] }, { pressable: true, press: () => true }));
    expect(registry.hitTest({ x: 0, y: 0 }, 1)?.layerId).toBe("quiet");
    expect(registry.hitTest({ x: 0, y: 0 }, 1, { pressable: true })?.layerId).toBe("loud");
    expect(registry.hitTestAll({ x: 0, y: 0 }, 1, { pressable: true })).toHaveLength(1);
  });

  describe("hover", () => {
    it("tells the best hovering layer which item, and the layer it left that it left", () => {
      const registry = createHitRegistry<string>();
      const enterA = vi.fn();
      const enterB = vi.fn();
      registry.register(layerOver("a", 300, { a1: [0, 0], a2: [50, 0] }, { hover: enterA }));
      registry.register(layerOver("b", 200, { b1: [100, 0] }, { hover: enterB }));

      registry.routeHover({ x: 1, y: 0 }, 3);
      expect(enterA).toHaveBeenLastCalledWith("a1");
      // The same item again: nothing to report.
      registry.routeHover({ x: 0, y: 1 }, 3);
      expect(enterA).toHaveBeenCalledTimes(1);
      // Another item of the same layer: just the new one, no null in between.
      registry.routeHover({ x: 50, y: 0 }, 3);
      expect(enterA.mock.calls).toEqual([["a1"], ["a2"]]);
      // Another layer: the old one is told it lost hover.
      registry.routeHover({ x: 100, y: 0 }, 3);
      expect(enterA).toHaveBeenLastCalledWith(null);
      expect(enterB).toHaveBeenLastCalledWith("b1");
      // Nothing under the pointer.
      registry.routeHover({ x: 300, y: 300 }, 3);
      expect(enterB).toHaveBeenLastCalledWith(null);
    });

    it("ignores layers that take no hover, and clears on request", () => {
      const registry = createHitRegistry<string>();
      const hover = vi.fn();
      registry.register(layerOver("silent", 400, { s: [0, 0] }));
      registry.register(layerOver("hovering", 100, { h: [0, 0] }, { hover }));
      registry.routeHover({ x: 0, y: 0 }, 1);
      expect(hover).toHaveBeenLastCalledWith("h");
      registry.clearHover();
      expect(hover).toHaveBeenLastCalledWith(null);
      registry.clearHover();
      expect(hover).toHaveBeenCalledTimes(2);
    });

    it("forgets a hover owned by a layer that unregistered", () => {
      const registry = createHitRegistry<string>();
      const hover = vi.fn();
      const remove = registry.register(layerOver("a", 300, { a: [0, 0] }, { hover }));
      registry.routeHover({ x: 0, y: 0 }, 1);
      remove();
      registry.clearHover();
      expect(hover).toHaveBeenCalledTimes(1);
    });
  });

  describe("presses", () => {
    it("offers a press to pressable layers topmost first, until one claims it", () => {
      const registry = createHitRegistry<string>();
      const declines = vi.fn(() => false);
      const claims = vi.fn();
      const unreached = vi.fn();
      registry.register(layerOver("top", 300, { t: [0, 0] }, { pressable: true, press: declines }));
      registry.register(layerOver("middle", 200, { m: [0, 0] }, { pressable: true, press: claims }));
      registry.register(layerOver("bottom", 100, { b: [0, 0] }, { pressable: true, press: unreached }));
      expect(registry.routePress({ x: 0, y: 0 }, 1, "event")).toBe(true);
      expect(declines).toHaveBeenCalledWith("t", "event");
      expect(claims).toHaveBeenCalledWith("m", "event");
      expect(unreached).not.toHaveBeenCalled();
    });

    it("reports no claim when nothing pressable is under the press", () => {
      const registry = createHitRegistry<string>();
      registry.register(layerOver("quiet", 300, { a: [0, 0] }));
      registry.register(layerOver("far", 200, { b: [90, 90] }, { pressable: true, press: () => true }));
      expect(registry.routePress({ x: 0, y: 0 }, 1, "event")).toBe(false);
    });

    it("does not claim for a layer flagged pressable that declines every item", () => {
      const registry = createHitRegistry<string>();
      registry.register(layerOver("l", 300, { a: [0, 0] }, { pressable: true, press: () => false }));
      expect(registry.routePress({ x: 0, y: 0 }, 1, "event")).toBe(false);
    });
  });
});
