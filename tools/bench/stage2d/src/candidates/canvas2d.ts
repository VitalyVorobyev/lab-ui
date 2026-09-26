/**
 * (c) Batched Canvas2D: one canvas, the image drawn under the view's transform, every
 * overlay layer a single pre-built `Path2D` stroked once per frame.
 *
 * Screen-constant geometry without per-frame JS over the features: point markers are
 * zero-length subpaths stroked with round caps (which the Canvas spec draws as discs), and
 * the line width is divided by the scale, so a zoom changes one number, not 20,000.
 */

import { buildGrid, nearest, type GridIndex } from "../grid";
import { IMAGE, MARKER_DIAMETER_PX, STROKE_PX, type Scene } from "../scene";
import { toImage, type Box, type View } from "../workload";
import type { Assets, Candidate } from "./types";

export function canvas2d(): Candidate {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let bitmap: ImageBitmap;
  let points: Path2D;
  let lines: Path2D;
  let grid: GridIndex;
  let dpr = 1;
  let size: Box;

  return {
    label: "(c) Canvas2D, batched Path2D layers",
    hitTest: "uniform grid (64 px cells)",
    async mount(host, box, scene: Scene, assets: Assets) {
      dpr = window.devicePixelRatio || 1;
      size = box;
      canvas = document.createElement("canvas");
      canvas.width = Math.round(box.width * dpr);
      canvas.height = Math.round(box.height * dpr);
      canvas.style.cssText = `width:${box.width}px;height:${box.height}px;display:block`;
      host.appendChild(canvas);
      ctx = canvas.getContext("2d", { alpha: false })!;
      bitmap = assets.bitmap;

      points = new Path2D();
      const p = scene.points;
      for (let i = 0; i < p.length; i += 2) {
        points.moveTo(p[i]!, p[i + 1]!);
        points.lineTo(p[i]!, p[i + 1]!);
      }
      lines = new Path2D();
      for (const line of scene.polylines) {
        lines.moveTo(line[0]!, line[1]!);
        for (let i = 2; i < line.length; i += 2) lines.lineTo(line[i]!, line[i + 1]!);
      }
      grid = buildGrid(scene.points, IMAGE.width, IMAGE.height);
    },
    setView(view: View) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const k = dpr * view.scale;
      ctx.setTransform(k, 0, 0, k, dpr * view.tx, dpr * view.ty);
      // Past 1:1 an inspection viewer shows pixels, not a blur between them.
      ctx.imageSmoothingEnabled = view.scale < 1;
      ctx.drawImage(bitmap, 0, 0);

      ctx.lineJoin = "round";
      ctx.lineWidth = STROKE_PX / view.scale;
      ctx.strokeStyle = "#4cc9f0";
      ctx.stroke(lines);

      ctx.lineCap = "round";
      ctx.lineWidth = MARKER_DIAMETER_PX / view.scale;
      ctx.strokeStyle = "#f5a524";
      ctx.stroke(points);
      ctx.lineCap = "butt";
    },
    hit(p, view) {
      if (p.x < 0 || p.y < 0 || p.x > size.width || p.y > size.height) return -1;
      const q = toImage(view, p);
      return nearest(grid, q.x, q.y, (MARKER_DIAMETER_PX / 2 + 2) / view.scale);
    },
    destroy() {
      canvas.remove();
    },
  };
}
