/**
 * The photograph, as a stage layer.
 *
 * The stage is laid out at the image's own pixel size, so the photograph is drawn at its
 * natural size, with no `object-fit` letterbox for an overlay to disagree with.
 *
 * Two things every viewer of a large frame ends up doing by hand, done once here:
 *
 *   - **A preview tier, then the full image.** A downscaled preview loads fast and is enough
 *     until it would be magnified — until the screen shows more pixels than it has. Past that
 *     point the full image is requested, and it stays once loaded, so zooming back out does
 *     not swap back. The preview stays underneath while the full image loads, so the frame
 *     never goes blank. When the full image is costly to produce, the app can leave its URL
 *     out and supply it when `onFullNeeded` says the same rule has tripped.
 *   - **Pixelated past a zoom.** Above about 4× the browser's smoothing paints detail the
 *     sensor never recorded; on a metrology bench the sensor's own samples are what is worth
 *     looking at.
 */

import { useEffect, useRef, useState } from "react";

import { cn } from "@vitavision/ui";
import { useStage } from "./ImageStage";

/** A downscaled tier of the image, shown until the stage would magnify it. */
export interface ImageTier {
  /** Its URL. */
  src: string;
  /** Its width in pixels. The full image's width is the stage's own. */
  width: number;
}

/** What every `ImageLayer` takes, whichever tiers it is given. */
export interface ImageLayerBaseProps {
  /** The image's description, for assistive technology. `""` marks it decorative. */
  alt: string;
  /** The zoom (CSS pixels per image pixel) from which pixels are drawn as blocks. Defaults to 4. */
  pixelatedAbove?: number | undefined;
  /**
   * Called once per `preview.src` when the full image is first wanted: the stage would magnify
   * the preview. An app whose full image is costly to make or fetch leaves `src` out and
   * passes it from here; the full image is shown as soon as `src` arrives. Not called without
   * a `preview`.
   */
  onFullNeeded?: (() => void) | undefined;
  /** Called when the full image has loaded. */
  onLoad?: (() => void) | undefined;
  /** Called when the full image fails to load. */
  onError?: (() => void) | undefined;
  /** Merged onto both images with `cn`. */
  className?: string | undefined;
}

/**
 * Props of `ImageLayer`: the full image's `src`, a `preview` tier, or both. With a `preview`,
 * `src` may be left out until `onFullNeeded` asks for it.
 */
export type ImageLayerProps = ImageLayerBaseProps &
  (
    | {
        /** The full-resolution image's URL. */
        src: string;
        /** A smaller tier to show first; without one, `src` is shown from the start. */
        preview?: ImageTier | undefined;
      }
    | {
        /** The full-resolution image's URL, once known. Until then the preview stands in. */
        src?: string | undefined;
        /** A smaller tier to show first. */
        preview: ImageTier;
      }
  );

/**
 * The photograph at its natural size inside an `ImageStage`, with an optional preview tier
 * and pixelated rendering past `pixelatedAbove`. It takes no pointer events, so presses reach
 * the stage and the layers above.
 *
 * With a `preview`, the full image is wanted once the stage would magnify the preview, and
 * `onFullNeeded` says so; `src` can be supplied then rather than up front.
 *
 * Each image carries `data-tier` (`preview` or `full`); the full image carries `data-loaded`
 * once it has loaded, the preview carries `data-wants-full` from the moment the full image is
 * wanted until it has loaded, and both carry `data-pixelated` while pixelated.
 */
export function ImageLayer({
  src,
  preview,
  alt,
  pixelatedAbove = 4,
  onFullNeeded,
  onLoad,
  onError,
  className,
}: ImageLayerProps) {
  const stage = useStage();
  const scale = stage.view.scale;
  // The full image is wanted once the preview would be magnified on screen: its own pixels
  // per image pixel are `preview.width / image.width`. Not before the viewport is measured:
  // the placeholder view then is 1:1, which would fetch the full image on every open.
  const measured = stage.box.width > 0;
  const previewSrc = preview?.src ?? null;
  const magnified = preview !== undefined && measured && scale * stage.image.width > preview.width;
  // Wanted once per preview, and kept: zooming back out should not drop the pixels already
  // fetched.
  const [wantedFor, setWantedFor] = useState<string | null>(magnified ? previewSrc : null);
  if (magnified && wantedFor !== previewSrc) setWantedFor(previewSrc);
  const wanted = previewSrc === null || wantedFor === previewSrc;
  const [loaded, setLoaded] = useState<string | null>(null);

  // Told once per preview: the guard holds through a new `onFullNeeded` and a re-run effect.
  const notifiedRef = useRef<string | null>(null);
  useEffect(() => {
    if (previewSrc === null || wantedFor !== previewSrc || notifiedRef.current === previewSrc) return;
    notifiedRef.current = previewSrc;
    onFullNeeded?.();
  }, [previewSrc, wantedFor, onFullNeeded]);

  const showFull = wanted && src !== undefined;
  const fullReady = src !== undefined && loaded === src;
  const pixelated = scale >= pixelatedAbove;
  const shared = cn("pointer-events-none absolute inset-0 h-full w-full select-none", className);
  const rendering = pixelated ? ("pixelated" as const) : undefined;

  return (
    <>
      {preview && !fullReady && (
        <img
          src={preview.src}
          alt={showFull ? "" : alt}
          aria-hidden={showFull ? true : undefined}
          draggable={false}
          data-tier="preview"
          data-wants-full={wanted ? "" : undefined}
          data-pixelated={pixelated ? "" : undefined}
          className={shared}
          style={{ imageRendering: rendering }}
        />
      )}
      {showFull && (
        <img
          src={src}
          alt={alt}
          draggable={false}
          data-tier="full"
          data-loaded={fullReady ? "" : undefined}
          data-pixelated={pixelated ? "" : undefined}
          onLoad={() => {
            setLoaded(src);
            onLoad?.();
          }}
          onError={() => onError?.()}
          className={cn(shared, preview && !fullReady && "opacity-0")}
          style={{ imageRendering: rendering }}
        />
      )}
    </>
  );
}
