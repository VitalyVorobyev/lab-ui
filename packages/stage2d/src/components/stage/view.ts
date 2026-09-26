/**
 * The image ↔ screen transform, as pure arithmetic.
 *
 * One transform, in absolute units: the stage element is laid out at exactly the source
 * image's pixel size and carries `translate(tx, ty) scale(scale)` about its top-left corner,
 * so an image point `p` lands at `p · scale + t` and nothing else participates. `scale` is
 * therefore *CSS pixels per image pixel* — `scale === 1` is 100%, and fit is whatever
 * `fitScale` returns for the current viewport, a value rather than a magic constant.
 *
 * The predecessor (`ZoomPanCanvas`) instead composed two scales it never named: a layout
 * scale from the frame's own size, and a CSS transform about the frame's centre. That
 * worked only while the frame's aspect ratio matched the image's, and the one consumer that
 * forgot to enforce that drew its overlays stretched against a letterboxed photograph — the
 * layers drifting apart on window resize, which is precisely the failure this replaces.
 * Laying the stage out at the image's own size removes the first scale entirely, so a child
 * `<svg viewBox="0 0 W H">` is registered with the photograph by construction.
 *
 * Every function here is pure and tested, because this is arithmetic that goes wrong in a
 * way nothing on screen reveals: an overlay that is confidently off by a pan offset looks
 * exactly like an overlay that works.
 *
 * Points are in **viewport-local** CSS pixels — client coordinates with the viewport's
 * `getBoundingClientRect()` origin already subtracted. Keeping the rect out of these
 * signatures is what makes them testable without a DOM.
 *
 * **Image coordinates name pixel centres**, which is the convention every image-processing
 * result uses: `i` means the centre of pixel `i`, so an edge detected exactly between two
 * columns comes back as `i + 0.5`. CSS is the other convention: an `<img>` laid out at its
 * natural size puts pixel `i` across `[i, i + 1)`, so *its* `i` is the pixel's left edge.
 * The half-pixel between them is what `PIXEL_CENTRE` carries, and it is not cosmetic on a
 * metrology bench — at 8x it is four screen pixels of disagreement between an overlay and
 * the edge it claims to mark, and it is invisible at fit, which is where it gets missed.
 *
 * A layer drawn in image coordinates therefore uses `imageViewBox`, not `0 0 W H`.
 */

import type { Point } from "../measureGeometry";

/** A `translate(tx, ty) scale(scale)` about the stage's top-left corner. */
export interface StageView {
  /** CSS pixels per image pixel. `1` is 100%. */
  scale: number;
  tx: number;
  ty: number;
}

export interface Box {
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The offset between the two conventions above: an image coordinate `i` sits at CSS `i +
 * 0.5` inside a stage laid out at the image's natural size.
 */
export const PIXEL_CENTRE = 0.5;

/**
 * The `viewBox` for an SVG layer drawn in image coordinates, over a stage of that image.
 *
 * Shifted by half a pixel so a primitive at image coordinate `i` lands on the *centre* of
 * pixel `i` rather than on its left edge. Its extent is unchanged — the box still covers
 * exactly the image — so nothing about sizing or `preserveAspectRatio` changes with it.
 */
export function imageViewBox(image: Box): string {
  return `${-PIXEL_CENTRE} ${-PIXEL_CENTRE} ${image.width} ${image.height}`;
}

/** The most a viewer may magnify: past this the resampler is the subject, not the sensor. */
export const MAX_SCALE = 32;

/**
 * How far below fit zooming out may go.
 *
 * `ZoomPanCanvas` bottomed out *at* fit, on the reasoning that there is nothing further to
 * see. There is: room around the part, which is what you want when dragging an ROI out to
 * the frame edge or checking that a model's points do not run off the image.
 */
export const MIN_SCALE_VS_FIT = 0.25;

/** Zoom in/out steps, as the percentages a readout can show without apologising. */
const SCALE_LADDER = [
  0.05, 0.0833, 0.125, 0.1667, 0.25, 0.3333, 0.5, 0.6667, 1, 1.5, 2, 3, 4, 6, 8, 12, 16, 24, 32,
];

/** Relative tolerance for "is this the same scale" — a hair under a tenth of a percent. */
const SCALE_EPSILON = 1e-3;
/** Absolute tolerance for "is this the same offset", in CSS pixels. */
const OFFSET_EPSILON = 0.5;

/** The scale at which the whole image is just visible inside `box`. */
export function fitScale(box: Box, image: Box): number {
  if (!(box.width > 0) || !(box.height > 0) || !(image.width > 0) || !(image.height > 0)) return 1;
  return Math.min(box.width / image.width, box.height / image.height);
}

/** Fit, centred — the view a viewer opens at and the one `0` returns to. */
export function fitView(box: Box, image: Box): StageView {
  const scale = fitScale(box, image);
  return centred(scale, box, image);
}

/** The whole image visible at 1:1 if it fits, otherwise fit — a sane opening view. */
export function initialView(box: Box, image: Box): StageView {
  return centred(Math.min(1, fitScale(box, image)), box, image);
}

function centred(scale: number, box: Box, image: Box): StageView {
  return {
    scale,
    tx: (box.width - image.width * scale) / 2,
    ty: (box.height - image.height * scale) / 2,
  };
}

/** Whether `view` is (indistinguishably) the fit view for this box and image. */
export function isFit(view: StageView, box: Box, image: Box): boolean {
  const fit = fitView(box, image);
  return (
    Math.abs(view.scale - fit.scale) <= fit.scale * SCALE_EPSILON &&
    Math.abs(view.tx - fit.tx) <= OFFSET_EPSILON &&
    Math.abs(view.ty - fit.ty) <= OFFSET_EPSILON
  );
}

/** Where the **centre of** image pixel `p` lands in the viewport. */
export function toScreen(view: StageView, p: Point): Point {
  return {
    x: (p.x + PIXEL_CENTRE) * view.scale + view.tx,
    y: (p.y + PIXEL_CENTRE) * view.scale + view.ty,
  };
}

/**
 * Which image coordinate a viewport position is over, in the same pixel-centre convention:
 * the exact centre of the top-left pixel reads `0, 0`, and its top-left corner `-0.5, -0.5`.
 *
 * Unbounded — callers clamp if they care.
 */
export function toImage(view: StageView, p: Point): Point {
  return {
    x: (p.x - view.tx) / view.scale - PIXEL_CENTRE,
    y: (p.y - view.ty) / view.scale - PIXEL_CENTRE,
  };
}

/** Whether an image coordinate is inside the image, in the pixel-centre convention. */
export function insideImage(p: Point, image: Box): boolean {
  return (
    p.x >= -PIXEL_CENTRE &&
    p.y >= -PIXEL_CENTRE &&
    p.x < image.width - PIXEL_CENTRE &&
    p.y < image.height - PIXEL_CENTRE
  );
}

/** A length in image pixels that covers `css` screen pixels at this view. */
export function imageLengthFor(view: StageView, css: number): number {
  return view.scale > 0 ? css / view.scale : css;
}

/**
 * Change the scale while holding whatever is under `anchor` where it is.
 *
 * The one piece of arithmetic here that is silently wrong when centre-anchored instead:
 * magnifying a defect in a corner then costs a drag to undo every wheel notch.
 */
export function zoomAbout(view: StageView, scale: number, anchor: Point): StageView {
  if (!(view.scale > 0) || !(scale > 0)) return view;
  const ratio = scale / view.scale;
  return {
    scale,
    tx: anchor.x - (anchor.x - view.tx) * ratio,
    ty: anchor.y - (anchor.y - view.ty) * ratio,
  };
}

export interface ClampOptions {
  /** Lowest scale, as a multiple of fit. Defaults to `MIN_SCALE_VS_FIT`. */
  minScaleVsFit?: number;
  maxScale?: number;
}

/** The scale range a viewport allows for an image, as `[min, max]`. */
export function scaleRange(box: Box, image: Box, options: ClampOptions = {}): [number, number] {
  const fit = fitScale(box, image);
  const min = fit * (options.minScaleVsFit ?? MIN_SCALE_VS_FIT);
  const max = Math.max(min, options.maxScale ?? MAX_SCALE);
  return [min, max];
}

/**
 * Keep the view legal: scale inside its range, and the image never dragged off screen.
 *
 * An axis where the scaled image is smaller than the viewport is centred rather than left
 * where a drag put it — free-floating pixels in a grey field is a way to be lost with no
 * visible handle to get back. An axis where it is larger is held so the viewport stays
 * covered.
 */
export function clampView(
  view: StageView,
  box: Box,
  image: Box,
  options: ClampOptions = {},
): StageView {
  const [min, max] = scaleRange(box, image, options);
  const scale = clamp(view.scale, min, max);
  return {
    scale,
    tx: clampAxis(view.tx, box.width, image.width * scale),
    ty: clampAxis(view.ty, box.height, image.height * scale),
  };
}

function clampAxis(t: number, boxLength: number, contentLength: number): number {
  if (contentLength <= boxLength) return (boxLength - contentLength) / 2;
  return clamp(t, boxLength - contentLength, 0);
}

/**
 * The view that puts `rect` (image coordinates) on screen with a margin around it.
 *
 * `pad` is a fraction of the rect's own size, so framing a long thin contour and framing a
 * blob both leave a proportionate border rather than a fixed one that swallows the small
 * one.
 */
export function frameRect(box: Box, image: Box, rect: Rect, pad = 0.15): StageView {
  const width = Math.max(rect.width, 1e-6) * (1 + 2 * pad);
  const height = Math.max(rect.height, 1e-6) * (1 + 2 * pad);
  const scale = Math.min(box.width / width, box.height / height);
  const centre = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  return clampView(
    {
      scale,
      tx: box.width / 2 - (centre.x + PIXEL_CENTRE) * scale,
      ty: box.height / 2 - (centre.y + PIXEL_CENTRE) * scale,
    },
    box,
    image,
    { maxScale: MAX_SCALE },
  );
}

/**
 * The same view, after the viewport changed size.
 *
 * The image point at the old centre stays at the new centre, at the same scale — so a
 * window resize moves the frame around the picture instead of moving the picture. A view
 * that was *fit* re-fits instead, because fit is a relationship to the viewport rather than
 * a particular pair of numbers.
 */
export function preserveCenter(
  view: StageView,
  from: Box,
  to: Box,
  image: Box,
  options: ClampOptions = {},
): StageView {
  if (!(from.width > 0) || !(from.height > 0)) return clampView(fitView(to, image), to, image, options);
  if (isFit(view, from, image)) return fitView(to, image);

  const centre = toImage(view, { x: from.width / 2, y: from.height / 2 });
  return clampView(
    {
      scale: view.scale,
      tx: to.width / 2 - (centre.x + PIXEL_CENTRE) * view.scale,
      ty: to.height / 2 - (centre.y + PIXEL_CENTRE) * view.scale,
    },
    to,
    image,
    options,
  );
}

/**
 * The next scale up or down the ladder from `scale`, so the readout lands on a round
 * percentage rather than wherever a multiplier happened to leave it.
 */
export function steppedScale(scale: number, direction: 1 | -1, min: number, max: number): number {
  const ladder = SCALE_LADDER.filter((s) => s >= min - 1e-9 && s <= max + 1e-9);
  const candidates = ladder.length > 0 ? ladder : [clamp(scale, min, max)];
  if (direction > 0) {
    const next = candidates.find((s) => s > scale * (1 + SCALE_EPSILON));
    return next ?? Math.min(max, Math.max(scale, candidates[candidates.length - 1]!));
  }
  const previous = [...candidates].reverse().find((s) => s < scale * (1 - SCALE_EPSILON));
  return previous ?? Math.max(min, Math.min(scale, candidates[0]!));
}

/** `0.5` → `"50%"`, `1` → `"100%"`, `0.0833` → `"8%"`. */
export function formatScale(scale: number): string {
  const percent = scale * 100;
  if (percent >= 100) return `${Math.round(percent)}%`;
  if (percent >= 10) return `${Math.round(percent)}%`;
  return `${percent.toFixed(1)}%`;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}
