/**
 * How `AreaSet` groups its regions into batched paths: by appearance (state, role, colours),
 * either one batch per appearance or consecutive runs in item order. Pure, so the keys are
 * unit-tested without a DOM.
 */

import { areaPath, type Area, type AreaId } from "./areaIndex";
import type { OverlayRole } from "./overlayRole";

/** An item as batching sees it: a region and its appearance overrides. */
export interface BatchableArea extends Area {
  role?: OverlayRole | undefined;
  stroke?: string | undefined;
  fill?: string | undefined;
}

/** The regions of one batched path. */
export interface AreaBatch {
  /** The appearance key; several runs of one appearance share it under `paintOrder: "items"`. */
  key: string;
  /** A unique key for rendering (the appearance key, plus the run number for runs). */
  id: string;
  role: OverlayRole;
  /** The outline colour when the item or the layer set one; `undefined` paints the role. */
  stroke: string | undefined;
  /** The fill colour when an item set one; `undefined` paints the outline colour. */
  fill: string | undefined;
  dim: boolean;
  /** Item positions, ascending. */
  indices: number[];
  /** The outlines, concatenated (without the selected items under `selectionFill: "item"`). */
  d: string;
  /** Each item's own ring, aligned with `indices`, when fills are drawn apart from outlines. */
  fills: string[] | null;
}

/** What decides the batches. */
export interface AreaBatchOptions {
  /** The role of an item that names none. */
  role: OverlayRole;
  /** The layer's outline colour. */
  stroke: string | undefined;
  /** `"items"` makes batches consecutive runs in item order. */
  paintOrder: "appearance" | "items";
  /** `"evenodd"` gives every item its own fill path. */
  fillRule: "nonzero" | "evenodd";
  /** `"item"` keeps a selected item in its own batch, fill included. */
  selectionFill: "selection" | "item";
  selected: ReadonlySet<AreaId>;
  isDimmed: (id: AreaId) => boolean;
}

/**
 * The appearance key of an item. Without a custom colour it is `dim|role`, as before colours
 * existed; a custom colour appends the outline and fill it was given.
 *
 * @param dim - Whether the item is dimmed.
 * @param role - The item's role.
 * @param stroke - The outline colour, if any.
 * @param fill - The fill colour, if any.
 * @returns The key.
 */
export function areaBatchKey(dim: boolean, role: OverlayRole, stroke: string | undefined, fill: string | undefined): string {
  const base = `${dim ? 1 : 0}|${role}`;
  return stroke || fill ? `${base}|${stroke ?? ""}|${fill ?? ""}` : base;
}

/**
 * Groups items into batches. Selected items go to `picked` (drawn on top in the selection
 * colour), unless `selectionFill` is `"item"`: then they stay in their batch for the fill and
 * `picked` carries only their outlines.
 *
 * @param items - The regions.
 * @param options - What decides the grouping.
 * @returns The appearance batches in paint order, and the selected overlay.
 */
export function batchAreas(items: readonly BatchableArea[], options: AreaBatchOptions): { normal: AreaBatch[]; picked: AreaBatch | null } {
  const { role, stroke, paintOrder, fillRule, selectionFill, selected, isDimmed } = options;
  const keepSelected = selectionFill === "item";
  // Fills apart from outlines: needed per item for even-odd, and to leave selected outlines out.
  const separate = fillRule === "evenodd" || keepSelected;
  const byKey = new Map<string, AreaBatch>();
  const runs: AreaBatch[] = [];
  const picked: AreaBatch = { key: "selected", id: "selected", role: "selection", stroke: undefined, fill: undefined, dim: false, indices: [], d: "", fills: fillRule === "evenodd" && !keepSelected ? [] : null };

  items.forEach((item, i) => {
    const isSelected = selected.has(item.id);
    if (isSelected) {
      const d = areaPath(item.points);
      picked.indices.push(i);
      picked.d += d;
      picked.fills?.push(d);
      if (!keepSelected) return;
    }
    const itemRole = item.role ?? role;
    const itemStroke = item.stroke ?? stroke;
    const dim = isDimmed(item.id);
    const key = areaBatchKey(dim, itemRole, itemStroke, item.fill);
    let batch = paintOrder === "items" ? runs[runs.length - 1] : byKey.get(key);
    if (!batch || batch.key !== key) {
      batch = { key, id: paintOrder === "items" ? `${key}#${runs.length}` : key, role: itemRole, stroke: itemStroke, fill: item.fill, dim, indices: [], d: "", fills: separate ? [] : null };
      byKey.set(key, batch);
      runs.push(batch);
    }
    const d = areaPath(item.points);
    batch.indices.push(i);
    batch.fills?.push(d);
    if (!(isSelected && keepSelected)) batch.d += d;
  });
  return { normal: runs, picked: picked.indices.length > 0 ? picked : null };
}
