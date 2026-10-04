/**
 * Whether `will-change: transform` on the stage's transformed box costs sharpness when the
 * view zooms in, measured in Chromium.
 *
 * A compositor layer promoted by `will-change` may keep the raster scale it had when it was
 * promoted, so a stage that opened zoomed out would show a blurry image and thick, soft
 * strokes once zoomed in. The test builds the stage's own DOM shape (an image-sized box with
 * a `translate scale` transform holding a pixelated `<img>` and an `<svg>` with a screen-1px
 * line), opens it at 25 %, zooms to 800 %, lets the view settle, takes a screenshot and reads
 * the pixel profile across the image's hard edge and across the line. A sharp render has a
 * transition at most a couple of pixels wide; a layer rasterised at 25 % and magnified 32x
 * has one many pixels wide.
 *
 * Variants: no hint (the baseline), the hint always on, and the hint only while the view is
 * moving (cleared after it settles). The always-on variant is what `ImageStage` would set
 * unconditionally; its outcome decides what `ImageStage` does.
 */

import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

const IMAGE = 16;
const SCALE_FROM = 0.25;
const SCALE_TO = 8;

type Variant = "none" | "always" | "moving";

/** An 8-bit grey PNG data URL: left half black, right half white, hard edge at x = 8. */
function edgeImage(): string {
  const canvas = document.createElement("canvas");
  canvas.width = IMAGE;
  canvas.height = IMAGE;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, IMAGE, IMAGE);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, IMAGE / 2, IMAGE);
  return canvas.toDataURL("image/png");
}

const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function decode(base64: string): Promise<{ width: number; height: number; data: Uint8ClampedArray }> {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0);
  const { data } = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  return { width: bitmap.width, height: bitmap.height, data };
}

/** Run one variant; returns the transition width across the image edge and across the line. */
async function measure(variant: Variant): Promise<{ edge: number; line: number }> {
  const viewport = document.createElement("div");
  viewport.style.cssText = "position:fixed;left:0;top:0;width:160px;height:160px;overflow:hidden;background:#808080";
  const stage = document.createElement("div");
  stage.dataset.stage = "";
  stage.style.cssText = `position:absolute;left:0;top:0;transform-origin:0 0;width:${IMAGE}px;height:${IMAGE}px`;
  if (variant === "always") stage.style.willChange = "transform";
  const img = document.createElement("img");
  img.src = edgeImage();
  img.style.cssText = `position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated`;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${IMAGE} ${IMAGE}`);
  svg.style.cssText = "position:absolute;inset:0;width:100%;height:100%;overflow:visible";
  // A red horizontal line one screen pixel thick at 800 %: 1/8 image px, centred on y = 4.5.
  const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
  line.setAttribute("d", "M0 4.5H16");
  line.setAttribute("stroke", "rgb(255,0,0)");
  line.setAttribute("stroke-width", String(1 / SCALE_TO));
  line.setAttribute("fill", "none");
  svg.append(line);
  stage.append(img, svg);
  viewport.append(stage);
  document.body.append(viewport);
  await img.decode();

  const set = (scale: number) => {
    // Image point (8, 4.5) lands at the viewport's centre (80, 80).
    stage.style.transform = `translate(${80 - 8 * scale}px, ${80 - 4.5 * scale}px) scale(${scale})`;
  };
  set(SCALE_FROM);
  await frame();
  await frame();
  await sleep(100);

  if (variant === "moving") stage.style.willChange = "transform";
  set(SCALE_TO);
  await frame();
  await frame();
  if (variant === "moving") {
    await sleep(200);
    stage.style.willChange = "";
  }
  await sleep(300);
  await frame();

  const shot = await page.screenshot({ element: viewport, save: false, base64: true });
  const { width, height, data } = await decode(typeof shot === "string" ? shot : (shot as { base64: string }).base64);
  viewport.remove();

  const at = (x: number, y: number, channel: number) => data[(y * width + x) * 4 + channel]!;
  // The image covers 128 x 128 screen pixels, its point (8, 4.5) at the viewport's centre:
  // columns [16, 144), rows [44, 172) of the 160 px viewport. Stay inside both.
  const insideX = (v: number) => v >= 20 && v < 140;
  const insideY = (v: number) => v >= 50 && v < 155;
  // Across the edge, along a row clear of the line: count pixels in the image that are neither
  // black nor white (the ramp a magnified low-resolution raster has), on the green channel.
  let edge = 0;
  for (let x = 0; x < width; x++) {
    const v = at(x, 120, 1);
    if (insideX(x) && v > 25 && v < 230) edge++;
  }
  // Across the line, down a column of the black half: count pixels that carry any red.
  let lineWidth = 0;
  for (let y = 0; y < height; y++) {
    if (insideY(y) && at(40, y, 0) > 12) lineWidth++;
  }
  return { edge, line: lineWidth };
}

describe("will-change: transform on the stage box", () => {
  it("measures the sharpness at 800 % after opening at 25 %", async () => {
    const results: Record<Variant, { edge: number; line: number }> = {
      none: await measure("none"),
      always: await measure("always"),
      moving: await measure("moving"),
    };
    // Recorded in the measurement note; printed so a run shows the evidence.
    console.info("will-change sharpness", JSON.stringify(results));
    // The baseline must be sharp, or the measure is meaningless.
    expect(results.none.edge).toBeLessThanOrEqual(2);
    expect(results.none.line).toBeLessThanOrEqual(3);
    // The settled-only variant must be as sharp as the baseline.
    expect(results.moving.edge).toBeLessThanOrEqual(results.none.edge + 1);
    expect(results.moving.line).toBeLessThanOrEqual(results.none.line + 1);
  });
});
