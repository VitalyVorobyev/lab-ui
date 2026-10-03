/**
 * React wiring for the stage's hit-test registry: `useStageHitTest` for apps that ask "what
 * is under the pointer", and `useStageHitLayer` for layers that answer.
 */

import { use, useId, useLayoutEffect, useMemo, useRef } from "react";

import type { Point } from "../measureGeometry";
import { useStage } from "./ImageStage";
import { StageHitContext, type StagePointerEvent } from "./hitContext";
import {
  type HitCandidate,
  type HitId,
  type StageHit,
  type StageHitLayerSpec,
  type StageHitOptions,
} from "./hitTest";

/** The default pointer tolerance of `hitTest`, in screen pixels. */
const DEFAULT_RADIUS_PX = 6;

/** What `useStageHitTest` returns. */
export interface StageHitTestApi {
  /**
   * The best item under a point across every layer, or `null`.
   *
   * @param point - In image coordinates, e.g. a `StagePress.point`.
   * @param radiusScreenPx - The pointer's tolerance in screen pixels. Defaults to 6.
   * @param options - `pressable` limits the answer to layers that claim presses.
   */
  hitTest: (point: Point, radiusScreenPx?: number, options?: StageHitOptions) => StageHit | null;
  /**
   * Every layer's best item under a point, best first: higher priority, then nearer.
   * Parameters as `hitTest`.
   */
  hitTestAll: (point: Point, radiusScreenPx?: number, options?: StageHitOptions) => StageHit[];
}

/**
 * The stage's one hit-test, across every registered layer (`PointSet`, `PolylineSet`, and
 * any layer built with `useStageHitLayer`). A press handler uses it to decide what a press
 * means: an item under the pointer is selected, bare image is drawn on or panned.
 *
 * The answer comes from each layer's spatial index, never from the DOM, so it costs
 * microseconds at any scene size.
 *
 * @returns `{ hitTest, hitTestAll }`.
 * @throws `Error` outside an `ImageStage`, which is always a wiring bug.
 */
export function useStageHitTest(): StageHitTestApi {
  const registry = use(StageHitContext);
  if (registry === null) throw new Error("useStageHitTest must be used inside <ImageStage>.");
  const { imageLength } = useStage();
  return useMemo(
    () => ({
      hitTest: (point, radiusScreenPx = DEFAULT_RADIUS_PX, options) =>
        registry.hitTest(point, imageLength(radiusScreenPx), options),
      hitTestAll: (point, radiusScreenPx = DEFAULT_RADIUS_PX, options) =>
        registry.hitTestAll(point, imageLength(radiusScreenPx), options),
    }),
    [registry, imageLength],
  );
}

/** What a layer passes `useStageHitLayer`. */
export interface StageHitLayerOptions {
  /** The id hits report. Defaults to a generated, stable one; set it to tell layers apart. */
  layerId?: string | undefined;
  /** Rank against other layers; see `STAGE_HIT_PRIORITY`. */
  priority: number;
  /**
   * The item under `point`, if any, within `radius` image pixels. Use the layer's index
   * (`nearestPoint`, `nearestPolyline`), not the DOM.
   */
  pick: (point: Point, radius: number) => HitCandidate | null;
  /**
   * The hovered item changed. Setting this makes the stage route hover to the layer; the
   * best item under the pointer across layers is the hovered one.
   */
  onHover?: ((id: HitId | null) => void) | undefined;
  /**
   * A press landed on an item and nothing above it claimed it. Setting this makes the layer
   * claim presses on its items, so the stage does not pan from them. Return `false` to
   * decline one. For a touch tap this is the `pointerup`.
   */
  onPress?: ((id: HitId, event: StagePointerEvent) => boolean | void) | undefined;
}

/**
 * Register a layer with the stage's hit-test. The callbacks may change every render; the
 * registration does not, so a layer is never missing from a hit-test for a frame.
 *
 * @param options - How the layer answers `pick`, and whether it takes hover and presses.
 * @returns The layer's id, as hits report it.
 * @throws `Error` outside an `ImageStage`.
 */
export function useStageHitLayer(options: StageHitLayerOptions): string {
  const registry = use(StageHitContext);
  if (registry === null) throw new Error("useStageHitLayer must be used inside <ImageStage>.");
  const generatedId = useId();
  const id = options.layerId ?? generatedId;
  const latestRef = useRef(options);
  useLayoutEffect(() => {
    latestRef.current = options;
  });
  const priority = options.priority;
  useLayoutEffect(() => {
    // Everything the registry reads goes through `latestRef`, so one registration serves the
    // layer's whole life; `priority` and `id` are the only things that re-register it.
    const layer: StageHitLayerSpec<StagePointerEvent> = {
      id,
      priority,
      pick: (point, radius) => latestRef.current.pick(point, radius),
      get pressable() {
        return latestRef.current.onPress !== undefined;
      },
      get hover() {
        return latestRef.current.onHover === undefined ? undefined : (hovered: HitId | null) => latestRef.current.onHover?.(hovered);
      },
      get press() {
        return latestRef.current.onPress === undefined ? undefined : (hit: HitId, event: StagePointerEvent) => latestRef.current.onPress?.(hit, event);
      },
    };
    return registry.register(layer);
  }, [registry, id, priority]);
  return id;
}
