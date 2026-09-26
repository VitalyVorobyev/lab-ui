/**
 * The L0-3 scene, identical for every candidate: a 20 MP image (5472×3648, a common
 * industrial sensor), 20,000 point markers and 5,000 polyline segments (250 polylines of 20
 * segments each), placed by a seeded PRNG so every run draws exactly the same thing.
 */

export const IMAGE = { width: 5472, height: 3648 } as const;
export const POINT_COUNT = 20_000;
export const POLYLINE_COUNT = 250;
export const SEGMENTS_PER_POLYLINE = 20;

/** Screen-constant overlay geometry (PLAN §5 overlay grammar), in CSS pixels. */
export const MARKER_DIAMETER_PX = 6;
export const STROKE_PX = 1.5;

export interface Scene {
  /** Flat `[x0, y0, x1, y1, …]` in image pixels. */
  points: Float32Array;
  /** One flat `[x0, y0, …]` array per polyline, in image pixels. */
  polylines: Float32Array[];
}

/** mulberry32 — small, fast, and good enough to scatter markers reproducibly. */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeScene(seed = 42): Scene {
  const rand = prng(seed);
  const points = new Float32Array(POINT_COUNT * 2);
  for (let i = 0; i < POINT_COUNT; i++) {
    points[2 * i] = rand() * IMAGE.width;
    points[2 * i + 1] = rand() * IMAGE.height;
  }
  const polylines: Float32Array[] = [];
  const step = 60;
  for (let p = 0; p < POLYLINE_COUNT; p++) {
    const line = new Float32Array((SEGMENTS_PER_POLYLINE + 1) * 2);
    let x = rand() * IMAGE.width;
    let y = rand() * IMAGE.height;
    let heading = rand() * Math.PI * 2;
    for (let s = 0; s <= SEGMENTS_PER_POLYLINE; s++) {
      line[2 * s] = x;
      line[2 * s + 1] = y;
      heading += (rand() - 0.5) * 0.8;
      x = Math.min(IMAGE.width, Math.max(0, x + Math.cos(heading) * step));
      y = Math.min(IMAGE.height, Math.max(0, y + Math.sin(heading) * step));
    }
    polylines.push(line);
  }
  return { points, polylines };
}

/**
 * A deterministic grey-level test image — smooth gradients plus a fine checker, so that
 * resampling at any zoom has real high-frequency content to work on (a flat image would
 * flatter every engine).
 */
export async function makeImage(): Promise<ImageBitmap> {
  const { width, height } = IMAGE;
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#202020");
  gradient.addColorStop(0.5, "#9a9a9a");
  gradient.addColorStop(1, "#303030");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  const cell = 16;
  for (let y = 0; y < height; y += cell) {
    for (let x = (y / cell) % 2 === 0 ? 0 : cell; x < width; x += cell * 2) ctx.fillRect(x, y, cell, cell);
  }
  const rand = prng(7);
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 3;
  for (let i = 0; i < 400; i++) {
    ctx.beginPath();
    ctx.arc(rand() * width, rand() * height, 20 + rand() * 200, 0, Math.PI * 2);
    ctx.stroke();
  }
  return canvas.transferToImageBitmap();
}

/** The same image as an object URL, for the DOM `<img>` candidate. */
export async function imageUrl(bitmap: ImageBitmap): Promise<string> {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  canvas.getContext("bitmaprenderer")!.transferFromImageBitmap(await createImageBitmap(bitmap));
  const blob = await canvas.convertToBlob({ type: "image/png" });
  return URL.createObjectURL(blob);
}
