/**
 * Many closed regions over the image, hoverable and selectable: marker quads, drawn polygons,
 * region annotations, defect outlines.
 *
 * Drawn as a handful of batched paths, one per (state, role), each outline with its 12 % fill
 * in one element (ADR-0004 rule 1); the pointer is resolved by `nearestArea` through the
 * stage's hit registry, never by the DOM (rule 2); strokes and labels are sized in screen
 * pixels (rule 4). A scene of 5,000 quads is a dozen DOM nodes plus at most 200 labels.
 */

import { useMemo, useState } from "react";

import { areaCentre, areaPath, buildAreaIndex, nearestArea, type Area, type AreaId } from "./areaIndex";
import { useLabelIndices } from "./labelLod";
import { overlayRole, OVERLAY_STATE_OPACITY, OVERLAY_STATE_WIDTH, type OverlayRole } from "./overlayRole";
import { useStage } from "./stage/ImageStage";
import type { StagePointerEvent } from "./stage/hitContext";
import { STAGE_HIT_PRIORITY } from "./stage/hitTest";
import { useStageHitLayer } from "./stage/useStageHitTest";
import { useScreenPx } from "./stage/useScreenPx";
import { imageViewBox } from "./stage/view";

/** One region of an `AreaSet`. */
export interface AreaSetItem extends Area {
  /** The overlay role it is painted in. Defaults to the layer's `role`. */
  role?: OverlayRole | undefined;
  /** Text drawn at its centre (the mean of its vertices), when the zoom leaves room. */
  label?: string | undefined;
}

/** Props of `AreaSet`. */
export interface AreaSetProps {
  /** The regions, as closed rings in image coordinates. */
  items: readonly AreaSetItem[];
  /** The role of an item that names none. Defaults to `"feature"`: they are detected regions. */
  role?: OverlayRole | undefined;
  /** The hovered id, when the app controls hover (a list beside the stage hovers regions too). */
  hoveredId?: AreaId | null | undefined;
  /** Called when the region under the pointer changes. `null` when it leaves every region. */
  onHoverChange?: ((id: AreaId | null) => void) | undefined;
  /** The selected ids, drawn at 2.5 px in the selection colour. */
  selectedIds?: Iterable<AreaId> | undefined;
  /**
   * Ids drawn at 35 % opacity, as a set or a predicate (outside the current filter, say).
   * They still take hover and presses. Pass a stable value: a new one re-batches the layer.
   */
  dimmed?: Iterable<AreaId> | ((id: AreaId) => boolean) | undefined;
  /**
   * A press landed on a region. Setting it makes the layer claim presses inside its regions,
   * so the stage does not pan from them. The event is the `pointerdown` (the `pointerup` for
   * a touch tap), so `useShapeDrag` can start a drag from it.
   *
   * A mounted `StageSurface` hears a press first; there, ask `useStageHitTest` what is
   * under it instead.
   */
  onItemPress?: ((id: AreaId, event: StagePointerEvent) => void) | undefined;
  /** Show the items' `label`s where the zoom leaves room for them. On by default. */
  labels?: boolean | undefined;
  /**
   * Tick the first vertex: a short line from vertex 0 towards the centre, so the orientation
   * of a marker quad reads (the overlay grammar's "corner 0 ticked"). Off by default.
   */
  firstVertexTick?: boolean | undefined;
  /** Draw the dark band under every outline. On by default; off for a fast, flat layer. */
  halo?: boolean | undefined;
  /** CSS colour of selected regions. Defaults to the overlay `selection` role. */
  selectionStroke?: string | undefined;
  /** The id hit-tests report for this layer. Defaults to a generated one. */
  layerId?: string | undefined;
  /** Rank against other layers in hit-tests. Defaults to `STAGE_HIT_PRIORITY.area`. */
  priority?: number | undefined;
  /** The layer's accessible name. Defaults to "Areas". */
  label?: string | undefined;
}

const HALO = overlayRole("halo");
const LABEL = overlayRole("label");
/** The fill of a region under its outline (overlay grammar: outline plus 12 % fill). */
const FILL_OPACITY = 0.12;
/** How long the first-vertex tick is, in screen pixels, at most. */
const TICK_PX = 8;

/** The regions of one batched path. */
interface Batch {
  key: string;
  role: OverlayRole;
  dim: boolean;
  /** Item positions, ascending. */
  indices: number[];
  /** The outlines, concatenated. */
  d: string;
}

/**
 * A selectable set of closed regions inside an `ImageStage`.
 *
 * - **Rendering**: an outline and its 12 % fill, in the item's role (`feature` by default).
 *   Rings are wound alike before they are batched, so overlapping regions never cut a hole in
 *   each other.
 * - **States**, from visual-language §5: default 1.5 screen px (1 for `model` and
 *   `structure`), hover 2, selected 2.5 in the selection colour, dimmed at 35 % opacity. Every
 *   outline has a halo. A region has no ring: its outline at 2.5 px is the mark.
 * - **Labels** at the centre of a region, only where regions are at least 24 screen px apart,
 *   at most 200 at a time. The hovered and selected regions always carry theirs.
 * - **Picking** goes through the stage's hit registry: a press within the pointer's tolerance of
 *   an outline picks that region, else the smallest region containing the point. `onHoverChange`
 *   and `onItemPress` here, and `useStageHitTest` for an app that arbitrates between layers.
 *
 * The SVG carries `data-hovered` (the hovered id).
 */
export function AreaSet({
  items,
  role = "feature",
  hoveredId,
  onHoverChange,
  selectedIds,
  dimmed,
  onItemPress,
  labels = true,
  firstVertexTick = false,
  halo = true,
  selectionStroke = overlayRole("selection"),
  layerId,
  priority = STAGE_HIT_PRIORITY.area,
  label = "Areas",
}: AreaSetProps) {
  const stage = useStage();
  const px = useScreenPx();
  const unit = px(1);

  const index = useMemo(() => buildAreaIndex(items), [items]);
  const selectedSet = useMemo(() => new Set(selectedIds ?? []), [selectedIds]);
  const isDimmed = useMemo(() => {
    if (typeof dimmed === "function") return dimmed;
    const set = new Set(dimmed ?? []);
    return (id: AreaId) => set.has(id);
  }, [dimmed]);
  const positionOf = useMemo(() => new Map(items.map((item, i) => [item.id, i])), [items]);

  const [ownHover, setOwnHover] = useState<AreaId | null>(null);
  const hoverId = hoveredId !== undefined ? hoveredId : ownHover;

  useStageHitLayer({
    layerId,
    priority,
    pick: (point, radius) => {
      const hit = nearestArea(index, point, radius);
      return hit ? { id: hit.id, dist: hit.inside ? 0 : hit.distance } : null;
    },
    onHover: (id) => {
      setOwnHover(id);
      onHoverChange?.(id);
    },
    onPress: onItemPress ? (id, event) => onItemPress(id, event) : undefined,
  });

  // Regions grouped by appearance. Rebuilt when the items or the selection change, never on
  // hover or on a view change.
  const groups = useMemo(() => {
    const normal = new Map<string, Batch>();
    const picked: Batch = { key: "selected", role: "selection", dim: false, indices: [], d: "" };
    items.forEach((item, i) => {
      if (selectedSet.has(item.id)) {
        picked.indices.push(i);
        picked.d += areaPath(item.points);
        return;
      }
      const itemRole = item.role ?? role;
      const dim = isDimmed(item.id);
      const key = `${dim ? 1 : 0}|${itemRole}`;
      let batch = normal.get(key);
      if (!batch) {
        batch = { key, role: itemRole, dim, indices: [], d: "" };
        normal.set(key, batch);
      }
      batch.indices.push(i);
      batch.d += areaPath(item.points);
    });
    return { normal: [...normal.values()], picked: picked.indices.length > 0 ? picked : null };
  }, [items, role, selectedSet, isDimmed]);

  // The tick is a line a few screen pixels long, so it is the one thing here that follows
  // the zoom: regenerated per zoom step, in O(regions).
  const ticks = useMemo(() => {
    if (!firstVertexTick) return [];
    const batches = groups.picked ? [...groups.normal, groups.picked] : groups.normal;
    return batches.map((batch) => {
      let d = "";
      for (const i of batch.indices) d += tickPath(items[i]!.points, TICK_PX * unit);
      return { batch, d };
    });
  }, [firstVertexTick, groups, items, unit]);

  const hoverItem = hoverId !== null ? items[positionOf.get(hoverId) ?? -1] : undefined;
  const hoverSelected = hoverItem ? selectedSet.has(hoverItem.id) : false;
  const hoverRole = hoverItem?.role ?? role;

  // Labels sit at the centre of a region; the layout is the shared level-of-detail rule.
  const anchors = useMemo(() => {
    const xy = new Float64Array(items.length * 2);
    const labelled: number[] = [];
    items.forEach((item, i) => {
      const c = areaCentre(item.points);
      xy[2 * i] = c?.x ?? Number.NaN;
      xy[2 * i + 1] = c?.y ?? Number.NaN;
      if (item.label) labelled.push(i);
    });
    return { xy, labelled };
  }, [items]);
  const forced = useMemo(() => {
    const list: number[] = [];
    if (hoverItem?.label) list.push(positionOf.get(hoverItem.id)!);
    for (const id of selectedSet) {
      const i = positionOf.get(id);
      if (i !== undefined && items[i]!.label) list.push(i);
    }
    return list;
  }, [hoverItem, selectedSet, positionOf, items]);
  const shownLabels = useLabelIndices({ enabled: labels, xy: anchors.xy, labelled: anchors.labelled, forced });

  const widthOf = (itemRole: OverlayRole, state: "default" | "hover" | "selected"): number => {
    const thin = itemRole === "model" || itemRole === "structure";
    return px(OVERLAY_STATE_WIDTH[state] - (thin && state !== "selected" ? 0.5 : 0));
  };

  return (
    <svg
      viewBox={imageViewBox(stage.image)}
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      role="img"
      aria-label={`${label}: ${items.length} ${items.length === 1 ? "area" : "areas"}, ${selectedSet.size} selected`}
      data-hovered={hoverId ?? undefined}
    >
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {groups.normal.map((batch) => (
          <g key={batch.key} opacity={batch.dim ? OVERLAY_STATE_OPACITY.dimmed : undefined}>
            {halo && <path d={batch.d} stroke={HALO} strokeWidth={widthOf(batch.role, "default") + px(2)} opacity={0.6} />}
            <path
              data-batch={batch.key}
              d={batch.d}
              fill={overlayRole(batch.role)}
              fillOpacity={FILL_OPACITY}
              stroke={overlayRole(batch.role)}
              strokeWidth={widthOf(batch.role, "default")}
            />
          </g>
        ))}
        {groups.picked && (
          <>
            {halo && <path d={groups.picked.d} stroke={HALO} strokeWidth={widthOf("selection", "selected") + px(2)} />}
            <path
              data-selected-areas=""
              d={groups.picked.d}
              fill={selectionStroke}
              fillOpacity={FILL_OPACITY}
              stroke={selectionStroke}
              strokeWidth={widthOf("selection", "selected")}
            />
          </>
        )}
        {hoverItem && (
          <>
            {halo && (
              <path d={areaPath(hoverItem.points)} stroke={HALO} strokeWidth={widthOf(hoverRole, hoverSelected ? "selected" : "hover") + px(2)} />
            )}
            <path
              data-hovered-area=""
              d={areaPath(hoverItem.points)}
              stroke={hoverSelected ? selectionStroke : overlayRole(hoverRole)}
              strokeWidth={widthOf(hoverRole, hoverSelected ? "selected" : "hover")}
            />
          </>
        )}
        {ticks.map(({ batch, d }) => (
          <g key={`tick|${batch.key}`} opacity={batch.dim ? OVERLAY_STATE_OPACITY.dimmed : undefined}>
            {halo && <path d={d} stroke={HALO} strokeWidth={px(OVERLAY_STATE_WIDTH.selected + 2)} opacity={0.6} />}
            <path
              data-ticks={batch.key}
              d={d}
              stroke={batch === groups.picked ? selectionStroke : overlayRole(batch.role)}
              strokeWidth={px(OVERLAY_STATE_WIDTH.selected)}
            />
          </g>
        ))}
      </g>
      {shownLabels.length > 0 && (
        <g data-labels="" fontSize={px(11)} className="font-mono" stroke={HALO} strokeWidth={px(3)} paintOrder="stroke" strokeLinejoin="round">
          {shownLabels.map((i) => (
            <text key={items[i]!.id} x={anchors.xy[2 * i]} y={anchors.xy[2 * i + 1]} fill={LABEL} textAnchor="middle" dominantBaseline="central">
              {items[i]!.label}
            </text>
          ))}
        </g>
      )}
    </svg>
  );
}

/**
 * The first-vertex tick of a ring: a segment from vertex 0 towards the ring's centre, at most
 * `length` long and at most 45 % of the way there, so a small quad's tick stays inside it.
 */
function tickPath(points: ArrayLike<number>, length: number): string {
  const c = areaCentre(points);
  if (c === null || points.length < 4) return "";
  const x = points[0]!;
  const y = points[1]!;
  const dist = Math.hypot(c.x - x, c.y - y);
  if (!(dist > 0)) return "";
  const k = Math.min(length, 0.45 * dist) / dist;
  return `M${x} ${y}L${Math.round((x + (c.x - x) * k) * 1000) / 1000} ${Math.round((y + (c.y - y) * k) * 1000) / 1000}`;
}
