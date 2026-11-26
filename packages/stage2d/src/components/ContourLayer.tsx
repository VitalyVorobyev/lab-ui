/**
 * Iso-lines of a scalar field over the image: the level sets of a distortion map, a residual field,
 * a support boundary.
 *
 * The lines are found by marching squares over the plane's nodes (see `contourPaths`), drawn as one
 * path per style (a halo, the solid levels, the dashed ones), never one element per line, and
 * stroked at screen-constant width. The layer takes no pointer events.
 */

import { useMemo } from "react";

import type { ValuePlane } from "../api/mapValues";
import { channelExtent, contourPaths, lineLength, pointsAlong, resolveLevels, type ContourLine } from "./contour";
import { MAX_LABELS, visibleRect } from "./labelLod";
import { overlayRole, OVERLAY_STATE_WIDTH, type OverlayRole } from "./overlayRole";
import { useStage } from "./stage/ImageStage";
import { useScreenPx } from "./stage/useScreenPx";
import { imageViewBox, PIXEL_CENTRE, type Rect } from "./stage/view";

/** A line is labelled only when it is at least this long on screen, in CSS pixels. */
const MIN_LABELLED_LENGTH = 90;
/** A long line is labelled again every this many screen pixels. */
const LABEL_EVERY = 280;
/** Dash and gap of a dashed level, in screen pixels. */
const DASH: readonly [number, number] = [5, 3];

/** Props of `ContourLayer`. */
export interface ContourLayerProps {
  /** The field, as decoded by `decodePlane`. `NaN` is "no data": a line never crosses it. */
  plane: ValuePlane;
  /** Which channel of the plane. Defaults to the first. */
  channel?: number | undefined;
  /**
   * The levels to draw: a list of values, or `{ step, origin? }` for every multiple of `step`
   * (from `origin`, default 0) inside the channel's finite range. A step that would give more than
   * 64 levels is widened by whole multiples. Pass a stable value: a new one recomputes the lines.
   */
  levels: readonly number[] | { step: number; origin?: number | undefined };
  /**
   * Levels drawn dashed: a significance threshold, zero. They are drawn even when `levels` does
   * not contain them, and a level in both is dashed. Compared with a relative tolerance of 1e-9.
   */
  dashedLevels?: readonly number[] | undefined;
  /**
   * Write each line's level on it: `true` for the level to three significant figures, or a
   * function. Labels are horizontal, sit along lines at least 90 screen pixels long (again every
   * 280), only inside the viewport, and at most 200 at a time.
   */
  labels?: boolean | ((level: number) => string) | undefined;
  /**
   * Where the plane is placed, in image coordinates, as for `HeatmapLayer`: the top-left edge of
   * its first pixel's footprint and the extent it is stretched over. Defaults to the whole image,
   * so a plane of any resolution lines up with a `HeatmapLayer` of the same plane.
   */
  rect?: Rect | undefined;
  /** The overlay role of the lines. Defaults to `"structure"`. */
  role?: OverlayRole | undefined;
  /** One CSS colour for the lines instead of the role's (`#hex` or `var(--x)`, used as given). */
  color?: string | undefined;
  /** Draw the dark band under lines and labels. On by default. */
  halo?: boolean | undefined;
  /** Draw it. Defaults to `true`; while `false` nothing is computed. */
  visible?: boolean | undefined;
  /** The layer's accessible name. Defaults to "Contours". */
  label?: string | undefined;
}

const defaultFormat = (level: number) => String(Number(level.toPrecision(3)));

const sameLevel = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

/**
 * Contour lines inside an `ImageStage`.
 *
 * - **Lines**: marching squares per level over the plane's nodes (pixel centres), linear along
 *   edges; a saddle is resolved by the mean of its four corners. They are computed once per
 *   change of `plane`, `channel` and `levels`, not on pan or zoom.
 * - **No data**: a cell touching a `NaN` node has no line, so a line stops at a hole.
 * - **Styles**: solid levels in one path, dashed ones in another, each over a halo.
 * - **Labels**: optional, by zoom (see `labels`).
 * - **Input**: none. The layer is decorative; the numbers are read from the plane (`valueAt`),
 *   and a legend or `labels` carry the levels as text.
 *
 * The SVG carries `data-count` (lines) and `data-levels` (the levels drawn).
 */
export function ContourLayer({
  plane,
  channel = 0,
  levels,
  dashedLevels,
  labels = false,
  rect,
  role = "structure",
  color,
  halo = true,
  visible = true,
  label = "Contours",
}: ContourLayerProps) {
  const stage = useStage();
  const px = useScreenPx();
  const unit = px(1);

  // Stable keys for inputs that are often written inline.
  const levelsKey = Array.isArray(levels)
    ? `l:${levels.join(",")}`
    : `s:${(levels as { step: number }).step}:${(levels as { origin?: number }).origin ?? 0}`;
  const dashedKey = (dashedLevels ?? []).join(",");

  const drawn = useMemo(() => {
    if (!visible) return { lines: [] as ContourLine[], levels: [] as number[], dashed: [] as number[] };
    const extent = Array.isArray(levels) ? null : channelExtent(plane, channel);
    const base = Array.isArray(levels) ? resolveLevels(levels, 0, 0) : extent ? resolveLevels(levels, extent[0], extent[1]) : [];
    const dashed = (dashedLevels ?? []).filter(Number.isFinite);
    const all = [...base];
    for (const level of dashed) if (!all.some((l) => sameLevel(l, level))) all.push(level);
    all.sort((a, b) => a - b);
    return { lines: contourPaths(plane, channel, all), levels: all, dashed };
    // The keys stand for `levels` and `dashedLevels`, which are often new arrays each render.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, plane, channel, levelsKey, dashedKey]);

  const box = rect ?? { x: -PIXEL_CENTRE, y: -PIXEL_CENTRE, width: stage.image.width, height: stage.image.height };
  const sx = plane.width > 0 ? box.width / plane.width : 1;
  const sy = plane.height > 0 ? box.height / plane.height : 1;

  const paths = useMemo(() => {
    let solid = "";
    let dashed = "";
    for (const line of drawn.lines) {
      let d = "";
      const p = line.points;
      for (let k = 0; k < p.length; k += 2) {
        d += `${k === 0 ? "M" : "L"}${(box.x + (p[k]! + 0.5) * sx).toFixed(2)} ${(box.y + (p[k + 1]! + 0.5) * sy).toFixed(2)}`;
      }
      if (line.closed) d += "Z";
      if (drawn.dashed.some((level) => sameLevel(level, line.level))) dashed += d;
      else solid += d;
    }
    return { solid, dashed };
  }, [drawn, box.x, box.y, sx, sy]);

  const format = typeof labels === "function" ? labels : defaultFormat;
  const view = visibleRect(stage.view, stage.box);
  const labelled = useMemo(() => {
    if (labels === false) return [];
    const out: { x: number; y: number; text: string }[] = [];
    for (const line of drawn.lines) {
      // Length on screen: nodes -> image (by the plane's pixel size) -> screen (by 1 / unit).
      const screen = (lineLength(line) * Math.hypot(sx, sy)) / Math.SQRT2 / unit;
      if (screen < MIN_LABELLED_LENGTH) continue;
      const count = Math.max(1, Math.floor(screen / LABEL_EVERY));
      for (const [x, y] of pointsAlong(line, count)) {
        const ix = box.x + (x + 0.5) * sx;
        const iy = box.y + (y + 0.5) * sy;
        if (view && (ix < view.x || ix > view.x + view.width || iy < view.y || iy > view.y + view.height)) continue;
        out.push({ x: ix, y: iy, text: format(line.level) });
        if (out.length >= MAX_LABELS) return out;
      }
    }
    return out;
    // `format` is the caller's function; a new one relabels.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [labels, drawn, box.x, box.y, sx, sy, unit, view?.x, view?.y, view?.width, view?.height]);

  if (!visible) return null;
  const tone = color ?? overlayRole(role);
  const HALO = overlayRole("halo");
  const width = px(OVERLAY_STATE_WIDTH.default);
  const dash = `${px(DASH[0])} ${px(DASH[1])}`;
  const levelsText = drawn.levels.slice(0, 6).map(defaultFormat).join(", ") + (drawn.levels.length > 6 ? ", …" : "");

  return (
    <svg
      viewBox={imageViewBox(stage.image)}
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      role="img"
      aria-label={`${label}: ${drawn.lines.length} ${drawn.lines.length === 1 ? "line" : "lines"}${levelsText ? ` at ${levelsText}` : ""}`}
      data-count={drawn.lines.length}
      data-levels={drawn.levels.join(",")}
    >
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {halo && paths.solid !== "" && <path data-halo="" d={paths.solid} stroke={HALO} strokeWidth={width + px(2)} opacity={0.6} />}
        {halo && paths.dashed !== "" && <path data-halo="" d={paths.dashed} stroke={HALO} strokeWidth={width + px(2)} opacity={0.6} />}
        {paths.solid !== "" && <path data-contours="solid" d={paths.solid} stroke={tone} strokeWidth={width} />}
        {paths.dashed !== "" && (
          <path data-contours="dashed" d={paths.dashed} stroke={tone} strokeWidth={width} strokeDasharray={dash} strokeLinecap="butt" />
        )}
      </g>
      {labelled.length > 0 && (
        <g
          data-labels=""
          fontSize={px(11)}
          className="font-mono"
          stroke={HALO}
          strokeWidth={px(3)}
          paintOrder="stroke"
          strokeLinejoin="round"
          fill={overlayRole("label")}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {labelled.map((entry, k) => (
            <text key={k} x={entry.x} y={entry.y}>
              {entry.text}
            </text>
          ))}
        </g>
      )}
    </svg>
  );
}
