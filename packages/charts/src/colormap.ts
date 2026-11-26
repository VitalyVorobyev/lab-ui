/**
 * Colour maps for a magnitude: a residual's size, a per-cell error, a confidence, a validity
 * fraction, or a signed quantity around zero.
 *
 * Only perceptually uniform maps ship, so equal steps in the data look like equal steps.
 *
 * Sequential, low to high:
 * - `viridis` is the default on the chrome.
 * - `cividis` is for when the map alone carries the finding and the reader's colour vision is
 *   unknown.
 * - `magma` and `inferno` run from black to a pale yellow through purple and red or orange. They
 *   read well over a dark image, where `viridis`' dark end disappears.
 *
 * Diverging, for a signed value whose zero matters (a displacement toward or away from a
 * centre, a difference between two runs):
 * - `blueOrange` runs from a deep blue through a neutral light grey at the middle to a deep
 *   orange-brown. Both arms fall in lightness at the same rate and carry the same amount of
 *   colour, so +x and -x look equally strong, and its hues avoid the red-green axis. Centre it on zero with `symmetricDomain`.
 *
 * A continuous quality is a magnitude even when low values are "good": stepping it onto verdict
 * colours (green / amber / red) claims a threshold judgement nobody made.
 *
 * The sequential anchors are the matplotlib maps sampled at nine evenly spaced points. Linear
 * interpolation between them stays within a few units of the full 256-entry tables. The
 * diverging map was constructed in OKLab (equal lightness and chroma steps along each arm,
 * mirrored in lightness, kept inside sRGB) and sampled at seventeen points.
 */

/** The shipped maps. */
export type ColormapName = "viridis" | "cividis" | "magma" | "inferno" | "blueOrange";

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
  magma: [
    [0, 0, 4],
    [29, 17, 71],
    [81, 18, 124],
    [131, 38, 129],
    [183, 55, 121],
    [231, 82, 99],
    [252, 137, 97],
    [254, 196, 136],
    [252, 253, 191],
  ],
  inferno: [
    [0, 0, 4],
    [33, 12, 74],
    [87, 16, 110],
    [138, 34, 106],
    [188, 55, 84],
    [228, 90, 49],
    [249, 142, 9],
    [249, 203, 53],
    [252, 255, 164],
  ],
  blueOrange: [
    [0, 70, 140],
    [33, 90, 158],
    [64, 112, 172],
    [92, 133, 185],
    [121, 155, 198],
    [150, 176, 211],
    [179, 198, 222],
    [209, 220, 233],
    [242, 242, 242],
    [230, 216, 207],
    [216, 190, 175],
    [201, 165, 144],
    [186, 140, 113],
    [170, 116, 83],
    [153, 91, 52],
    [136, 67, 13],
    [113, 52, 0],
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
export const COLORMAPS: readonly ColormapName[] = ["viridis", "cividis", "magma", "inferno", "blueOrange"];

/** The maps that run through a neutral middle, for a signed value: use them over a domain centred on zero. */
export const DIVERGING_COLORMAPS: readonly ColormapName[] = ["blueOrange"];

/**
 * Whether a map is diverging.
 *
 * @param name - The map.
 * @returns `true` for a map meant for a signed value around zero.
 */
export function isDivergingColormap(name: ColormapName): boolean {
  return DIVERGING_COLORMAPS.includes(name);
}

/**
 * A domain centred on zero that holds a given one: `[-m, m]` with `m` the largest absolute end.
 * Feed it a diverging map so the middle colour means zero.
 *
 * @param domain - `[low, high]`, or the values to cover.
 * @returns `[-m, m]`; `[-1, 1]` when no end is finite and non-zero.
 */
export function symmetricDomain(domain: readonly number[]): [number, number] {
  let m = 0;
  for (const v of domain) if (Number.isFinite(v) && Math.abs(v) > m) m = Math.abs(v);
  return m > 0 ? [-m, m] : [-1, 1];
}

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
  return [Math.round(a[0] + f * (b[0] - a[0])), Math.round(a[1] + f * (b[1] - a[1])), Math.round(a[2] + f * (b[2] - a[2]))];
}

/**
 * A value's colour on a map, over a domain.
 *
 * @param name - The map.
 * @param value - The value.
 * @param domain - `[low, high]`: low maps to the map's start. A reversed domain reverses the map.
 *   For a diverging map pass a domain centred on zero (`symmetricDomain`).
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
