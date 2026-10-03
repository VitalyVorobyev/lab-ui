/**
 * Sequential colour maps for a magnitude (visual-language §4): a residual's size, a per-cell
 * error, a confidence, a validity fraction.
 *
 * Only perceptually uniform maps ship, so equal steps in the data look like equal steps.
 * - `viridis` is the default on the chrome.
 * - `cividis` is for when the map alone carries the finding and the reader's colour vision is
 *   unknown.
 *
 * A continuous quality is a magnitude even when low values are "good": stepping it onto verdict
 * colours (green / amber / red) claims a threshold judgement nobody made.
 *
 * The anchors are matplotlib's maps sampled at nine evenly spaced points. Linear interpolation
 * between them stays within a few units of the full 256-entry tables.
 */

/** The shipped maps. */
export type ColormapName = "viridis" | "cividis";

type Rgb = readonly [number, number, number];

const ANCHORS: Record<ColormapName, readonly Rgb[]> = {
  viridis: [
    [68, 1, 84],
    [71, 44, 122],
    [59, 81, 139],
    [44, 113, 142],
    [33, 144, 141],
    [39, 173, 129],
    [92, 200, 99],
    [170, 220, 50],
    [253, 231, 37],
  ],
  cividis: [
    [0, 34, 78],
    [18, 53, 112],
    [59, 73, 108],
    [87, 93, 109],
    [112, 113, 115],
    [138, 135, 121],
    [165, 157, 116],
    [196, 182, 101],
    [254, 232, 56],
  ],
};

/** The names of the shipped maps. */
export const COLORMAPS: readonly ColormapName[] = ["viridis", "cividis"];

/**
 * The colour of `t` on a map.
 *
 * @param name - The map.
 * @param t - Position in `[0, 1]`; clamped. A non-finite `t` gives the map's low end.
 * @returns A CSS `rgb(r g b)` colour.
 */
export function colormap(name: ColormapName, t: number): string {
  const [r, g, b] = colormapRgb(name, t);
  return `rgb(${r} ${g} ${b})`;
}

/**
 * The colour of `t` on a map, as integer channels.
 *
 * @param name - The map.
 * @param t - Position in `[0, 1]`; clamped.
 * @returns `[r, g, b]`, each 0–255.
 */
export function colormapRgb(name: ColormapName, t: number): [number, number, number] {
  const anchors = ANCHORS[name];
  const clamped = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0;
  const scaled = clamped * (anchors.length - 1);
  const i = Math.min(anchors.length - 2, Math.floor(scaled));
  const f = scaled - i;
  const a = anchors[i]!;
  const b = anchors[i + 1]!;
  return [
    Math.round(a[0] + f * (b[0] - a[0])),
    Math.round(a[1] + f * (b[1] - a[1])),
    Math.round(a[2] + f * (b[2] - a[2])),
  ];
}

/**
 * A value's colour on a map, over a domain.
 *
 * @param name - The map.
 * @param value - The value.
 * @param domain - `[low, high]`: low maps to the map's start. A reversed domain reverses the map.
 * @returns A CSS colour.
 */
export function colormapValue(name: ColormapName, value: number, domain: readonly [number, number]): string {
  const [low, high] = domain;
  const span = high - low;
  return colormap(name, span === 0 ? 0 : (value - low) / span);
}

/**
 * A CSS `linear-gradient` of a map, for a legend bar.
 *
 * @param name - The map.
 * @param direction - The gradient's direction. Defaults to `to right`.
 * @returns A CSS `background-image` value.
 */
export function colormapGradient(name: ColormapName, direction = "to right"): string {
  const anchors = ANCHORS[name];
  const stops = anchors.map(([r, g, b], i) => `rgb(${r} ${g} ${b}) ${((i / (anchors.length - 1)) * 100).toFixed(1)}%`);
  return `linear-gradient(${direction}, ${stops.join(", ")})`;
}
