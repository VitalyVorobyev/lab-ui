/** A source-pixel raster mask layer with a small paint/erase brush. */

import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type PointerEvent } from "react";

import { imageViewBox } from "./stage/view";
import { useStage } from "./stage/ImageStage";
import type { Point } from "./measureGeometry";

/** Paint a continuous round stroke into a copied binary mask. Pixel centers are integers. */
export function paintMask(mask: Uint8Array, width: number, height: number, from: Point, to: Point, radius: number, value: 0 | 1): Uint8Array {
  if (mask.length !== width * height) throw new RangeError("Mask dimensions do not match its pixel data.");
  if (![from.x, from.y, to.x, to.y, radius].every(Number.isFinite) || radius < 0) throw new RangeError("Brush coordinates and radius must be finite and nonnegative.");
  const next = mask.slice();
  const clamp = (value: number, limit: number) => Math.max(0, Math.min(limit - 1, value));
  const start = { x: clamp(from.x, width), y: clamp(from.y, height) };
  const end = { x: clamp(to.x, width), y: clamp(to.y, height) };
  const steps = Math.max(1, Math.ceil(Math.hypot(end.x - start.x, end.y - start.y)));
  // A click between four pixel centers must still affect the nearest pixels.
  const r = Math.max(0.75, radius);
  for (let step = 0; step <= steps; step++) {
    const x = start.x + (end.x - start.x) * step / steps;
    const y = start.y + (end.y - start.y) * step / steps;
    for (let row = Math.max(0, Math.ceil(y - r)); row <= Math.min(height - 1, Math.floor(y + r)); row++) {
      for (let col = Math.max(0, Math.ceil(x - r)); col <= Math.min(width - 1, Math.floor(x + r)); col++) {
        if ((col - x) ** 2 + (row - y) ** 2 <= r * r) next[row * width + col] = value;
      }
    }
  }
  return next;
}

/** Binary mask values are 0 or 1, in row-major source-image coordinates. */
export interface MaskEditorProps {
  /** Exactly image width × image height bytes. */
  mask: Uint8Array;
  /** Receives a fresh array after each brush movement. */
  onChange: (mask: Uint8Array) => void;
  /** Called once when a pointer stroke or keyboard paint finishes. */
  onCommit?: () => void;
  /** Allow brush interaction; otherwise render only. */
  editable?: boolean;
  /** Source-image pixels, independent of zoom. */
  brushRadius?: number;
  /** Paint or erase. */
  mode?: "paint" | "erase";
  /** Accessible name for the brush control. */
  label?: string;
  /** RGBA overlay color. */
  color?: readonly [number, number, number, number];
}

/** Render and edit a binary raster mask within the enclosing ImageStage. */
export function MaskEditor({ mask, onChange, onCommit, editable = false, brushRadius = 3, mode = "paint", label = "Mask brush", color = [0, 190, 220, 128] }: MaskEditorProps) {
  const stage = useStage();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const draftRef = useRef(mask);
  const lastRef = useRef<Point | null>(null);
  // The keyboard brush; it starts at the image centre and follows the last pointer stroke.
  const cursorRef = useRef<Point | null>(null);
  // Where the keyboard brush is drawn, while the layer has keyboard focus.
  const [brush, setBrush] = useState<Point | null>(null);

  function cursor(): Point {
    return cursorRef.current ?? { x: Math.floor(stage.image.width / 2), y: Math.floor(stage.image.height / 2) };
  }

  useEffect(() => {
    if (mask.length !== stage.image.width * stage.image.height) throw new RangeError("Mask dimensions do not match ImageStage.");
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    const pixels = context.createImageData(stage.image.width, stage.image.height);
    for (let i = 0; i < mask.length; i++) {
      if (mask[i]) pixels.data.set(color, i * 4);
    }
    context.putImageData(pixels, 0, 0);
  }, [mask, color, stage.image.width, stage.image.height]);

  function apply(from: Point, to: Point) {
    const next = paintMask(draftRef.current, stage.image.width, stage.image.height, from, to, brushRadius, mode === "paint" ? 1 : 0);
    draftRef.current = next;
    onChange(next);
  }

  function down(event: PointerEvent<HTMLCanvasElement>) {
    if (!editable || stage.panMode || event.button !== 0) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = stage.toImage({ x: event.clientX, y: event.clientY });
    // Each stroke starts from the mask the caller holds, so an edit it rejected is not carried forward.
    draftRef.current = mask;
    lastRef.current = point;
    cursorRef.current = point;
    setBrush(null);
    apply(point, point);
  }

  function move(event: PointerEvent<HTMLCanvasElement>) {
    if (!lastRef.current) return;
    event.stopPropagation();
    const point = stage.toImage({ x: event.clientX, y: event.clientY });
    apply(lastRef.current, point);
    lastRef.current = point;
    cursorRef.current = point;
  }

  function up(event: PointerEvent<HTMLCanvasElement>) {
    if (!lastRef.current) return;
    event.stopPropagation();
    lastRef.current = null;
    onCommit?.();
  }

  function keyDown(event: KeyboardEvent<HTMLCanvasElement>) {
    if (!editable || stage.panMode) return;
    const shift: Record<string, Point> = {
      ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 },
    };
    const delta = shift[event.key];
    if (delta) {
      event.preventDefault();
      event.stopPropagation();
      const from = cursor();
      cursorRef.current = {
        x: Math.max(0, Math.min(stage.image.width - 1, from.x + delta.x)),
        y: Math.max(0, Math.min(stage.image.height - 1, from.y + delta.y)),
      };
      setBrush(cursorRef.current);
    } else if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      const at = cursor();
      draftRef.current = mask;
      setBrush(at);
      apply(at, at);
      onCommit?.();
    }
  }

  function focus(event: FocusEvent<HTMLCanvasElement>) {
    if (editable && event.currentTarget.matches(":focus-visible")) setBrush(cursor());
  }

  return (
    <>
      <canvas ref={canvasRef} width={stage.image.width} height={stage.image.height} className={`absolute inset-0 h-full w-full ${editable ? "pointer-events-auto cursor-crosshair" : "pointer-events-none"}`} style={{ imageRendering: "pixelated" }} role={editable ? "button" : "img"} tabIndex={editable ? 0 : undefined} aria-label={label} aria-description={editable ? "Arrow keys move the brush; Enter paints or erases." : undefined} onPointerDown={down} onPointerMove={move} onPointerUp={up} onLostPointerCapture={up} onDoubleClick={(event) => { if (editable && !stage.panMode) event.stopPropagation(); }} onKeyDown={keyDown} onFocus={focus} onBlur={() => setBrush(null)} />
      {brush && (
        <svg viewBox={imageViewBox(stage.image)} className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
          <circle cx={brush.x} cy={brush.y} r={Math.max(0.75, brushRadius)} fill="none" stroke="var(--signal)" strokeWidth={stage.imageLength(1.5)} />
        </svg>
      )}
    </>
  );
}
