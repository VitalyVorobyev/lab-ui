/**
 * A layer's entry in the stage's hit registry, as a component rather than a hook call: a layer
 * that renders it only while it is `pickable` really unregisters when it is not. Renders nothing.
 */

import type { HitCandidate, HitId } from "./hitTest";
import type { StagePointerEvent } from "./hitContext";
import type { Point } from "../measureGeometry";
import { useStageHitLayer } from "./useStageHitTest";

/** What `HitLayer` registers. */
export interface HitLayerProps {
  /** The id hits report; a generated one when omitted. */
  layerId: string | undefined;
  /** Rank against other layers. */
  priority: number;
  /** The item under `point` within `radius` image pixels, from the layer's index. */
  pick: (point: Point, radius: number) => HitCandidate | null;
  /** The hovered item changed. */
  onHover: (id: HitId | null) => void;
  /** A press landed on an item. Setting it makes the layer claim presses. */
  onPress: ((id: HitId, event: StagePointerEvent) => void) | undefined;
}

/** Registers one layer with the stage's hit-test for as long as it is mounted. */
export function HitLayer({ layerId, priority, pick, onHover, onPress }: HitLayerProps) {
  useStageHitLayer({ layerId, priority, pick, onHover, onPress: onPress ? (id, event) => onPress(id, event) : undefined });
  return null;
}
