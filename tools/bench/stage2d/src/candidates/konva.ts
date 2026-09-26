/**
 * (b) Konva, built the way the Konva apps here build it (vitavision `FeatureLayer`, VAL
 * `AnnotationCanvas`): one node per feature, the stage's scale/position as the view, and
 * marker radii re-set on zoom to stay screen-constant. Plus the layer caching PLAN L0-3
 * asks for: while the scale holds still (a pure pan), the overlay layer is drawn from a
 * cached bitmap; a scale change drops the cache and redraws.
 *
 * Imperative `konva` rather than `react-konva`: the scene graph and draw path are the same,
 * and this keeps React reconciliation (measured by candidate a) out of Konva's number.
 */

import Konva from "konva";

import { IMAGE, MARKER_DIAMETER_PX, STROKE_PX, type Scene } from "../scene";
import type { Box, View } from "../workload";
import type { Assets, Candidate } from "./types";

export function konva(options: { cache: boolean }): Candidate {
  let stage: Konva.Stage;
  let overlay: Konva.Layer;
  let circles: Konva.Circle[] = [];
  let lastScale = NaN;
  let cached = false;

  return {
    label: options.cache ? "(b) Konva, node per feature, overlay layer cached while panning" : "(b′) Konva, node per feature, no caching",
    hitTest: "Konva hit canvas (stage.getIntersection)",
    async mount(host, box: Box, scene: Scene, assets: Assets) {
      const container = document.createElement("div");
      host.appendChild(container);
      stage = new Konva.Stage({ container, width: box.width, height: box.height });

      const background = new Konva.Layer({ listening: false, imageSmoothingEnabled: false });
      background.add(new Konva.Image({ image: assets.bitmap, x: 0, y: 0, width: IMAGE.width, height: IMAGE.height }));
      stage.add(background);

      overlay = new Konva.Layer();
      for (const line of scene.polylines) {
        overlay.add(
          new Konva.Line({
            points: Array.from(line),
            stroke: "#4cc9f0",
            strokeWidth: STROKE_PX,
            strokeScaleEnabled: false,
            lineJoin: "round",
            perfectDrawEnabled: false,
            listening: true,
          }),
        );
      }
      const p = scene.points;
      circles = [];
      for (let i = 0; i < p.length; i += 2) {
        const circle = new Konva.Circle({
          x: p[i]!,
          y: p[i + 1]!,
          radius: MARKER_DIAMETER_PX / 2,
          fill: "#f5a524",
          perfectDrawEnabled: false,
          shadowForStrokeEnabled: false,
          id: String(i / 2),
        });
        circles.push(circle);
        overlay.add(circle);
      }
      stage.add(overlay);
    },
    setView(view: View) {
      stage.scale({ x: view.scale, y: view.scale });
      stage.position({ x: view.tx, y: view.ty });
      if (view.scale !== lastScale) {
        if (cached) {
          overlay.clearCache();
          cached = false;
        }
        const r = MARKER_DIAMETER_PX / 2 / view.scale;
        for (const c of circles) c.radius(r);
        lastScale = view.scale;
      } else if (options.cache && !cached) {
        overlay.cache({ pixelRatio: view.scale * (window.devicePixelRatio || 1) });
        cached = true;
      }
      stage.draw();
    },
    hit(p) {
      const shape = stage.getIntersection(p);
      if (!shape || !(shape instanceof Konva.Circle)) return -1;
      return Number(shape.id());
    },
    destroy() {
      stage.destroy();
    },
  };
}
