/**
 * The arithmetic of `CompareLayer`: how image B is masked, clipped or blended over image A
 * for each mode, and how the wipe's split moves. Pure CSS values, no canvas, so a comparison
 * of two large frames costs the browser's compositor and nothing else.
 */

import type { CSSProperties } from "react";

/** How two images are compared. */
export type CompareMode = "checker" | "wipe" | "difference";

/** Which way the wipe's divider runs: `vertical` splits left from right, `horizontal` top from bottom. */
export type CompareOrientation = "vertical" | "horizontal";

/** The styles of one comparison: the wrapper of both images, and image B. */
export interface CompareStyles {
  /** On the element holding both images. */
  wrapper: CSSProperties;
  /** On image B, drawn over image A. */
  b: CSSProperties;
}

/**
 * A split as a fraction in `[0, 1]`.
 *
 * @param split - Any number.
 * @returns It clamped to `[0, 1]`; `0.5` for a non-finite value.
 */
export function clampSplit(split: number): number {
  if (!Number.isFinite(split)) return 0.5;
  return Math.min(1, Math.max(0, split));
}

/**
 * The styles that compare B with A.
 *
 * - `checker`: B is masked by a checkerboard of `cell`-pixel squares (a repeating conic
 *   gradient), so A shows through every other square, starting with A at the top-left.
 * - `wipe`: B is clipped to the far side of the divider, so A shows before `split` (left of it,
 *   or above it) and B after.
 * - `difference`: B is blended over A with `mix-blend-mode: difference`, isolated so nothing
 *   behind the layer joins the blend, then brightened by `gain`. The difference is per
 *   channel, of the sRGB-encoded values the browser composites, not of linear light.
 *
 * @param mode - The comparison.
 * @param options - `split` (0..1), `orientation`, `cell` (image pixels) and `gain`.
 * @returns The wrapper's and B's styles.
 */
export function compareStyles(
  mode: CompareMode,
  options: { split: number; orientation: CompareOrientation; cell: number; gain: number },
): CompareStyles {
  if (mode === "checker") {
    const size = 2 * Math.max(1, options.cell);
    const mask = "conic-gradient(black 0 25%, transparent 0 50%, black 0 75%, transparent 0)";
    return {
      wrapper: {},
      b: {
        maskImage: mask,
        WebkitMaskImage: mask,
        maskSize: `${size}px ${size}px`,
        WebkitMaskSize: `${size}px ${size}px`,
        maskRepeat: "repeat",
        WebkitMaskRepeat: "repeat",
        maskPosition: "0 0",
        WebkitMaskPosition: "0 0",
      },
    };
  }
  if (mode === "wipe") return { wrapper: {}, b: { clipPath: wipeClip(options.split, options.orientation) } };
  return {
    wrapper: { isolation: "isolate", filter: options.gain === 1 ? undefined : `brightness(${Math.max(0, options.gain)})` },
    b: { mixBlendMode: "difference" },
  };
}

/**
 * The clip that leaves B on the far side of the divider.
 *
 * @param split - Where the divider is, as a fraction of the width (vertical) or height (horizontal).
 * @param orientation - Which way the divider runs.
 * @returns A CSS `clip-path`.
 */
export function wipeClip(split: number, orientation: CompareOrientation): string {
  const at = `${round(clampSplit(split) * 100)}%`;
  return orientation === "vertical" ? `inset(0 0 0 ${at})` : `inset(${at} 0 0 0)`;
}

/**
 * What a key does to the split: the arrows move it 1 % (10 % with Shift), Page Up / Page Down
 * 10 %, Home and End to either edge. Right always moves it right and Left left; on a vertical
 * divider Up raises the value (the slider convention), on a horizontal one Up and Down move it
 * up and down.
 *
 * @param split - The split now.
 * @param key - `KeyboardEvent.key`.
 * @param shift - Whether Shift is held.
 * @param orientation - Which way the divider runs.
 * @returns The new split, clamped; `null` for a key that does nothing.
 */
export function splitForKey(split: number, key: string, shift: boolean, orientation: CompareOrientation): number | null {
  const step = shift ? 0.1 : 0.01;
  const vertical = orientation === "vertical";
  switch (key) {
    case "ArrowRight":
      return clampSplit(split + step);
    case "ArrowLeft":
      return clampSplit(split - step);
    case "ArrowUp":
      return clampSplit(split + (vertical ? step : -step));
    case "ArrowDown":
      return clampSplit(split + (vertical ? -step : step));
    case "PageUp":
      return clampSplit(split + 0.1);
    case "PageDown":
      return clampSplit(split - 0.1);
    case "Home":
      return 0;
    case "End":
      return 1;
    default:
      return null;
  }
}

/**
 * The divider's value as text, for a screen reader: how much of A shows, e.g. `"40 % A"`.
 *
 * @param split - The split.
 * @param labelA - Image A's name.
 * @returns The text.
 */
export function splitText(split: number, labelA: string): string {
  return `${Math.round(clampSplit(split) * 100)} % ${labelA}`;
}

/**
 * Where along the divider its knob sits: the middle of the part of the divider on screen, so the
 * knob stays in view however the image is zoomed and panned.
 *
 * @param visible - The visible span along the divider, in image pixels (`[start, end]`), or `null` before the viewport is measured.
 * @param length - The image's extent along the divider.
 * @returns The knob's position along the divider, in image pixels.
 */
export function knobPosition(visible: readonly [number, number] | null, length: number): number {
  if (visible === null) return length / 2;
  const start = Math.max(0, visible[0]);
  const end = Math.min(length, visible[1]);
  if (!(end >= start)) return Math.min(length, Math.max(0, (visible[0] + visible[1]) / 2));
  return (start + end) / 2;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
