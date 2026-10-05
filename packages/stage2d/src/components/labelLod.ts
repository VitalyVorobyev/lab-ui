/**
 * Which labels a layer draws: the level-of-detail rule of the overlay grammar, shared by `PointSet`, `AreaSet` and `GridLayer`.
 *
 * Labels are 11 px mono. They are shown only where their anchors are at least 24 screen
 * pixels apart (so a zoomed-out scene shows none and a zoomed-in one shows all), at most 200 at
 * a time, and only inside the viewport. The hovered and selected items always carry theirs.
 */

import { useMemo } from "react";

import { thinPoints } from "./pointIndex";
import { useStage } from "./stage/ImageStage";
import { useScreenPx } from "./stage/useScreenPx";
import type { Rect } from "./stage/view";

/** Labels need this much room between anchors, in screen pixels (overlay grammar). */
export const LABEL_SPACING = 24;
/** The most label elements drawn at once. */
export const MAX_LABELS = 200;
/** The most hovered-or-selected labels forced on regardless of spacing. */
export const MAX_FORCED_LABELS = 50;

/** The image-space rectangle on screen, or `null` before the viewport is measured. */
export function visibleRect(view: { scale: number; tx: number; ty: number }, box: { width: number; height: number }): Rect | null {
  if (!(box.width > 0) || !(view.scale > 0)) return null;
  return { x: -view.tx / view.scale, y: -view.ty / view.scale, width: box.width / view.scale, height: box.height / view.scale };
}

/**
 * Choose the labels to draw.
 *
 * @param spaced - Anchors that are far enough apart, in priority order (`thinPoints`).
 * @param forced - Anchors that always carry a label: the hovered and the selected.
 * @param inView - Whether an anchor is inside the viewport.
 * @returns The anchor indices to label: the forced ones first (at most 50), then the spaced
 *   ones, 200 in all.
 */
export function pickLabelIndices(spaced: readonly number[], forced: readonly number[], inView: (index: number) => boolean): number[] {
  const shown = new Set<number>();
  for (const i of forced) {
    if (shown.size >= MAX_FORCED_LABELS) break;
    if (i >= 0 && inView(i)) shown.add(i);
  }
  for (const i of spaced) {
    if (shown.size >= MAX_LABELS) break;
    if (inView(i)) shown.add(i);
  }
  return [...shown];
}

/** What `useLabelIndices` reads. */
export interface LabelAnchors {
  /** Whether labels are shown at all. */
  enabled: boolean;
  /** Flat `[x0, y0, x1, y1, …]` anchors, in image coordinates. */
  xy: ArrayLike<number>;
  /** The anchors that have a label, in priority order. Pass a stable array. */
  labelled: readonly number[];
  /** The anchors that must carry theirs (hovered, selected) and have one. Pass a stable array. */
  forced: readonly number[];
}

/**
 * The anchors to label at the stage's current zoom and viewport. The spacing depends on the
 * zoom only, so panning does not reshuffle which anchors carry a label.
 *
 * @param anchors - See `LabelAnchors`.
 * @returns Anchor indices.
 */
export function useLabelIndices({ enabled, xy, labelled, forced }: LabelAnchors): number[] {
  const stage = useStage();
  const unit = useScreenPx()(1);
  const spacing = LABEL_SPACING * unit;
  const spaced = useMemo(
    () => (enabled && labelled.length > 0 ? thinPoints(xy, spacing, labelled) : []),
    [enabled, labelled, xy, spacing],
  );
  return useMemo(() => {
    if (!enabled || (spaced.length === 0 && forced.length === 0)) return [];
    const view = visibleRect(stage.view, stage.box);
    const inView = (i: number) => {
      if (view === null) return true;
      const x = xy[2 * i]!;
      const y = xy[2 * i + 1]!;
      return x >= view.x && x <= view.x + view.width && y >= view.y && y <= view.y + view.height;
    };
    return pickLabelIndices(spaced, forced, inView);
  }, [enabled, spaced, forced, xy, stage.view, stage.box]);
}
