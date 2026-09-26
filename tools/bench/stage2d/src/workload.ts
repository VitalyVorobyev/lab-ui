/**
 * The scripted workload: a view (and a pointer position) as a pure function of elapsed
 * time, so every candidate sees the same sequence regardless of how fast it renders.
 *
 *   0 – 4 s   pan: a circle of radius 40% of the viewport at 2× fit
 *   4 – 8 s   zoom: fit ↔ 16× fit about a drifting anchor
 *   8 – 10 s  both at once
 *
 * The pointer sweeps a Lissajous curve across the viewport throughout; every frame issues
 * one hit-test at it.
 */

export interface View {
  /** CSS pixels per image pixel. */
  scale: number;
  tx: number;
  ty: number;
}

export interface Box {
  width: number;
  height: number;
}

export const DURATION_MS = 10_000;

export function fitScale(box: Box, image: Box): number {
  return Math.min(box.width / image.width, box.height / image.height);
}

/** The view whose centre shows image point `(cx, cy)` at `scale`. */
function centredOn(box: Box, scale: number, cx: number, cy: number): View {
  return { scale, tx: box.width / 2 - cx * scale, ty: box.height / 2 - cy * scale };
}

export function viewAt(t: number, box: Box, image: Box): View {
  const fit = fitScale(box, image);
  const centre = { x: image.width / 2, y: image.height / 2 };
  const orbit = (phase: number, scale: number) => {
    const r = (0.4 * Math.min(box.width, box.height)) / scale;
    return { x: centre.x + r * Math.cos(phase), y: centre.y + r * Math.sin(phase) };
  };
  if (t < 4000) {
    const scale = 2 * fit;
    const c = orbit((t / 4000) * Math.PI * 2, scale);
    return centredOn(box, scale, c.x, c.y);
  }
  if (t < 8000) {
    const u = (t - 4000) / 4000;
    const scale = fit * Math.pow(16, 0.5 - 0.5 * Math.cos(u * Math.PI * 4));
    const drift = { x: centre.x + image.width * 0.2 * Math.sin(u * Math.PI * 2), y: centre.y };
    return centredOn(box, scale, drift.x, drift.y);
  }
  const u = (t - 8000) / 2000;
  const scale = fit * Math.pow(8, 0.5 - 0.5 * Math.cos(u * Math.PI * 2));
  const c = orbit(u * Math.PI * 4, scale);
  return centredOn(box, scale, c.x, c.y);
}

export function pointerAt(t: number, box: Box): { x: number; y: number } {
  const s = t / 1000;
  return {
    x: box.width * (0.5 + 0.45 * Math.sin(s * 1.7)),
    y: box.height * (0.5 + 0.45 * Math.sin(s * 2.3 + 0.5)),
  };
}

export function toImage(view: View, p: { x: number; y: number }) {
  return { x: (p.x - view.tx) / view.scale, y: (p.y - view.ty) / view.scale };
}

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[i]!;
}
