/**
 * Many vectors over the image: a displacement, a flow, a gradient, a residual direction.
 *
 * Drawn as a handful of batched paths (one halo, then one per colour step), never one element per
 * vector; the pointer is resolved through the stage's hit registry from a spatial index over the
 * anchors, never by the DOM; arrowheads and strokes are sized in screen pixels. A field of 10,000
 * vectors is a dozen DOM nodes.
 */

import { useMemo, useState } from "react";

import type { Colormap, ValueRange } from "./heatmapRaster";
import { visibleRect } from "./labelLod";
import { overlayRole, OVERLAY_STATE_WIDTH, type OverlayRole } from "./overlayRole";
import { buildPointIndex, nearestPoint, type PointId } from "./pointIndex";
import { useStage } from "./stage/ImageStage";
import type { StagePointerEvent } from "./stage/hitContext";
import { STAGE_HIT_PRIORITY } from "./stage/hitTest";
import { useStageHitLayer } from "./stage/useStageHitTest";
import { useScreenPx } from "./stage/useScreenPx";
import { imageViewBox, type Rect } from "./stage/view";
import {
  arrowPath,
  colorBin,
  imagePerUnit,
  magnitudePercentile,
  vectorMagnitudes,
  VECTOR_COLOR_BINS,
  type ArrowStyle,
  type VectorScale,
} from "./vectorGeometry";

/** The arrow's shape, in screen pixels. */
const ARROW: ArrowStyle = { head: 6, headWidth: 0.7, minLength: 1 };
/** Past this many vectors, paths are generated for the visible part only. */
const CULL_ABOVE = 3000;
/** The reference vector of the default scale: the 95th percentile spans this many screen pixels. */
const DEFAULT_SCALE: VectorScale = { length: 28, percentile: 0.95 };

/** Props of `VectorField`. */
export interface VectorFieldProps {
  /** The anchors, flat `[x0, y0, x1, y1, …]` in image coordinates. A non-finite anchor is skipped. */
  anchors: ArrayLike<number>;
  /**
   * The vectors, flat `[dx0, dy0, dx1, dy1, …]` in data units, one per anchor. A non-finite
   * component, or a missing entry, skips the vector.
   */
  vectors: ArrayLike<number>;
  /**
   * How data units become image pixels: a number is image pixels per data unit and zooms with
   * the image; `{ length, percentile }` makes the `percentile` vector (default `1`, the longest)
   * span `length` screen pixels at every zoom. Defaults to the 95th-percentile vector at 28 screen
   * pixels, so a few outliers do not shrink the rest to nothing.
   */
  scale?: VectorScale | undefined;
  /**
   * One CSS colour for every arrow (`#hex`, `var(--x)`; used as given). Ignored with `colormap`.
   * Defaults to the `role`'s colour.
   */
  color?: string | undefined;
  /** The overlay role the arrows are painted in without a `color`. Defaults to `"feature"`. */
  role?: OverlayRole | undefined;
  /**
   * Colour each arrow by its magnitude through this map: a position in `[0, 1]` to `[r, g, b]`
   * (the maps of `@vitavision/charts` fit, as for `HeatmapLayer`). Pass a stable function.
   * Magnitudes are quantised into 24 steps, one path each.
   */
  colormap?: Colormap | undefined;
  /** The magnitudes mapped onto `colormap`. Defaults to `0` to the longest vector. */
  range?: ValueRange | undefined;
  /** Ids by vector index. Defaults to the index. */
  ids?: ArrayLike<PointId> | undefined;
  /** The hovered id, when the app controls hover. */
  hoveredId?: PointId | null | undefined;
  /**
   * Called when the vector under the pointer changes; `null` when it leaves every vector. A
   * vector is picked at its anchor. Not called while `pickable` is off.
   */
  onHoverChange?: ((id: PointId | null) => void) | undefined;
  /**
   * A press landed on a vector's anchor. Setting it makes the layer claim presses there, so the
   * stage does not pan from them.
   */
  onItemPress?: ((id: PointId, event: StagePointerEvent) => void) | undefined;
  /** Draw the dark band under every arrow. On by default; off for a fast, flat layer. */
  halo?: boolean | undefined;
  /** Whether the layer takes part in the stage's hit-test. On by default. */
  pickable?: boolean | undefined;
  /** The id hit-tests report for this layer. Defaults to a generated one. */
  layerId?: string | undefined;
  /** Rank against other layers in hit-tests. Defaults to `STAGE_HIT_PRIORITY.point`. */
  priority?: number | undefined;
  /** The layer's accessible name. Defaults to "Vectors". */
  label?: string | undefined;
}

/**
 * The reference vector of a scale and the scale it gives, shared by the layer and its key.
 *
 * @param vectors - Flat `[dx0, dy0, …]`.
 * @param scale - See `VectorScale`.
 * @returns The reference magnitude in data units, and image pixels per data unit.
 */
export function useVectorScale(vectors: ArrayLike<number>, scale: VectorScale = DEFAULT_SCALE): { reference: number; perUnit: number } {
  const unit = useScreenPx()(1);
  const mags = useMemo(() => vectorMagnitudes(vectors), [vectors]);
  const percentile = typeof scale === "number" ? 1 : (scale.percentile ?? 1);
  const reference = useMemo(() => magnitudePercentile(mags, percentile), [mags, percentile]);
  return { reference, perUnit: imagePerUnit(scale, reference, unit) };
}

/** `rgb(r g b)` of a map's colour, channels rounded and clamped. */
function css(colormap: Colormap, t: number): string {
  const [r, g, b] = colormap(t);
  const c = (v: number) => Math.min(255, Math.max(0, Math.round(v)));
  return `rgb(${c(r)} ${c(g)} ${c(b)})`;
}

/**
 * A field of arrows inside an `ImageStage`.
 *
 * - **Scale**: see `VectorScale`. The same `vectors` and `scale` given to `VectorFieldKey` draw a
 *   reference length at exactly this scale.
 * - **Colour**: one tone (`color` or `role`), or by magnitude through `colormap` over `range`.
 * - **Absent data**: an anchor or vector with a non-finite number, or shorter than one screen
 *   pixel, is not drawn.
 * - **Picking** goes through the stage's hit registry: `onHoverChange` and `onItemPress` here, and
 *   `useStageHitTest` for an app that arbitrates between layers. The hovered arrow is redrawn
 *   at 2.5 screen px in the selection colour.
 *
 * Arrowheads and strokes are screen-constant; their paths are regenerated when the zoom changes,
 * and past 3,000 vectors only those near the viewport are generated. The SVG carries
 * `data-hovered` (the hovered id) and `data-count` (the vectors drawn).
 */
export function VectorField({
  anchors,
  vectors,
  scale = DEFAULT_SCALE,
  color,
  role = "feature",
  colormap,
  range,
  ids,
  hoveredId,
  onHoverChange,
  onItemPress,
  halo = true,
  pickable = true,
  layerId,
  priority = STAGE_HIT_PRIORITY.point,
  label = "Vectors",
}: VectorFieldProps) {
  const stage = useStage();
  const px = useScreenPx();
  const unit = px(1);
  const count = Math.min(Math.floor(anchors.length / 2), Math.floor(vectors.length / 2));

  const mags = useMemo(() => vectorMagnitudes(vectors), [vectors]);
  const { perUnit } = useVectorScale(vectors, scale);
  const index = useMemo(() => buildPointIndex(anchors, { ids }), [anchors, ids]);

  const [ownHover, setOwnHover] = useState<PointId | null>(null);
  const hoverId = hoveredId !== undefined ? hoveredId : ownHover;

  useStageHitLayer({
    layerId,
    priority,
    enabled: pickable,
    pick: (point, radius) => {
      const hit = nearestPoint(index, point.x, point.y, radius);
      return hit && hit.index < count && Number.isFinite(mags[hit.index]) ? { id: hit.id, dist: hit.dist } : null;
    },
    onHover: (id) => {
      setOwnHover(id);
      onHoverChange?.(id);
    },
    onPress: onItemPress,
  });

  const colourRange = useMemo(() => {
    if (!colormap) return null;
    if (range) return range;
    let high = 0;
    for (let i = 0; i < count; i++) if (mags[i]! > high) high = mags[i]!;
    return { low: 0, high };
  }, [colormap, range, mags, count]);

  const cull = cullWindow(stage.view, stage.box, count, mags, perUnit);
  const cullKey = cull ? `${cull.x}|${cull.y}|${cull.width}|${cull.height}` : "";

  const built = useMemo(() => {
    const bins = colormap && colourRange ? VECTOR_COLOR_BINS : 1;
    const parts: string[] = new Array<string>(bins).fill("");
    let drawn = 0;
    for (let i = 0; i < count; i++) {
      const m = mags[i]!;
      const x = anchors[2 * i]!;
      const y = anchors[2 * i + 1]!;
      if (!Number.isFinite(m) || !Number.isFinite(x) || !Number.isFinite(y)) continue;
      if (cull && (x < cull.x || x > cull.x + cull.width || y < cull.y || y > cull.y + cull.height)) continue;
      const d = arrowPath(x, y, vectors[2 * i]! * perUnit, vectors[2 * i + 1]! * perUnit, unit, ARROW);
      if (d === "") continue;
      const bin = colormap && colourRange ? colorBin(m, colourRange.low, colourRange.high) : 0;
      parts[bin] += d;
      drawn++;
    }
    const batches = parts.flatMap((d, bin) => (d === "" ? [] : [{ bin, d }]));
    return { parts, batches, drawn };
    // `cullKey` stands for `cull`, which is a new object each render.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [anchors, vectors, mags, count, perUnit, unit, colormap, colourRange, cullKey]);

  const all = useMemo(() => built.parts.join(""), [built]);
  const hoverIndex = hoverId === null ? -1 : findIndex(index, hoverId, count);
  const hoverPath =
    hoverIndex >= 0 && Number.isFinite(mags[hoverIndex])
      ? arrowPath(
          anchors[2 * hoverIndex]!,
          anchors[2 * hoverIndex + 1]!,
          vectors[2 * hoverIndex]! * perUnit,
          vectors[2 * hoverIndex + 1]! * perUnit,
          unit,
          ARROW,
        )
      : "";

  const tone = color ?? overlayRole(role);
  const width = px(OVERLAY_STATE_WIDTH.default);
  const hoverWidth = px(OVERLAY_STATE_WIDTH.selected);
  const HALO = overlayRole("halo");

  return (
    <svg
      viewBox={imageViewBox(stage.image)}
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      role="img"
      aria-label={`${label}: ${built.drawn} ${built.drawn === 1 ? "vector" : "vectors"}`}
      data-hovered={hoverId ?? undefined}
      data-count={built.drawn}
    >
      <g fill="none" strokeLinecap="butt" strokeLinejoin="round">
        {halo && all !== "" && <path data-halo="" d={all} stroke={HALO} fill={HALO} strokeWidth={width + px(2)} opacity={0.6} />}
        {built.batches.map(({ bin, d }) => (
          <path
            key={bin}
            data-batch={bin}
            d={d}
            stroke={colormap ? css(colormap, (bin + 0.5) / VECTOR_COLOR_BINS) : tone}
            fill={colormap ? css(colormap, (bin + 0.5) / VECTOR_COLOR_BINS) : tone}
            strokeWidth={width}
          />
        ))}
        {hoverPath !== "" && (
          <>
            {halo && <path d={hoverPath} stroke={HALO} fill={HALO} strokeWidth={hoverWidth + px(2)} />}
            <path
              data-hovered-vector=""
              d={hoverPath}
              stroke={overlayRole("selection")}
              fill={overlayRole("selection")}
              strokeWidth={hoverWidth}
            />
          </>
        )}
      </g>
    </svg>
  );
}

/** The index of the vector with id `id`, or `-1`. */
function findIndex(index: { ids: ArrayLike<PointId> | null }, id: PointId, count: number): number {
  if (index.ids === null) return typeof id === "number" && id >= 0 && id < count && Number.isInteger(id) ? id : -1;
  for (let i = 0; i < Math.min(count, index.ids.length); i++) if (index.ids[i] === id) return i;
  return -1;
}

/**
 * The window paths are generated for: the viewport plus the longest arrow on every side, snapped
 * outward to half-viewport steps so panning rebuilds it once per half screen. `null` for a small
 * field, or an unmeasured stage.
 */
function cullWindow(
  view: { scale: number; tx: number; ty: number },
  box: { width: number; height: number },
  count: number,
  mags: ArrayLike<number>,
  perUnit: number,
): Rect | null {
  if (count <= CULL_ABOVE) return null;
  const visible = visibleRect(view, box);
  if (visible === null) return null;
  let longest = 0;
  for (let i = 0; i < count; i++) if (mags[i]! > longest) longest = mags[i]!;
  const sx = visible.width / 2;
  const sy = visible.height / 2;
  const reach = Math.min(longest * perUnit, visible.width, visible.height);
  const left = Math.floor((visible.x - sx - reach) / sx) * sx;
  const top = Math.floor((visible.y - sy - reach) / sy) * sy;
  const right = Math.ceil((visible.x + visible.width + sx + reach) / sx) * sx;
  const bottom = Math.ceil((visible.y + visible.height + sy + reach) / sy) * sy;
  return { x: left, y: top, width: right - left, height: bottom - top };
}
