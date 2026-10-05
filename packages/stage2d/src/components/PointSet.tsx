/**
 * Many points over the image, hoverable and selectable: detected corners, ring centres,
 * keypoints, labelled landmarks.
 *
 * Drawn as a handful of batched paths, one per (state, style, colour, marker kind), never one element
 * per point; the pointer is resolved by `nearestPoint` through the stage's hit registry, never by
 * the DOM; markers are sized in screen pixels. A scene of 20,000 points is under a dozen DOM nodes
 * plus at most 200 labels.
 */

import { useMemo, useState } from "react";

import { circlePath, MARKER_SHAPES, type MarkerShape } from "./markerShapes";
import { overlayRole, OVERLAY_STATE_OPACITY, OVERLAY_STATE_WIDTH, type OverlayRole } from "./overlayRole";
import { useLabelIndices, visibleRect } from "./labelLod";
import { buildPointIndexFrom, nearestPoint, type PointId, type PointItem } from "./pointIndex";
import { useStage } from "./stage/ImageStage";
import type { StagePointerEvent } from "./stage/hitContext";
import { STAGE_HIT_PRIORITY } from "./stage/hitTest";
import { useStageHitLayer } from "./stage/useStageHitTest";
import { useScreenPx } from "./stage/useScreenPx";
import { imageViewBox, type Rect } from "./stage/view";

/** One point of a `PointSet`. */
export interface PointSetItem extends PointItem {
  /**
   * The marker kind: a built-in (`dot`, `plus`, `cross`, `square`, `hollow`, `directed`) or
   * a key of the layer's `markers`. Defaults to the layer's `kind`.
   */
  kind?: string | undefined;
  /** The overlay role it is painted in. Defaults to the marker kind's role, usually `feature`. */
  role?: OverlayRole | undefined;
  /**
   * CSS colour of its mark (`#hex`, `var(--x)`, `color-mix(…)`; used as given). Overrides the
   * role; selection still paints in `selectionStroke`. Points sharing a colour share a batch.
   */
  color?: string | undefined;
  /** Its orientation in radians, clockwise from +x; read by `directed`. */
  angle?: number | undefined;
  /** A second angle in radians, for a glyph with two axes. `MarkerShape.path` gets `undefined` without it. */
  angle2?: number | undefined;
  /** Text drawn beside it, when the zoom leaves room (points at least 24 screen px apart). */
  label?: string | undefined;
}

/** Props of `PointSet`. */
export interface PointSetProps {
  /** The points, in image coordinates. */
  items: readonly PointSetItem[];
  /** The marker kind of an item that names none. Defaults to `"dot"`. */
  kind?: string | undefined;
  /** More marker kinds, or replacements for built-in ones, by name. */
  markers?: Readonly<Record<string, MarkerShape>> | undefined;
  /** The hovered id, when the app controls hover (a list beside the stage hovers points too). */
  hoveredId?: PointId | null | undefined;
  /** Called when the point under the pointer changes. `null` when it leaves every point. */
  onHoverChange?: ((id: PointId | null) => void) | undefined;
  /** The selected ids, drawn at 2.5 px in the selection colour with a ring. */
  selectedIds?: Iterable<PointId> | undefined;
  /**
   * Ids drawn at 35 % opacity, as a set or a predicate (outside the current filter, say).
   * They still take hover and presses. Pass a stable value: a new one re-batches the layer.
   */
  dimmed?: Iterable<PointId> | ((id: PointId) => boolean) | undefined;
  /**
   * A press landed on a point. Setting it makes the layer claim presses on its points, so
   * the stage does not pan from them. The event is the `pointerdown` (the `pointerup` for a
   * touch tap), so `useStageDrag` can start a drag from it.
   *
   * A mounted `StageSurface` hears a press first; there, ask `useStageHitTest` what is
   * under it instead.
   */
  onItemPress?: ((id: PointId, event: StagePointerEvent) => void) | undefined;
  /** Show the items' `label`s where the zoom leaves room for them. On by default. */
  labels?: boolean | undefined;
  /** Draw the dark band under every mark. On by default; off for a fast, flat layer. */
  halo?: boolean | undefined;
  /** CSS colour of selected points and rings. Defaults to the overlay `selection` role. */
  selectionStroke?: string | undefined;
  /** The id hit-tests report for this layer. Defaults to a generated one. */
  layerId?: string | undefined;
  /** Rank against other layers in hit-tests. Defaults to `STAGE_HIT_PRIORITY.point`. */
  priority?: number | undefined;
  /** The layer's accessible name. Defaults to "Points". */
  label?: string | undefined;
}

/** Past this many points, outlines are generated for the visible part only. */
const CULL_ABOVE = 3000;
/** How much bigger than a marker its selection ring is, in screen pixels. */
const RING_GAP = 4;

const HALO = overlayRole("halo");
const LABEL = overlayRole("label");

/** The points of one batched path. */
interface Batch {
  key: string;
  shape: MarkerShape;
  role: OverlayRole;
  /** The custom colour, when the items of this batch have one. */
  color: string | undefined;
  dim: boolean;
  /** Item positions, ascending. */
  indices: number[];
  /** The last generated path data and what it was generated for. */
  cache: { key: string; d: string } | null;
}

/**
 * A selectable set of points inside an `ImageStage`.
 *
 * - **Markers** by kind, from the overlay grammar: `dot`, `plus` (corner), `cross`, `square`,
 *   `hollow` (predicted), `directed`. Add your own through `markers`.
 * - **States**: default 1.5 screen px, hover 2, selected 2.5 in the
 *   selection colour with a ring, dimmed at 35 % opacity. Every mark has a halo.
 * - **Labels** only where points are at least 24 screen px apart, at most 200 at a time.
 * - **Picking** goes through the stage's hit registry: `onHoverChange` and `onItemPress` here,
 *   and `useStageHitTest` for an app that arbitrates between layers.
 *
 * Outlines (`plus`, `cross`, …) are regenerated when the zoom changes, since their size is in
 * screen pixels; past 3,000 points only those near the viewport are generated. `dot` is a
 * zero-length stroke whose width is its size, so it is not regenerated at all.
 *
 * The SVG carries `data-hovered` (the hovered id).
 */
export function PointSet({
  items,
  kind = "dot",
  markers,
  hoveredId,
  onHoverChange,
  selectedIds,
  dimmed,
  onItemPress,
  labels = true,
  halo = true,
  selectionStroke = overlayRole("selection"),
  layerId,
  priority = STAGE_HIT_PRIORITY.point,
  label = "Points",
}: PointSetProps) {
  const stage = useStage();
  const px = useScreenPx();
  const unit = px(1);

  const shapes = useMemo<Readonly<Record<string, MarkerShape>>>(() => ({ ...MARKER_SHAPES, ...markers }), [markers]);
  const index = useMemo(() => buildPointIndexFrom(items), [items]);
  const selectedSet = useMemo(() => new Set(selectedIds ?? []), [selectedIds]);
  const isDimmed = useMemo(() => {
    if (typeof dimmed === "function") return dimmed;
    const set = new Set(dimmed ?? []);
    return (id: PointId) => set.has(id);
  }, [dimmed]);
  const positionOf = useMemo(() => new Map(items.map((item, i) => [item.id, i])), [items]);

  const [ownHover, setOwnHover] = useState<PointId | null>(null);
  const hoverId = hoveredId !== undefined ? hoveredId : ownHover;

  useStageHitLayer({
    layerId,
    priority,
    pick: (point, radius) => {
      const hit = nearestPoint(index, point.x, point.y, radius);
      return hit ? { id: hit.id, dist: hit.dist } : null;
    },
    onHover: (id) => {
      setOwnHover(id);
      onHoverChange?.(id);
    },
    onPress: onItemPress ? (id, event) => onItemPress(id, event) : undefined,
  });

  // Items grouped by appearance. Rebuilt when the items or the selection change, never on
  // hover or on a view change.
  const groups = useMemo(() => {
    const normal = new Map<string, Batch>();
    const picked = new Map<string, Batch>();
    items.forEach((item, i) => {
      const kindName = item.kind ?? kind;
      const shape = shapes[kindName] ?? MARKER_SHAPES.dot;
      if (selectedSet.has(item.id)) {
        const key = kindName;
        let batch = picked.get(key);
        if (!batch) {
          batch = { key, shape, role: "selection", color: undefined, dim: false, indices: [], cache: null };
          picked.set(key, batch);
        }
        batch.indices.push(i);
        return;
      }
      const role = item.role ?? shape.role ?? "feature";
      const dim = isDimmed(item.id);
      const color = item.color || undefined;
      const key = `${dim ? 1 : 0}|${role}|${kindName}${color ? `|${color}` : ""}`;
      let batch = normal.get(key);
      if (!batch) {
        batch = { key, shape, role, color, dim, indices: [], cache: null };
        normal.set(key, batch);
      }
      batch.indices.push(i);
    });
    const rings = [...picked.values()].map<Batch>((batch) => ({
      ...batch,
      key: `ring|${batch.key}`,
      shape: {
        paint: "line",
        size: 0,
        path: (x, y, u) => circlePath(x, y, (batch.shape.size + RING_GAP) * u),
      },
      cache: null,
    }));
    return { normal: [...normal.values()], picked: [...picked.values()], rings };
  }, [items, kind, shapes, selectedSet, isDimmed]);

  // The part of the scene to generate outlines for: everything for a small set, otherwise a
  // window around the viewport, snapped so panning rebuilds it once per half screen.
  const cull = cullWindow(stage.view, stage.box, items.length);
  const cullKey = cull ? `${cull.x}|${cull.y}|${cull.width}|${cull.height}` : "";

  // Each batch remembers the outline it last generated and what that was for, so this is
  // O(batches) on a render that changed neither the zoom nor the window (a hover, a pan).
  const build = (batches: Batch[]) => batches.map((batch) => ({ batch, d: batchPath(batch, items, unit, cull, cullKey) }));
  const paths = { normal: build(groups.normal), picked: build(groups.picked), rings: build(groups.rings) };

  const hoverItem = hoverId !== null ? items[positionOf.get(hoverId) ?? -1] : undefined;
  const hoverSelected = hoverItem ? selectedSet.has(hoverItem.id) : false;
  const hoverShape = hoverItem ? (shapes[hoverItem.kind ?? kind] ?? MARKER_SHAPES.dot) : undefined;
  const hoverRole = hoverItem?.role ?? hoverShape?.role ?? "feature";

  // Labels: the spacing is a function of the zoom only, so panning does not reshuffle which
  // points carry one.
  const labelled = useMemo(() => {
    const list: number[] = [];
    items.forEach((item, i) => {
      if (item.label) list.push(i);
    });
    return list;
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
  const shownLabels = useLabelIndices({ enabled: labels, xy: index.xy, labelled, forced });

  const widthOf = (shape: MarkerShape, role: OverlayRole, state: "default" | "hover" | "selected"): number => {
    const thin = role === "model" || role === "structure";
    const base = OVERLAY_STATE_WIDTH[state] - (thin && state !== "selected" ? 0.5 : 0);
    // A disc's size is its stroke width: grow the diameter by twice the state's extra width.
    return px(shape.paint === "disc" ? 2 * shape.size + (OVERLAY_STATE_WIDTH[state] - 1.5) * 2 : base);
  };
  const ringWidth = px(1.5);

  return (
    <svg
      viewBox={imageViewBox(stage.image)}
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      role="img"
      aria-label={`${label}: ${items.length} ${items.length === 1 ? "point" : "points"}, ${selectedSet.size} selected`}
      data-hovered={hoverId ?? undefined}
    >
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {halo &&
          paths.normal.map(({ batch, d }) => (
            <path
              key={`halo|${batch.key}`}
              d={d}
              stroke={HALO}
              strokeWidth={widthOf(batch.shape, batch.role, "default") + px(2)}
              opacity={0.6 * (batch.dim ? OVERLAY_STATE_OPACITY.dimmed : 1)}
            />
          ))}
        {paths.normal.map(({ batch, d }) => (
          <path
            key={batch.key}
            data-batch={batch.key}
            d={d}
            stroke={batch.color ?? overlayRole(batch.role)}
            strokeWidth={widthOf(batch.shape, batch.role, "default")}
            opacity={batch.dim ? OVERLAY_STATE_OPACITY.dimmed : 1}
          />
        ))}
        {halo &&
          paths.picked.map(({ batch, d }) => (
            <path key={`halo|selected|${batch.key}`} d={d} stroke={HALO} strokeWidth={widthOf(batch.shape, batch.role, "selected") + px(2)} />
          ))}
        {halo &&
          paths.rings.map(({ batch, d }) => (
            <path key={`halo|${batch.key}`} d={d} stroke={HALO} strokeWidth={ringWidth + px(2)} />
          ))}
        {paths.picked.map(({ batch, d }) => (
          <path
            key={`selected|${batch.key}`}
            data-selected-points={batch.key}
            d={d}
            stroke={selectionStroke}
            strokeWidth={widthOf(batch.shape, batch.role, "selected")}
          />
        ))}
        {paths.rings.map(({ batch, d }) => (
          <path key={batch.key} data-selection-rings={batch.key} d={d} stroke={selectionStroke} strokeWidth={ringWidth} />
        ))}
        {hoverItem && hoverShape && (
          <>
            {halo && (
              <path
                d={hoverShape.path(hoverItem.x, hoverItem.y, unit, hoverItem.angle ?? 0, hoverItem.angle2)}
                stroke={HALO}
                strokeWidth={widthOf(hoverShape, hoverRole, hoverSelected ? "selected" : "hover") + px(2)}
              />
            )}
            <path
              data-hovered-point=""
              d={hoverShape.path(hoverItem.x, hoverItem.y, unit, hoverItem.angle ?? 0, hoverItem.angle2)}
              stroke={hoverSelected ? selectionStroke : (hoverItem?.color || overlayRole(hoverRole))}
              strokeWidth={widthOf(hoverShape, hoverRole, hoverSelected ? "selected" : "hover")}
            />
          </>
        )}
      </g>
      {shownLabels.length > 0 && (
        <g data-labels="" fontSize={px(11)} className="font-mono" stroke={HALO} strokeWidth={px(3)} paintOrder="stroke" strokeLinejoin="round">
          {shownLabels.map((i) => {
            const item = items[i]!;
            return (
              <text key={item.id} x={item.x + px(6)} y={item.y - px(5)} fill={LABEL} dominantBaseline="text-after-edge">
                {item.label}
              </text>
            );
          })}
        </g>
      )}
    </svg>
  );
}

/**
 * The path data of a batch, generated again only when what it depends on changed: nothing
 * for a disc marker, the zoom and the window for an outline.
 */
function batchPath(batch: Batch, items: readonly PointSetItem[], unit: number, cull: Rect | null, cullKey: string): string {
  const disc = batch.shape.paint === "disc";
  const key = disc ? "" : `${unit}|${cullKey}`;
  if (batch.cache?.key === key) return batch.cache.d;
  const window = disc ? null : cull;
  let d = "";
  for (const i of batch.indices) {
    const item = items[i]!;
    if (window && (item.x < window.x || item.x > window.x + window.width || item.y < window.y || item.y > window.y + window.height)) continue;
    d += batch.shape.path(item.x, item.y, unit, item.angle ?? 0, item.angle2);
  }
  batch.cache = { key, d };
  return d;
}

/**
 * The window outlines are generated for: the viewport plus half a viewport on every side,
 * snapped outward to half-viewport steps. `null` for a small set, or an unmeasured stage.
 */
function cullWindow(view: { scale: number; tx: number; ty: number }, box: { width: number; height: number }, count: number): Rect | null {
  if (count <= CULL_ABOVE) return null;
  const visible = visibleRect(view, box);
  if (visible === null) return null;
  const sx = visible.width / 2;
  const sy = visible.height / 2;
  const left = Math.floor((visible.x - sx) / sx) * sx;
  const top = Math.floor((visible.y - sy) / sy) * sy;
  const right = Math.ceil((visible.x + visible.width + sx) / sx) * sx;
  const bottom = Math.ceil((visible.y + visible.height + sy) / sy) * sy;
  return { x: left, y: top, width: right - left, height: bottom - top };
}
