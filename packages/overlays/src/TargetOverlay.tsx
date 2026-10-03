/**
 * A calibration-target detection over the image: one component for a chessboard, ChArUco,
 * marker board, PuzzleBoard, ring grid or a loose set of corners.
 *
 * It replaces the per-board overlays of vitavision (`ChessboardOverlay`, `CharucoOverlay`,
 * `MarkerboardOverlay`, `PuzzleboardOverlay`) and the glyph components behind them. Each part of
 * a `TargetDetection` goes to the stage2d layer that fits it, so a detection of thousands of
 * items is a few dozen DOM nodes (ADR-0004), and the pointer is resolved by the stage's hit-test
 * registry, not the DOM:
 *
 * | Part | Layer | Glyph (visual-language §5) |
 * |---|---|---|
 * | `corners` | `GridLayer` | plus; edge directions when `angle` is set; lattice edges and `i,j` labels |
 * | `markers` | `AreaSet` | quad outline and 12 % fill, corner 0 ticked, id inside |
 * | `circles` | `PointSet` | ring; a centre dot marks black |
 * | `rings` | `PointSet` + `EllipseSet` | fitted outer and inner ellipse, plus at the centre |
 * | `edgeBits` | `EllipseSet` | dot on the edge: solid for 1, dashed for 0, opacity from confidence |
 */

import {
  GridLayer,
  AreaSet,
  PointSet,
  type StagePointerEvent,
} from "@vitavision/stage2d";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

import { EllipseSet } from "./EllipseSet";
import { TARGET_MARKERS } from "./glyphs";
import { circlePoints, cornerNodes, edgeBitEllipses, markerAreas, ringCentres, ringEllipses } from "./layerItems";
import type { TargetDetection, TargetHit, TargetId, TargetPart } from "./model";

/** Props of `TargetOverlay`. */
export interface TargetOverlayProps {
  /** The detection to draw. Pass a stable object: a new one rebuilds every layer's index. */
  detection: TargetDetection;
  /** Draw the lattice edges between neighbouring corners, one dashed axis and one solid. On by default. */
  showEdges?: boolean | undefined;
  /** Show labels (lattice indices, marker ids, ring ids) where the zoom leaves room for them. On by default. */
  showLabels?: boolean | undefined;
  /**
   * The hovered id, when the app controls hover (a list beside the stage hovers items too). It
   * applies to every part that has the id; keep ids unique within a detection.
   */
  hoveredId?: TargetId | null | undefined;
  /** The selected ids, drawn at 2.5 px in the selection colour; points get a ring. */
  selectedIds?: Iterable<TargetId> | undefined;
  /**
   * Called when the item under the pointer changes, once per change; `null` when it leaves every
   * item. The `id` is the one given in the detection, so the app maps it back to its feature.
   */
  onHoverChange?: ((hit: TargetHit | null) => void) | undefined;
  /**
   * A press landed on an item. Setting it makes the layers claim presses on their items, so the
   * stage does not pan from them. A mounted `StageSurface` hears a press first; there, ask
   * `useStageHitTest` what is under it instead.
   */
  onItemPress?: ((hit: TargetHit, event: StagePointerEvent) => void) | undefined;
  /**
   * Dim the whole overlay (`true`), or the listed ids, or those a predicate accepts, to 35 %
   * opacity. They still take hover and presses. Pass a stable value: a new one re-batches.
   */
  dimmed?: boolean | Iterable<TargetId> | ((id: TargetId) => boolean) | undefined;
  /** Prefix of the hit-test layer ids (`<prefix>-corners`, `-markers`, `-circles`, `-rings`). Defaults to generated ids. */
  layerIdPrefix?: string | undefined;
}

/** The ids of each part, to route a hovered or selected id to the layers that have it. */
function idsByPart(detection: TargetDetection): Record<TargetPart, ReadonlySet<TargetId>> {
  const ids = (items: readonly { id: TargetId }[] | undefined) => new Set((items ?? []).map((item) => item.id));
  return {
    corner: ids(detection.corners),
    marker: ids(detection.markers),
    circle: ids(detection.circles),
    ring: ids(detection.rings),
  };
}

/** The `dimmed` prop as the predicate the layers take, or `undefined` for none. */
function dimPredicate(dimmed: TargetOverlayProps["dimmed"]): ((id: TargetId) => boolean) | undefined {
  if (dimmed === undefined || dimmed === false) return undefined;
  if (dimmed === true) return () => true;
  if (typeof dimmed === "function") return dimmed;
  const set = new Set(dimmed);
  return (id) => set.has(id);
}

/**
 * A detected calibration target inside an `ImageStage`.
 *
 * - **Batched**: one path per appearance in each layer, picking through spatial indices. Labels
 *   appear only where items are 24 screen px apart, at most 200 at a time.
 * - **States**: hover 2 px, selected 2.5 px in the selection colour with a ring, dimmed at 35 %.
 * - **Colour**: roles only (`feature`, `model`, `structure`, `selection`). Scores are never drawn
 *   as red, amber or green; polarity and bits are carried by shape (hollow or dotted, solid or
 *   dashed), not by hue.
 * - **Callbacks** report `{ id, part }` with the id from the detection. A press and a hover move
 *   between layers (a corner, then the marker under it) without a flicker: the change is reported
 *   once.
 *
 * The layers it renders carry their own accessible names ("Corners: 54 points, 0 selected").
 */
export function TargetOverlay({
  detection,
  showEdges = true,
  showLabels = true,
  hoveredId,
  selectedIds,
  onHoverChange,
  onItemPress,
  dimmed,
  layerIdPrefix,
}: TargetOverlayProps) {
  const nodes = useMemo(() => cornerNodes(detection), [detection]);
  const areas = useMemo(() => markerAreas(detection), [detection]);
  const circles = useMemo(() => circlePoints(detection), [detection]);
  const rings = detection.rings;
  const ringPoints = useMemo(() => ringCentres(rings ?? []), [rings]);
  const ringShapes = useMemo(() => ringEllipses(rings ?? []), [rings]);
  const bits = useMemo(() => edgeBitEllipses(detection.edgeBits ?? []), [detection.edgeBits]);
  const ids = useMemo(() => idsByPart(detection), [detection]);

  // Selection and hover are by id; each layer is given the ids it owns, so its count is right.
  const selectedSet = useMemo(() => new Set(selectedIds ?? []), [selectedIds]);
  const selected = useMemo(() => {
    const pick = (part: TargetPart) => new Set([...selectedSet].filter((id) => ids[part].has(id)));
    return { corner: pick("corner"), marker: pick("marker"), circle: pick("circle"), ring: pick("ring") };
  }, [selectedSet, ids]);
  const isDimmed = useMemo(() => dimPredicate(dimmed), [dimmed]);

  // Hover. The layers report separately, so moving from a corner to the marker under it is
  // `corner → null` then `marker → id` in one event. The net result is read when the event is
  // done, and reported once.
  const [ownHover, setOwnHover] = useState<TargetHit | null>(null);
  const hoverRef = useRef<TargetHit | null>(null);
  const reportedRef = useRef<TargetHit | null>(null);
  const scheduledRef = useRef(false);
  const onHoverChangeRef = useRef(onHoverChange);
  useLayoutEffect(() => {
    onHoverChangeRef.current = onHoverChange;
  });
  const hoverFrom = useCallback((part: TargetPart) => (id: TargetId | null) => {
    if (id !== null) hoverRef.current = { id, part };
    else if (hoverRef.current?.part === part) hoverRef.current = null;
    setOwnHover(hoverRef.current);
    if (scheduledRef.current) return;
    scheduledRef.current = true;
    queueMicrotask(() => {
      scheduledRef.current = false;
      const now = hoverRef.current;
      const before = reportedRef.current;
      if (now?.id === before?.id && now?.part === before?.part) return;
      reportedRef.current = now;
      onHoverChangeRef.current?.(now);
    });
  }, []);
  const hoverOf = (part: TargetPart): TargetId | null => {
    if (hoveredId !== undefined) return hoveredId !== null && ids[part].has(hoveredId) ? hoveredId : null;
    return ownHover?.part === part ? ownHover.id : null;
  };

  const pressFrom = (part: TargetPart) =>
    onItemPress ? (id: TargetId, event: StagePointerEvent) => onItemPress({ id, part }, event) : undefined;
  const layerId = (name: string) => (layerIdPrefix === undefined ? undefined : `${layerIdPrefix}-${name}`);

  const hasCorners = nodes.length > 0;
  const hasMarkers = areas.length > 0;
  const hasCircles = circles.length > 0;
  const hasRings = ringPoints.length > 0;
  const edgeStyle = { visible: showEdges };

  return (
    <>
      {hasMarkers && (
        <AreaSet
          items={areas}
          firstVertexTick
          labels={showLabels}
          hoveredId={hoverOf("marker")}
          selectedIds={selected.marker}
          dimmed={isDimmed}
          onHoverChange={hoverFrom("marker")}
          onItemPress={pressFrom("marker")}
          layerId={layerId("markers")}
          label="Markers"
        />
      )}
      {bits.length > 0 && <EllipseSet items={bits} minRadius={3} dimmed={isDimmed} />}
      {hasRings && (
        <>
          <EllipseSet items={ringShapes.outer} hoveredId={hoverOf("ring")} selectedIds={selected.ring} dimmed={isDimmed} />
          {ringShapes.inner.length > 0 && (
            <EllipseSet items={ringShapes.inner} role="model" hoveredId={hoverOf("ring")} selectedIds={selected.ring} dimmed={isDimmed} />
          )}
          <PointSet
            items={ringPoints}
            kind="plus"
            markers={TARGET_MARKERS}
            labels={showLabels}
            hoveredId={hoverOf("ring")}
            selectedIds={selected.ring}
            dimmed={isDimmed}
            onHoverChange={hoverFrom("ring")}
            onItemPress={pressFrom("ring")}
            layerId={layerId("rings")}
            label="Rings"
          />
        </>
      )}
      {hasCorners && (
        <GridLayer
          nodes={nodes}
          markers={TARGET_MARKERS}
          edges={{ i: edgeStyle, j: { ...edgeStyle, dashed: true } }}
          labels={showLabels}
          hoveredId={hoverOf("corner")}
          selectedIds={selected.corner}
          dimmed={isDimmed}
          onHoverChange={hoverFrom("corner")}
          onItemPress={pressFrom("corner")}
          layerId={layerId("corners")}
          label="Corners"
        />
      )}
      {hasCircles && (
        <PointSet
          items={circles}
          markers={TARGET_MARKERS}
          labels={showLabels}
          hoveredId={hoverOf("circle")}
          selectedIds={selected.circle}
          dimmed={isDimmed}
          onHoverChange={hoverFrom("circle")}
          onItemPress={pressFrom("circle")}
          layerId={layerId("circles")}
          label="Circles"
        />
      )}
    </>
  );
}
