/**
 * A scalar field or a pre-coloured buffer, drawn as one image over (or under) the overlays.
 *
 * A heatmap is a raster, not vector geometry : it is rendered once into an
 * offscreen canvas, handed to the browser as an object URL, and shown by an `<img>` the stage
 * positions and scales like the photograph. Nothing is drawn per pixel by React, so a 4-megapixel
 * map costs one element. It takes no pointer events; to read the numbers under the pointer, use
 * `valueAt` on the plane.
 */

import { useEffect, useRef, useState } from "react";

import { cn } from "@vitavision/ui";
import type { ValuePlane } from "../api/mapValues";
import { rasterizePlane, type Colormap, type ValueRange } from "./heatmapRaster";
import { useStage } from "./stage/ImageStage";
import { PIXEL_CENTRE, type Rect } from "./stage/view";

/** What every `HeatmapLayer` takes. */
export interface HeatmapLayerBaseProps {
  /** How opaque the heatmap is, 0 to 1. Defaults to `1`. */
  opacity?: number | undefined;
  /** Draw it. Defaults to `true`. While `false` nothing is rasterised. */
  visible?: boolean | undefined;
  /**
   * Where the raster is placed, in image coordinates: `x` and `y` the top-left edge of its
   * first pixel's footprint (`-0.5, -0.5` is the image's own top-left corner), `width` and `height`
   * the extent it is stretched over. Defaults to the whole image, so a raster of any
   * resolution covers it 1:1 in position.
   */
  rect?: Rect | undefined;
  /** The zoom (CSS pixels per heatmap pixel) from which heatmap pixels are drawn as blocks. Defaults to 4. */
  pixelatedAbove?: number | undefined;
  /** A description for assistive technology. Defaults to `""`: decorative, as the legend carries the meaning. */
  alt?: string | undefined;
  /** Called once the raster is on screen (and again for each new one). */
  onReady?: (() => void) | undefined;
  /** Called when the raster could not be made: a canvas that could not be allocated, or an `rgba` buffer too short for its size. */
  onError?: (() => void) | undefined;
  /** Merged onto the image with `cn`. */
  className?: string | undefined;
}

/** A heatmap from pixels that are already coloured. */
export interface HeatmapRgbaProps extends HeatmapLayerBaseProps {
  /** Row-major RGBA, `width · height · 4` bytes. A `Uint8Array` is read in place, not copied. */
  rgba: Uint8ClampedArray | Uint8Array;
  /** The raster's width in pixels. */
  width: number;
  /** The raster's height in pixels. */
  height: number;
  /** Not used with `rgba`. */
  plane?: undefined;
  /** Not used with `rgba`. */
  colormap?: undefined;
  /** Not used with `rgba`. */
  range?: undefined;
  /** Not used with `rgba`. */
  channel?: undefined;
}

/** A heatmap from a scalar field and a colour map. */
export interface HeatmapPlaneProps extends HeatmapLayerBaseProps {
  /** The field, as decoded by `decodePlane`. */
  plane: ValuePlane;
  /**
   * The colour map. `NaN` pixels stay transparent. Pass a stable function: a new one
   * re-rasterises the heatmap. `@vitavision/charts`' `(t) => colormapRgb("viridis", t)` is one.
   */
  colormap: Colormap;
  /** What the map spans. Defaults to the extent of the channel's finite values. */
  range?: ValueRange | undefined;
  /** Which channel of the plane to draw. Defaults to the first. */
  channel?: number | undefined;
  /** Not used with `plane`. */
  rgba?: undefined;
  /** Not used with `plane`. */
  width?: undefined;
  /** Not used with `plane`. */
  height?: undefined;
}

/** Props of `HeatmapLayer`: pre-coloured `rgba` pixels, or a `plane` with a `colormap`. */
export type HeatmapLayerProps = HeatmapRgbaProps | HeatmapPlaneProps;

/** A raster on screen and the object URL it came from. */
interface Raster {
  url: string;
  width: number;
  height: number;
}

/**
 * A heatmap inside an `ImageStage`: a scalar field coloured through a colour map, or an RGBA
 * buffer, placed over the image (default) or any rectangle of it.
 *
 * - **Rasterised in an effect**, once per change of its data, into an offscreen canvas and an
 *   object URL that is revoked when replaced and on unmount. Server rendering draws nothing.
 * - **Pixelated** from 4 CSS pixels per heatmap pixel, like `ImageLayer`, so the cells of a
 *   coarse map are not smoothed into a blur.
 * - **Stacking:** it is drawn where it is placed among the stage's children. Before the
 *   overlays it sits under them; the image layer goes before it.
 * - **Input:** none. It takes no pointer events, so presses reach the layers above and the stage.
 *
 * The image carries `data-heatmap`, `data-pixelated` while pixelated, and `data-ready`.
 */
export function HeatmapLayer(props: HeatmapLayerProps) {
  const { opacity = 1, visible = true, rect, pixelatedAbove = 4, alt = "", onReady, onError, className } = props;
  const stage = useStage();
  const [raster, setRaster] = useState<Raster | null>(null);
  const [ready, setReady] = useState(false);
  const urlRef = useRef<string | null>(null);
  const callbacksRef = useRef({ onReady, onError });
  useEffect(() => {
    callbacksRef.current = { onReady, onError };
  });

  // The inputs that change what is drawn, spelled out so the effect re-runs on exactly those.
  const { rgba, width, height, plane, colormap, channel } = props;
  const rangeLow = props.range?.low;
  const rangeHigh = props.range?.high;

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    const range = rangeLow === undefined || rangeHigh === undefined ? undefined : { low: rangeLow, high: rangeHigh };
    const source = rgba ? wrapRgba(rgba, width, height) : plane && colormap ? colourPlane(plane, colormap, range, channel) : null;
    const canvas = document.createElement("canvas");
    const context = source ? ((canvas.width = source.width), (canvas.height = source.height), canvas.getContext("2d")) : null;
    if (!source || !context) {
      callbacksRef.current.onError?.();
      return;
    }
    const { width: w, height: h } = source;
    context.putImageData(new ImageData(source.pixels, w, h), 0, 0);
    canvas.toBlob((blob) => {
      if (cancelled) return;
      if (!blob) {
        callbacksRef.current.onError?.();
        return;
      }
      const previous = urlRef.current;
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      setReady(false);
      setRaster({ url, width: w, height: h });
      // The old image is replaced in this commit; the browser has already decoded it.
      if (previous) URL.revokeObjectURL(previous);
    });
    return () => {
      cancelled = true;
    };
  }, [visible, rgba, width, height, plane, colormap, rangeLow, rangeHigh, channel]);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    },
    [],
  );

  if (!visible || raster === null) return null;
  const box = rect ?? { x: -PIXEL_CENTRE, y: -PIXEL_CENTRE, width: stage.image.width, height: stage.image.height };
  const pixelated = (stage.view.scale * box.width) / raster.width >= pixelatedAbove;
  return (
    <img
      src={raster.url}
      alt={alt}
      draggable={false}
      data-heatmap=""
      data-ready={ready ? "" : undefined}
      data-pixelated={pixelated ? "" : undefined}
      onLoad={() => {
        setReady(true);
        callbacksRef.current.onReady?.();
      }}
      className={cn("pointer-events-none absolute max-w-none select-none", className)}
      style={{
        left: box.x + PIXEL_CENTRE,
        top: box.y + PIXEL_CENTRE,
        width: box.width,
        height: box.height,
        opacity,
        pointerEvents: "none",
        imageRendering: pixelated ? "pixelated" : undefined,
      }}
    />
  );
}

/** Pixels to draw, and their size. */
interface Pixels {
  pixels: Uint8ClampedArray<ArrayBuffer>;
  width: number;
  height: number;
}

/** The first `width · height · 4` bytes of an RGBA buffer, read in place; `null` if it is too short or empty. */
function wrapRgba(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number): Pixels | null {
  const length = width * height * 4;
  if (!(length > 0) || rgba.length < length) return null;
  return { pixels: new Uint8ClampedArray(rgba.buffer as ArrayBuffer, rgba.byteOffset, length), width, height };
}

/** A plane through a colour map; `null` for an empty plane. */
function colourPlane(plane: ValuePlane, colormap: Colormap, range: ValueRange | undefined, channel: number | undefined): Pixels | null {
  if (!(plane.width > 0 && plane.height > 0)) return null;
  const pixels = rasterizePlane(plane, colormap, range, channel) as Uint8ClampedArray<ArrayBuffer>;
  return { pixels, width: plane.width, height: plane.height };
}
