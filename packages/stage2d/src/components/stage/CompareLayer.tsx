/**
 * Two registered images of one size, compared in place: a checkerboard of the two, a wipe
 * between them, or their difference.
 *
 * A stage layer like `ImageLayer`: both images are laid out at the stage's own pixel size, so
 * they stay registered with each other and with every overlay at any zoom. All three modes are
 * CSS on the second image (a mask, a clip, a blend), never a canvas, so nothing is read back or
 * redrawn as the view moves.
 */

import { useState, type KeyboardEvent, type PointerEvent } from "react";

import { cn } from "@vitavision/ui";
import { visibleRect } from "../labelLod";
import { overlayRole } from "../overlayRole";
import { clampSplit, compareStyles, knobPosition, splitForKey, splitText, type CompareMode, type CompareOrientation } from "./compareStyle";
import { useStage } from "./ImageStage";
import { useStageDrag } from "./StageSurface";
import { useScreenPx } from "./useScreenPx";
import { PIXEL_CENTRE } from "./view";

/** Props of `CompareLayer`. */
export interface CompareLayerProps {
  /** Image A's URL: the reference. It is the stage's size. */
  a: string;
  /** Image B's URL: compared with A. The same size as A. */
  b: string;
  /**
   * How they are compared.
   * - `checker`: alternate squares of A and B, `cell` image pixels across, A at the top-left.
   * - `wipe`: A before the divider and B after it; drag the divider, or focus it and use the keys.
   * - `difference`: the per-channel difference of the two, brightened by `gain`. Identical pixels
   *   are black. It is computed on the sRGB-encoded values the browser composites, not on linear
   *   light, so treat it as a picture of where the images differ, not as a measurement.
   */
  mode: CompareMode;
  /** The wipe's divider, as the fraction of the image before it (0 to 1), when the app controls it. */
  split?: number | undefined;
  /** The divider's starting place when the layer controls it. Defaults to 0.5. */
  defaultSplit?: number | undefined;
  /** Called as the divider is dragged or moved by a key, with the new fraction. */
  onSplitChange?: ((split: number) => void) | undefined;
  /** `vertical` (the default) puts A left of the divider; `horizontal` puts A above it. */
  orientation?: CompareOrientation | undefined;
  /** The checkerboard's square, in image pixels. Defaults to 32. */
  cell?: number | undefined;
  /** How much the difference is brightened: 1 shows it as it is, 4 makes a small one visible. Defaults to 1. */
  gain?: number | undefined;
  /** What the comparison shows, for assistive technology. */
  alt: string;
  /** The two images' names, for the divider's value and its tags. Defaults to `["A", "B"]`. */
  labels?: readonly [string, string] | undefined;
  /** The zoom (CSS pixels per image pixel) from which pixels are drawn as blocks. Defaults to 4. */
  pixelatedAbove?: number | undefined;
  /** Merged onto the layer's wrapper with `cn`. */
  className?: string | undefined;
}

/** The divider's line, its knob's radius and the band that grabs it, in screen pixels. */
const LINE_PX = 1.5;
const KNOB_PX = 8;
const GRAB_PX = 12;
/** The tags' size and their distance from the knob's centre, in screen pixels. */
const TAG_PX = 11;
const TAG_GAP_PX = 14;

const HALO = overlayRole("halo");
const DIVIDER = overlayRole("label");

/**
 * Two same-size images compared inside an `ImageStage`: as a checkerboard, a wipe or their
 * difference (`mode`).
 *
 * - **Wipe.** The divider is a line one and a half screen pixels wide with a knob kept in the
 *   middle of the part of it on screen. Drag the line or the knob; the press is claimed, so the
 *   stage does not pan from it.
 * - **Keyboard.** The knob is a slider (0 to 100, the share of A): arrow keys move it 1 % (10 %
 *   with Shift), Page Up and Page Down 10 %, Home and End to either edge. The keys do not reach
 *   the stage, so they do not pan it.
 * - **Pixels.** Past `pixelatedAbove` both images are drawn as blocks, as `ImageLayer` does.
 *
 * The images are one picture to assistive technology (`role="img"`, named by `alt`); the knob is
 * outside it, so it stays reachable. The wrapper carries `data-mode`, and `data-pixelated` while
 * pixelated; the knob carries `data-dragging` during a drag.
 */
export function CompareLayer({
  a,
  b,
  mode,
  split,
  defaultSplit = 0.5,
  onSplitChange,
  orientation = "vertical",
  cell = 32,
  gain = 1,
  alt,
  labels = ["A", "B"],
  pixelatedAbove = 4,
  className,
}: CompareLayerProps) {
  const stage = useStage();
  const px = useScreenPx();
  const startDrag = useStageDrag();
  const [ownSplit, setOwnSplit] = useState(() => clampSplit(defaultSplit));
  const [dragging, setDragging] = useState(false);
  const current = clampSplit(split ?? ownSplit);

  const change = (next: number) => {
    const clamped = clampSplit(next);
    setOwnSplit(clamped);
    onSplitChange?.(clamped);
  };

  const styles = compareStyles(mode, { split: current, orientation, cell, gain });
  const pixelated = stage.view.scale >= pixelatedAbove;
  const image = { width: stage.image.width, height: stage.image.height };
  const imgClass = "pointer-events-none absolute inset-0 h-full w-full select-none";
  const rendering = pixelated ? ("pixelated" as const) : undefined;

  // The divider is drawn in the layer's own CSS pixels (0 at the image's left edge, not at its
  // first pixel's centre), the frame `clip-path` and `visibleRect` work in.
  const vertical = orientation === "vertical";
  const length = vertical ? image.height : image.width;
  const extent = vertical ? image.width : image.height;
  const at = current * extent;
  const visible = visibleRect(stage.view, stage.box);
  const along = knobPosition(visible === null ? null : vertical ? [visible.y, visible.y + visible.height] : [visible.x, visible.x + visible.width], length);
  const knob = vertical ? { x: at, y: along } : { x: along, y: at };
  const line = vertical ? { x1: at, y1: 0, x2: at, y2: image.height } : { x1: 0, y1: at, x2: image.width, y2: at };

  const grab = (event: PointerEvent<SVGElement>) => {
    if (stage.panMode) return;
    if (event.pointerType !== "touch" && event.button !== 0) return;
    setDragging(true);
    const follow = (p: { x: number; y: number }) => change(((vertical ? p.x : p.y) + PIXEL_CENTRE) / extent);
    startDrag(event, {
      claimsTouch: true,
      onMove: follow,
      onEnd: () => setDragging(false),
      onCancel: () => setDragging(false),
    });
  };

  const onKeyDown = (event: KeyboardEvent<SVGElement>) => {
    const next = splitForKey(current, event.key, event.shiftKey, orientation);
    if (next === null) return;
    event.preventDefault();
    event.stopPropagation();
    change(next);
  };

  return (
    <div className={cn("pointer-events-none absolute inset-0", className)} data-mode={mode} data-pixelated={pixelated ? "" : undefined}>
      <div role="img" aria-label={alt} className="absolute inset-0" style={styles.wrapper}>
        <img src={a} alt="" draggable={false} data-image="a" className={imgClass} style={{ imageRendering: rendering }} />
        <img src={b} alt="" draggable={false} data-image="b" className={imgClass} style={{ ...styles.b, imageRendering: rendering }} />
      </div>
      {mode === "wipe" && (
        <svg viewBox={`0 0 ${image.width} ${image.height}`} className="absolute inset-0 h-full w-full overflow-visible" data-divider="">
          <line {...line} stroke={HALO} strokeWidth={px(LINE_PX + 2)} />
          <line {...line} stroke={DIVIDER} strokeWidth={px(LINE_PX)} />
          <line
            {...line}
            data-divider-band=""
            stroke="transparent"
            strokeWidth={px(GRAB_PX)}
            className="pointer-events-auto"
            style={{ pointerEvents: "stroke", cursor: vertical ? "ew-resize" : "ns-resize" }}
            aria-hidden
            onPointerDown={grab}
          />
          <circle
            cx={knob.x}
            cy={knob.y}
            r={px(KNOB_PX)}
            fill={DIVIDER}
            stroke={HALO}
            strokeWidth={px(1.5)}
            role="slider"
            tabIndex={0}
            aria-label={`Split between ${labels[0]} and ${labels[1]}`}
            aria-orientation={vertical ? "horizontal" : "vertical"}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(current * 100)}
            aria-valuetext={splitText(current, labels[0])}
            data-dragging={dragging ? "" : undefined}
            className="pointer-events-auto outline-none focus-visible:stroke-signal"
            style={{ cursor: vertical ? "ew-resize" : "ns-resize" }}
            onPointerDown={grab}
            onKeyDown={onKeyDown}
          />
          {/* Which image is on which side, beside the knob. */}
          <g
            aria-hidden
            fontSize={px(TAG_PX)}
            className="font-mono select-none"
            fill={DIVIDER}
            stroke={HALO}
            strokeWidth={px(3)}
            strokeLinejoin="round"
            paintOrder="stroke"
          >
            {vertical ? (
              <>
                <text data-tag="a" x={knob.x - px(TAG_GAP_PX)} y={knob.y} textAnchor="end" dominantBaseline="central">
                  {labels[0]}
                </text>
                <text data-tag="b" x={knob.x + px(TAG_GAP_PX)} y={knob.y} textAnchor="start" dominantBaseline="central">
                  {labels[1]}
                </text>
              </>
            ) : (
              <>
                <text data-tag="a" x={knob.x} y={knob.y - px(TAG_GAP_PX)} textAnchor="middle" dominantBaseline="text-after-edge">
                  {labels[0]}
                </text>
                <text data-tag="b" x={knob.x} y={knob.y + px(TAG_GAP_PX)} textAnchor="middle" dominantBaseline="text-before-edge">
                  {labels[1]}
                </text>
              </>
            )}
          </g>
        </svg>
      )}
    </div>
  );
}
