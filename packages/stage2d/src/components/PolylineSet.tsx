/**
 * Many polylines over the image, selectable: contours a model may be built from, a
 * document's segments, a batch's matches.
 *
 * Drawn as a handful of batched paths, one per state and colour, not one element per line. The
 * L0-3 benchmark shows the per-element form failing the 2 ms hit-test gate at scale, while the
 * batched form plus a spatial index passes on every candidate engine
 * (`docs/measurements/stage2d-bench-analysis.md`). The pointer is resolved to a line by
 * `nearestPolyline`, not by the DOM, which keeps this layer engine-agnostic for L6-1.
 */

import { useMemo, useState, type PointerEvent as ReactPointerEvent } from "react";

import type { Point } from "./measureGeometry";
import {
  buildPolylineIndex,
  nearestPolyline,
  polylinePath,
  polylinesInRect,
  type Polyline,
  type PolylineId,
} from "./polylineIndex";
import { overlayRole } from "./overlayRole";
import { useStage } from "./stage/ImageStage";
import { useStageDrag } from "./stage/StageSurface";
import { useScreenPx } from "./stage/useScreenPx";
import { imageViewBox, type Rect } from "./stage/view";

/** One polyline of a `PolylineSet`, with optional styling. */
export interface PolylineSetItem extends Polyline {
  /** CSS colour for this line, instead of the set's `stroke`. */
  stroke?: string | undefined;
  /** Draw dashed: a line that is present but not in play (a dropped contour). */
  dashed?: boolean | undefined;
}

/** How a gesture combines with the current selection. */
export type PolylineSelectMode = "replace" | "toggle" | "add";

/** Props of `PolylineSet`. */
export interface PolylineSetProps {
  /** The polylines, in image coordinates. */
  items: readonly PolylineSetItem[];
  /** The selected ids. */
  selected?: Iterable<PolylineId> | undefined;
  /** Ids drawn at 35 % opacity, e.g. outside the current filter. They still take hover and clicks. */
  dimmed?: Iterable<PolylineId> | undefined;
  /** The hovered id, when the app controls hover (e.g. a list beside the stage hovers lines too). */
  hovered?: PolylineId | null | undefined;
  /** Called when the line under the pointer changes. */
  onHover?: ((id: PolylineId | null) => void) | undefined;
  /**
   * Called on a selection gesture.
   * - A click on a line → `[id]`, "replace".
   * - ⌘/Ctrl-click → `[id]`, "toggle".
   * - A rubber band → every line it touches, "replace", or "add" with ⌘/Ctrl held. An empty
   *   band clears.
   */
  onSelect?: ((ids: PolylineId[], mode: PolylineSelectMode) => void) | undefined;
  /**
   * The sweep tool is active: a drag anywhere on the image draws a rubber band. Without it a
   * band starts only with Shift held on a line, and a press on bare image is left to the stage
   * and to the layers below.
   */
  marquee?: boolean | undefined;
  /** CSS colour of the lines. Defaults to the overlay `feature` role: they are detected lines. */
  stroke?: string | undefined;
  /** CSS colour of a selected line. Defaults to the overlay `selection` role. */
  selectionStroke?: string | undefined;
  /** How close the pointer must be to pick a line, in screen pixels (the hit band's full width). Defaults to 14. */
  hitWidth?: number | undefined;
  /** The zoom from which a hovered or selected line's points are drawn. Defaults to 3. */
  vertexScale?: number | undefined;
  /** The layer's accessible name. Defaults to "Lines". */
  label?: string | undefined;
}

const HALO = overlayRole("halo");
/** The most points drawn as dots at once; past this the dots are noise and a cost. */
const MAX_VERTEX_DOTS = 5000;

/**
 * A selectable set of polylines inside an `ImageStage`.
 *
 * - **States**, from visual-language §5:
 *   - default 1.5 screen px;
 *   - hover 2 px;
 *   - selected 2.5 px in `selectionStroke`;
 *   - dimmed at 35 % opacity.
 * - **Halo.** Every line has a halo, so it holds on any image.
 * - **Points.** Above `vertexScale`, the points of the hovered and selected lines are drawn.
 * - **Panning.** The hand tool and a held space bar still pan.
 *
 * The SVG carries `data-hovered` (the hovered id) and `data-sweeping` while a band is drawn.
 */
export function PolylineSet({
  items,
  selected,
  dimmed,
  hovered,
  onHover,
  onSelect,
  marquee = false,
  stroke = overlayRole("feature"),
  selectionStroke = overlayRole("selection"),
  hitWidth = 14,
  vertexScale = 3,
  label = "Lines",
}: PolylineSetProps) {
  const stage = useStage();
  const startDrag = useStageDrag();
  const px = useScreenPx();

  const index = useMemo(() => buildPolylineIndex(items), [items]);
  const selectedSet = useMemo(() => new Set(selected ?? []), [selected]);
  const dimmedSet = useMemo(() => new Set(dimmed ?? []), [dimmed]);
  const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  const [ownHover, setOwnHover] = useState<PolylineId | null>(null);
  const hoverId = hovered !== undefined ? hovered : ownHover;
  const [band, setBand] = useState<Rect | null>(null);

  // One path per (state, colour, dash) group, rebuilt only when the set or the selection
  // changes. Hover is drawn on top, separately, so moving the pointer never rebuilds these.
  const groups = useMemo(() => {
    const map = new Map<string, { d: string[]; stroke: string; dashed: boolean; dim: boolean }>();
    const hitParts: string[] = [];
    for (const item of items) {
      const d = polylinePath(item.points, item.closed === true);
      if (d === "") continue;
      hitParts.push(d);
      if (selectedSet.has(item.id)) continue;
      const colour = item.stroke ?? stroke;
      const dashed = item.dashed === true;
      const dim = dimmedSet.has(item.id);
      const key = `${dim ? 1 : 0}|${dashed ? 1 : 0}|${colour}`;
      let group = map.get(key);
      if (!group) {
        group = { d: [], stroke: colour, dashed, dim };
        map.set(key, group);
      }
      group.d.push(d);
    }
    const selectedPath = items
      .filter((item) => selectedSet.has(item.id))
      .map((item) => polylinePath(item.points, item.closed === true))
      .join("");
    return {
      batches: [...map.values()].map((g) => ({ ...g, path: g.d.join("") })),
      hit: hitParts.join(""),
      selected: selectedPath,
    };
  }, [items, selectedSet, dimmedSet, stroke]);

  const hoverItem = hoverId !== null ? byId.get(hoverId) : undefined;
  const hoverPath = hoverItem ? polylinePath(hoverItem.points, hoverItem.closed === true) : "";

  const dots = useMemo(() => {
    if (stage.view.scale < vertexScale) return "";
    const shown: PolylineSetItem[] = [];
    if (hoverItem) shown.push(hoverItem);
    for (const item of items) if (selectedSet.has(item.id) && item !== hoverItem) shown.push(item);
    let d = "";
    let count = 0;
    for (const item of shown) {
      const p = item.points;
      for (let i = 0; i + 1 < p.length && count < MAX_VERTEX_DOTS; i += 2, count++) {
        d += `M${p[i]} ${p[i + 1]}h0`;
      }
    }
    return d;
  }, [stage.view.scale, vertexScale, hoverItem, items, selectedSet]);

  const pickAt = (event: { clientX: number; clientY: number }): PolylineId | null =>
    nearestPolyline(index, stage.toImage({ x: event.clientX, y: event.clientY }), px(hitWidth / 2))?.id ?? null;

  const setHover = (id: PolylineId | null) => {
    if (id === hoverId) return;
    setOwnHover(id);
    onHover?.(id);
  };

  const sweep = (event: ReactPointerEvent<SVGElement>) => {
    const from = stage.toImage({ x: event.clientX, y: event.clientY });
    const additive = event.metaKey || event.ctrlKey;
    setBand({ x: from.x, y: from.y, width: 0, height: 0 });
    setHover(null);
    startDrag(event, {
      onMove: (p) => setBand(boxBetween(from, p)),
      onEnd: (p) => {
        setBand(null);
        onSelect?.(polylinesInRect(index, boxBetween(from, p)), additive ? "add" : "replace");
      },
      onCancel: () => setBand(null),
    });
  };

  const onLinePointerDown = (event: ReactPointerEvent<SVGPathElement>) => {
    if (stage.panMode || event.button !== 0) return;
    // A band has to be able to start anywhere, and on a frame that is mostly lines "anywhere"
    // is usually on one. Declining here would hand the press to the stage (which pans), not to
    // a surface below, because only the topmost element is a press's target.
    if (event.shiftKey || marquee) {
      sweep(event);
      return;
    }
    const id = pickAt(event);
    if (id === null) return;
    // Claimed, and selected on the press: a selection that waits for the release feels like
    // lag on a canvas where every other gesture is immediate.
    event.stopPropagation();
    onSelect?.([id], event.metaKey || event.ctrlKey ? "toggle" : "replace");
  };

  const hairline = px(1.5);
  return (
    <svg
      viewBox={imageViewBox(stage.image)}
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      role="img"
      aria-label={`${label}: ${items.length} ${items.length === 1 ? "line" : "lines"}, ${selectedSet.size} selected`}
      data-hovered={hoverId ?? undefined}
      data-sweeping={band ? "" : undefined}
    >
      {marquee && (
        <rect
          data-marquee-surface=""
          x={-0.5}
          y={-0.5}
          width={stage.image.width}
          height={stage.image.height}
          fill="transparent"
          className="pointer-events-auto cursor-crosshair"
          onPointerDown={(event) => {
            if (stage.panMode || event.button !== 0) return;
            sweep(event);
          }}
        />
      )}
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d={groups.hit} stroke={HALO} strokeWidth={px(1.5 + 2)} opacity={0.6} />
        {groups.batches.map((batch) => (
          <path
            key={`${batch.dim}|${batch.dashed}|${batch.stroke}`}
            d={batch.path}
            stroke={batch.stroke}
            strokeWidth={hairline}
            strokeDasharray={batch.dashed ? `${px(4)} ${px(4)}` : undefined}
            opacity={batch.dim ? 0.35 : 1}
          />
        ))}
        {groups.selected && (
          <>
            <path d={groups.selected} stroke={HALO} strokeWidth={px(2.5 + 2)} />
            <path data-selected-lines="" d={groups.selected} stroke={selectionStroke} strokeWidth={px(2.5)} />
          </>
        )}
        {hoverPath && !band && (
          <>
            <path d={hoverPath} stroke={HALO} strokeWidth={px(2 + 2)} />
            <path
              data-hovered-line=""
              d={hoverPath}
              stroke={hoverItem && selectedSet.has(hoverItem.id) ? selectionStroke : (hoverItem?.stroke ?? stroke)}
              strokeWidth={px(hoverItem && selectedSet.has(hoverItem.id) ? 2.5 : 2)}
            />
          </>
        )}
        {dots && <path data-points="" d={dots} stroke={selectionStroke} strokeWidth={px(3)} />}
        {/* The one hit target: every line, transparent, wide. Which line it was is the
            index's answer, not the DOM's. */}
        <path
          data-hit=""
          d={groups.hit}
          stroke="transparent"
          strokeWidth={px(hitWidth)}
          style={{ pointerEvents: "stroke", cursor: stage.panMode ? undefined : marquee ? "crosshair" : "pointer" }}
          onPointerDown={onLinePointerDown}
          onPointerMove={(event) => {
            if (!band) setHover(pickAt(event));
          }}
          onPointerLeave={() => setHover(null)}
        />
      </g>
      {band && (
        <rect
          x={band.x}
          y={band.y}
          width={band.width}
          height={band.height}
          fill={selectionStroke}
          fillOpacity={0.12}
          stroke={selectionStroke}
          strokeWidth={px(1)}
        />
      )}
    </svg>
  );
}

function boxBetween(a: Point, b: Point): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
}
