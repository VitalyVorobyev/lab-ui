/**
 * "What is under the pointer?", answered across layers.
 *
 * Each layer that can be picked registers a `pick` function over its own spatial index. The
 * stage asks every layer, ranks the answers and returns the best, so an app deciding what a
 * press means (select, draw or pan) asks one question instead of arbitrating between layers.
 * This module is the pure core: ranking, and a registry that also routes hover and presses.
 * The React wiring is `useStageHitTest.ts`. It imports neither React nor the DOM.
 *
 * Ranking: a higher `priority` wins outright (points above lines above areas above images),
 * then the smaller distance, then the layer id, so the result never depends on the order
 * layers mounted in.
 */

import type { Point } from "../measureGeometry";

/** What a layer is picked as, and so how it ranks against the layers around it. */
export const STAGE_HIT_PRIORITY = {
  /** A raster layer: only picked when nothing else is. */
  image: 0,
  /** A filled region or heatmap cell. */
  area: 100,
  /** A line or contour. */
  line: 200,
  /** A marker: small, so it wins over what it sits on. */
  point: 300,
} as const;

/** An item's identity within its layer. */
export type HitId = string | number;

/** What a layer's `pick` returns: the item, and how far from the pointer it is. */
export interface HitCandidate {
  /** The item's id. */
  id: HitId;
  /** Distance from the query point, in image pixels. Compared only within one priority. */
  dist: number;
}

/** One answer to a hit-test. */
export interface StageHit extends HitCandidate {
  /** The layer that answered. */
  layerId: string;
  /** The layer's priority. */
  priority: number;
}

/** What a layer registers. */
export interface StageHitLayerSpec<E = unknown> {
  /** Reported as `StageHit.layerId`. */
  id: string;
  /** Ranks this layer against others; see `STAGE_HIT_PRIORITY`. */
  priority: number;
  /**
   * The item under `point`, if any.
   *
   * @param point - The query, in image coordinates.
   * @param radius - The pointer's tolerance, in image pixels.
   */
  pick: (point: Point, radius: number) => HitCandidate | null;
  /** Whether a press on this layer's items does something (`press` is set and will claim). */
  readonly pressable?: boolean | undefined;
  /** The hovered item changed: an id, or `null` when the pointer left every item. */
  hover?: ((id: HitId | null) => void) | undefined;
  /** A press landed on an item. Return `false` to decline it. */
  press?: ((id: HitId, event: E) => boolean | void) | undefined;
  /**
   * A double-click landed on an item, at `point` (image coordinates). Return `false` to
   * decline it.
   */
  doubleClick?: ((id: HitId, point: Point) => boolean | void) | undefined;
}

/** Options of a hit-test. */
export interface StageHitOptions {
  /** Consider only layers whose presses are claimed (`pressable`). */
  pressable?: boolean | undefined;
}

/**
 * Order two hits, best first.
 *
 * @returns Negative when `a` ranks above `b`.
 */
export function compareHits(a: StageHit, b: StageHit): number {
  if (a.priority !== b.priority) return b.priority - a.priority;
  if (a.dist !== b.dist) return a.dist - b.dist;
  return a.layerId < b.layerId ? -1 : a.layerId > b.layerId ? 1 : 0;
}

/**
 * Sort hits, best first.
 *
 * @param hits - Any hits.
 * @returns A new, sorted array.
 */
export function sortHits(hits: readonly StageHit[]): StageHit[] {
  return [...hits].sort(compareHits);
}

/**
 * The best of some hits.
 *
 * @param hits - Any hits.
 * @returns The first by `compareHits`, or `null` when there are none.
 */
export function bestHit(hits: readonly StageHit[]): StageHit | null {
  let best: StageHit | null = null;
  for (const hit of hits) if (best === null || compareHits(hit, best) < 0) best = hit;
  return best;
}

/** The layers of one stage, and the routing of hover and presses between them. */
export interface HitRegistry<E = unknown> {
  /**
   * Add a layer.
   *
   * @returns The function that removes it.
   */
  register: (layer: StageHitLayerSpec<E>) => () => void;
  /** Every layer's best answer at `point`, sorted best first. */
  hitTestAll: (point: Point, radius: number, options?: StageHitOptions) => StageHit[];
  /** The best answer at `point`, or `null`. */
  hitTest: (point: Point, radius: number, options?: StageHitOptions) => StageHit | null;
  /**
   * Move hover to whatever is under `point`: the best hit among layers with a `hover`
   * handler gets `hover(id)`, and the layer that had it before gets `hover(null)`. Calls
   * nothing when the hovered item did not change.
   */
  routeHover: (point: Point, radius: number) => void;
  /** Clear hover, e.g. when the pointer leaves the stage or starts a pan. */
  clearHover: () => void;
  /**
   * Offer a press to the best pressable item under `point`, then the next, until one claims.
   *
   * @returns Whether a layer claimed it.
   */
  routePress: (point: Point, radius: number, event: E) => boolean;
  /**
   * Offer a double-click to the best item under `point` among layers that take double-clicks,
   * then the next, until one claims it.
   *
   * @returns Whether a layer claimed it.
   */
  routeDoubleClick: (point: Point, radius: number) => boolean;
}

/** Make an empty registry. */
export function createHitRegistry<E = unknown>(): HitRegistry<E> {
  const layers = new Set<StageHitLayerSpec<E>>();
  let hovered: { layer: StageHitLayerSpec<E>; id: HitId } | null = null;

  const answers = (point: Point, radius: number, options?: StageHitOptions): { hit: StageHit; layer: StageHitLayerSpec<E> }[] => {
    const out: { hit: StageHit; layer: StageHitLayerSpec<E> }[] = [];
    for (const layer of layers) {
      if (options?.pressable && layer.pressable !== true) continue;
      const found = layer.pick(point, radius);
      if (found) out.push({ hit: { id: found.id, dist: found.dist, layerId: layer.id, priority: layer.priority }, layer });
    }
    return out.sort((a, b) => compareHits(a.hit, b.hit));
  };

  const setHover = (next: { layer: StageHitLayerSpec<E>; id: HitId } | null) => {
    const previous = hovered;
    if (previous?.layer === next?.layer && previous?.id === next?.id) return;
    hovered = next;
    if (previous && previous.layer !== next?.layer) previous.layer.hover?.(null);
    next?.layer.hover?.(next.id);
  };

  return {
    register(layer) {
      layers.add(layer);
      return () => {
        layers.delete(layer);
        if (hovered?.layer === layer) hovered = null;
      };
    },
    hitTestAll: (point, radius, options) => answers(point, radius, options).map((a) => a.hit),
    hitTest: (point, radius, options) => answers(point, radius, options)[0]?.hit ?? null,
    routeHover(point, radius) {
      const best = answers(point, radius).find((a) => a.layer.hover !== undefined);
      setHover(best ? { layer: best.layer, id: best.hit.id } : null);
    },
    clearHover: () => setHover(null),
    routePress(point, radius, event) {
      for (const { hit, layer } of answers(point, radius, { pressable: true })) {
        if (layer.press?.(hit.id, event) !== false) return true;
      }
      return false;
    },
    routeDoubleClick(point, radius) {
      for (const { hit, layer } of answers(point, radius)) {
        const doubleClick = layer.doubleClick;
        if (doubleClick && doubleClick(hit.id, point) !== false) return true;
      }
      return false;
    },
  };
}
