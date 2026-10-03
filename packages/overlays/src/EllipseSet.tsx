/**
 * Many ellipses over the image whose size is data: fitted ring edges, edge-bit dots.
 *
 * A `MarkerShape` is sized in screen pixels, so it cannot draw a ring whose radius is a
 * measurement. This layer draws exact ellipses (two arcs each) in image pixels, batched by
 * appearance into a handful of `<path>`s (ADR-0004 rule 1). Strokes stay screen-sized (rule 4).
 * It is not picked: pair it with a `PointSet` at the centres, which is what `TargetOverlay` does.
 */

import {
  OVERLAY_STATE_OPACITY,
  OVERLAY_STATE_WIDTH,
  imageViewBox,
  overlayRole,
  useScreenPx,
  useStage,
  type OverlayRole,
} from "@vitavision/stage2d";
import { useMemo } from "react";

import { ellipsePath } from "./glyphs";
import type { TargetId } from "./model";

/** One ellipse of an `EllipseSet`. */
export interface EllipseSetItem {
  /** Its identity, for hover, selection and dimming. */
  id: TargetId;
  /** Centre x, image pixels. */
  x: number;
  /** Centre y, image pixels. */
  y: number;
  /** Semi-axis along the rotated x axis, image pixels. */
  rx: number;
  /** Semi-axis along the rotated y axis, image pixels. */
  ry: number;
  /** Rotation of the `rx` axis, radians clockwise on screen. Defaults to 0. */
  angle?: number | undefined;
  /** The overlay role it is painted in. Defaults to the layer's `role`. */
  role?: OverlayRole | undefined;
  /** Draw it dashed (4 3 screen px), so two kinds differ by more than colour. */
  dashed?: boolean | undefined;
  /** Opacity in [0, 1], rounded to a tenth so ellipses still share paths. Defaults to 1. */
  opacity?: number | undefined;
}

/** Props of `EllipseSet`. */
export interface EllipseSetProps {
  /** The ellipses, in image coordinates. */
  items: readonly EllipseSetItem[];
  /** The role of an item that names none. Defaults to `"feature"`. */
  role?: OverlayRole | undefined;
  /** The hovered id: its ellipses are drawn at 2 px. */
  hoveredId?: TargetId | null | undefined;
  /** The selected ids, drawn at 2.5 px in the selection colour. */
  selectedIds?: Iterable<TargetId> | undefined;
  /** Ids drawn at 35 % opacity, as a set or a predicate. Pass a stable value: a new one re-batches the layer. */
  dimmed?: Iterable<TargetId> | ((id: TargetId) => boolean) | undefined;
  /** Draw the dark band under every stroke. On by default. */
  halo?: boolean | undefined;
  /**
   * The smallest semi-axis, in screen pixels: a dot whose data size would vanish at the fitted
   * zoom is still drawn this large. Omit for none.
   */
  minRadius?: number | undefined;
  /** CSS colour of selected ellipses. Defaults to the overlay `selection` role. */
  selectionStroke?: string | undefined;
  /** Name the layer as an image for assistive technology. Without it the layer is decorative (`aria-hidden`). */
  label?: string | undefined;
}

const HALO = overlayRole("halo");

/** The outline of an item, its semi-axes raised to `floor` image pixels. */
function outlineOf(item: EllipseSetItem, floor: number): string {
  return ellipsePath(item.x, item.y, Math.max(item.rx, floor), Math.max(item.ry, floor), item.angle ?? 0);
}

/** The concatenated outlines of the items at `indices`. */
function batchPath(items: readonly EllipseSetItem[], indices: readonly number[], floor: number): string {
  let d = "";
  for (const i of indices) d += outlineOf(items[i]!, floor);
  return d;
}

/** The ellipses of one batched path. */
interface Batch {
  key: string;
  role: OverlayRole;
  dashed: boolean;
  opacity: number;
  dim: boolean;
  /** Item positions, ascending. */
  indices: number[];
}

/**
 * A batched set of ellipses inside an `ImageStage`.
 *
 * - **Geometry** is data: `rx`, `ry` and the centre are image pixels and scale with the image;
 *   the stroke is a screen constant.
 * - **States** follow visual-language §5: 1.5 screen px (1 for `model` and `structure`), hover
 *   2, selected 2.5 in the selection colour, dimmed at 35 % opacity. Every stroke has a halo.
 * - **Batching** is by (role, dash, opacity, dimming): a thousand rings are a dozen elements.
 *
 * The SVG carries `data-ellipses` (the count).
 */
export function EllipseSet({
  items,
  role = "feature",
  hoveredId = null,
  selectedIds,
  dimmed,
  halo = true,
  minRadius,
  selectionStroke = overlayRole("selection"),
  label,
}: EllipseSetProps) {
  const stage = useStage();
  const px = useScreenPx();
  const unit = px(1);

  const selectedSet = useMemo(() => new Set(selectedIds ?? []), [selectedIds]);
  const isDimmed = useMemo(() => {
    if (typeof dimmed === "function") return dimmed;
    const set = new Set(dimmed ?? []);
    return (id: TargetId) => set.has(id);
  }, [dimmed]);

  const batches = useMemo(() => {
    const normal = new Map<string, Batch>();
    const picked: Batch = { key: "selected", role: "selection", dashed: false, opacity: 1, dim: false, indices: [] };
    items.forEach((item, i) => {
      if (selectedSet.has(item.id)) {
        picked.indices.push(i);
        return;
      }
      const itemRole = item.role ?? role;
      const dashed = item.dashed ?? false;
      const opacity = Math.round(Math.min(1, Math.max(0, item.opacity ?? 1)) * 10) / 10;
      const dim = isDimmed(item.id);
      const key = `${dim ? 1 : 0}|${itemRole}|${dashed ? "dashed" : "solid"}|${opacity}`;
      let batch = normal.get(key);
      if (!batch) {
        batch = { key, role: itemRole, dashed, opacity, dim, indices: [] };
        normal.set(key, batch);
      }
      batch.indices.push(i);
    });
    return { normal: [...normal.values()], picked: picked.indices.length > 0 ? picked : null };
  }, [items, role, selectedSet, isDimmed]);

  // Outlines depend on the zoom only through the screen-pixel floor.
  const floor = minRadius !== undefined ? minRadius * unit : 0;
  const normalPaths = useMemo(
    () => batches.normal.map((batch) => ({ batch, d: batchPath(items, batch.indices, floor) })),
    [batches, items, floor],
  );
  const pickedPath = useMemo(() => (batches.picked ? batchPath(items, batches.picked.indices, floor) : ""), [batches, items, floor]);

  const hoverPositions: number[] = [];
  if (hoveredId !== null) {
    items.forEach((item, i) => {
      if (item.id === hoveredId) hoverPositions.push(i);
    });
  }
  const hoverSelected = hoveredId !== null && selectedSet.has(hoveredId);

  const widthOf = (itemRole: OverlayRole, state: "default" | "hover" | "selected"): number => {
    const thin = itemRole === "model" || itemRole === "structure";
    return px(OVERLAY_STATE_WIDTH[state] - (thin && state !== "selected" ? 0.5 : 0));
  };
  const dash = `${px(4)} ${px(3)}`;

  return (
    <svg
      viewBox={imageViewBox(stage.image)}
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      {...(label !== undefined ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
      data-ellipses={items.length}
    >
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {normalPaths.map(({ batch, d }) => (
          <g key={batch.key} opacity={batch.dim ? OVERLAY_STATE_OPACITY.dimmed : undefined}>
            {halo && (
              <path
                d={d}
                stroke={HALO}
                strokeWidth={widthOf(batch.role, "default") + px(2)}
                strokeDasharray={batch.dashed ? dash : undefined}
                opacity={0.6 * batch.opacity}
              />
            )}
            <path
              data-batch={batch.key}
              d={d}
              stroke={overlayRole(batch.role)}
              strokeWidth={widthOf(batch.role, "default")}
              strokeDasharray={batch.dashed ? dash : undefined}
              opacity={batch.opacity}
            />
          </g>
        ))}
        {batches.picked && (
          <>
            {halo && <path d={pickedPath} stroke={HALO} strokeWidth={widthOf("selection", "selected") + px(2)} />}
            <path data-selected-ellipses="" d={pickedPath} stroke={selectionStroke} strokeWidth={widthOf("selection", "selected")} />
          </>
        )}
        {hoverPositions.map((position) => {
          const item = items[position]!;
          const itemRole = item.role ?? role;
          const state = hoverSelected ? "selected" : "hover";
          return (
            <g key={position}>
              {halo && <path d={outlineOf(item, floor)} stroke={HALO} strokeWidth={widthOf(itemRole, state) + px(2)} />}
              <path
                data-hovered-ellipse=""
                d={outlineOf(item, floor)}
                stroke={hoverSelected ? selectionStroke : overlayRole(itemRole)}
                strokeWidth={widthOf(itemRole, state)}
              />
            </g>
          );
        })}
      </g>
    </svg>
  );
}
