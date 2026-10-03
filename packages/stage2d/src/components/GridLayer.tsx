/**
 * A detected lattice over the image: the corners of a calibration board with the row and
 * column edges between neighbours, and optional `(i, j)` labels.
 *
 * Nodes are a `PointSet` (batched markers, the point index, hover and selection), so a grid of
 * 20,000 corners is a dozen DOM nodes; the edges are two more batched paths (ADR-0004 rules 1
 * and 4). Edges are not picked: a person points at a corner.
 */

import { useMemo } from "react";

import { latticeEdges, type LatticeAxis } from "./gridEdges";
import { overlayRole, OVERLAY_STATE_OPACITY, OVERLAY_STATE_WIDTH, type OverlayRole } from "./overlayRole";
import { PointSet, type PointSetItem } from "./PointSet";
import type { MarkerShape } from "./markerShapes";
import type { PointId } from "./pointIndex";
import { useStage } from "./stage/ImageStage";
import type { StagePointerEvent } from "./stage/hitContext";
import { STAGE_HIT_PRIORITY } from "./stage/hitTest";
import { useScreenPx } from "./stage/useScreenPx";
import { imageViewBox } from "./stage/view";

/** One node of a `GridLayer`: a point with its lattice index. */
export interface GridNode extends PointSetItem {
  /** The lattice index along the first axis. */
  i: number;
  /** The lattice index along the second axis. */
  j: number;
}

/** How the edges along one lattice axis are drawn. */
export interface GridEdgeStyle {
  /** The overlay role of the edges. Defaults to `"structure"`: they are context. */
  role?: OverlayRole | undefined;
  /** Draw them dashed (4 3 screen px), so the two axes differ by more than colour. */
  dashed?: boolean | undefined;
  /** Draw them at all. Defaults to `true`. */
  visible?: boolean | undefined;
}

/** Props of `GridLayer`. */
export interface GridLayerProps {
  /** The nodes, in image coordinates, with their lattice indices. Gaps are allowed. */
  nodes: readonly GridNode[];
  /**
   * How edges are drawn, by axis: `i` joins `(i, j)` to `(i + 1, j)` (the rows, when `i`
   * counts columns), `j` joins `(i, j)` to `(i, j + 1)`. Both are solid `structure` by default.
   */
  edges?: { i?: GridEdgeStyle | undefined; j?: GridEdgeStyle | undefined } | undefined;
  /** The marker kind of a node that names none. Defaults to `"plus"`: a corner. */
  kind?: string | undefined;
  /** More marker kinds, or replacements for built-in ones, by name; see `PointSet`. */
  markers?: Readonly<Record<string, MarkerShape>> | undefined;
  /**
   * Label every node without a `label` of its own with its lattice index, `i,j`, where the
   * zoom leaves room (nodes at least 24 screen px apart). Off by default.
   */
  indexLabels?: boolean | undefined;
  /** Show the nodes' labels where the zoom leaves room for them. On by default. */
  labels?: boolean | undefined;
  /** The hovered node id, when the app controls hover. */
  hoveredId?: PointId | null | undefined;
  /** Called when the node under the pointer changes. `null` when it leaves every node. */
  onHoverChange?: ((id: PointId | null) => void) | undefined;
  /** The selected node ids, drawn at 2.5 px in the selection colour with a ring. */
  selectedIds?: Iterable<PointId> | undefined;
  /**
   * Node ids drawn at 35 % opacity, as a set or a predicate. An edge is dimmed when both its
   * nodes are. Pass a stable value: a new one re-batches the layer.
   */
  dimmed?: Iterable<PointId> | ((id: PointId) => boolean) | undefined;
  /** A press landed on a node; see `PointSet`. Setting it makes the layer claim presses on its nodes. */
  onItemPress?: ((id: PointId, event: StagePointerEvent) => void) | undefined;
  /** Draw the dark band under every mark. On by default; off for a fast, flat layer. */
  halo?: boolean | undefined;
  /** CSS colour of selected nodes and rings. Defaults to the overlay `selection` role. */
  selectionStroke?: string | undefined;
  /** The id hit-tests report for the nodes. Defaults to a generated one. */
  layerId?: string | undefined;
  /** Rank against other layers in hit-tests. Defaults to `STAGE_HIT_PRIORITY.point`. */
  priority?: number | undefined;
  /** The layer's accessible name. Defaults to "Grid". */
  label?: string | undefined;
}

const HALO = overlayRole("halo");

/** A style with its defaults filled in. */
function edgeStyle(style: GridEdgeStyle | undefined): { role: OverlayRole; dashed: boolean; visible: boolean } {
  return { role: style?.role ?? "structure", dashed: style?.dashed ?? false, visible: style?.visible ?? true };
}

/** One batched path of edges. */
interface EdgeBatch {
  key: string;
  axis: LatticeAxis;
  dim: boolean;
  d: string;
}

/**
 * A detected lattice inside an `ImageStage`.
 *
 * - **Nodes** are a `PointSet`: `plus` markers by default, picked through the point index at
 *   point priority, with `onHoverChange`, `onItemPress`, selection (with ring) and dimming.
 * - **Edges** join `(i, j)` to `(i + 1, j)` and to `(i, j + 1)` where both nodes exist
 *   (`latticeEdges`), in one path per axis and dimming, below the nodes. They are `structure`
 *   role by default, 1 screen px with a halo; `edges` restyles each axis.
 * - **Labels** are the nodes' own `label`s, or with `indexLabels` their `i,j`, only where nodes
 *   are at least 24 screen px apart.
 *
 * The edges' SVG carries `data-edges`; the nodes' is the `PointSet`'s.
 */
export function GridLayer({
  nodes,
  edges,
  kind = "plus",
  markers,
  indexLabels = false,
  labels = true,
  hoveredId,
  onHoverChange,
  selectedIds,
  dimmed,
  onItemPress,
  halo = true,
  selectionStroke,
  layerId,
  priority = STAGE_HIT_PRIORITY.point,
  label = "Grid",
}: GridLayerProps) {
  const stage = useStage();
  const px = useScreenPx();

  const styles = { i: edgeStyle(edges?.i), j: edgeStyle(edges?.j) };
  const isDimmed = useMemo(() => {
    if (typeof dimmed === "function") return dimmed;
    const set = new Set(dimmed ?? []);
    return (id: PointId) => set.has(id);
  }, [dimmed]);

  const batches = useMemo(() => {
    const map = new Map<string, EdgeBatch>();
    for (const edge of latticeEdges(nodes)) {
      const a = nodes[edge.a]!;
      const b = nodes[edge.b]!;
      if (!Number.isFinite(a.x + a.y + b.x + b.y)) continue;
      const dim = isDimmed(a.id) && isDimmed(b.id);
      const k = `${edge.axis}|${dim ? 1 : 0}`;
      let batch = map.get(k);
      if (!batch) {
        batch = { key: k, axis: edge.axis, dim, d: "" };
        map.set(k, batch);
      }
      batch.d += `M${a.x} ${a.y}L${b.x} ${b.y}`;
    }
    return [...map.values()];
  }, [nodes, isDimmed]);

  // Without `indexLabels` the nodes go through as they are, so the PointSet's index is not rebuilt.
  const items = useMemo<readonly PointSetItem[]>(
    () => (indexLabels ? nodes.map((node) => (node.label ? node : { ...node, label: `${node.i},${node.j}` })) : nodes),
    [nodes, indexLabels],
  );

  return (
    <>
      <svg
        viewBox={imageViewBox(stage.image)}
        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        data-edges=""
        aria-hidden
      >
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          {batches
            .filter((batch) => styles[batch.axis].visible)
            .map((batch) => {
              const style = styles[batch.axis];
              const thin = style.role === "model" || style.role === "structure";
              const width = px(OVERLAY_STATE_WIDTH.default - (thin ? 0.5 : 0));
              const dash = style.dashed ? `${px(4)} ${px(3)}` : undefined;
              return (
                <g key={batch.key} opacity={batch.dim ? OVERLAY_STATE_OPACITY.dimmed : undefined}>
                  {halo && <path d={batch.d} stroke={HALO} strokeWidth={width + px(2)} opacity={0.6} />}
                  <path data-edge-batch={batch.key} d={batch.d} stroke={overlayRole(style.role)} strokeWidth={width} strokeDasharray={dash} />
                </g>
              );
            })}
        </g>
      </svg>
      <PointSet
        items={items}
        kind={kind}
        markers={markers}
        hoveredId={hoveredId}
        onHoverChange={onHoverChange}
        selectedIds={selectedIds}
        dimmed={dimmed}
        onItemPress={onItemPress}
        labels={labels}
        halo={halo}
        selectionStroke={selectionStroke}
        layerId={layerId}
        priority={priority}
        label={label}
      />
    </>
  );
}
