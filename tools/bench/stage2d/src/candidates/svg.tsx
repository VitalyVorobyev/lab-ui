/**
 * (a) lab-ui `ImageStage`: the photograph as a DOM `<img>` and the overlay as an
 * `<svg viewBox="0 0 W H">`, both inside the one CSS-transformed stage element — the
 * library's current engine, from the `@vitavision/stage2d` workspace package.
 *
 * Screen-constant geometry via `vector-effect: non-scaling-stroke`, so the overlay does not
 * re-render when the view changes; point markers are zero-length paths with round caps.
 * Two layouts, because they fail differently:
 *
 *   - `perElement`: one SVG element per feature, hit-tested natively by the browser
 *     (`document.elementFromPoint`) — how `MeasureOverlay` is written today;
 *   - batched: one `<path>` per layer, hit-tested with the shared grid index — the best
 *     this engine can do.
 */

import { memo, useState } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";

import { ImageStage } from "@vitavision/stage2d";
import { buildGrid, nearest, type GridIndex } from "../grid";
import { IMAGE, MARKER_DIAMETER_PX, STROKE_PX, type Scene } from "../scene";
import { toImage, type Box, type View } from "../workload";
import type { Assets, Candidate } from "./types";

const STROKE = { vectorEffect: "non-scaling-stroke" } as const;

const Overlay = memo(function Overlay({ scene, perElement }: { scene: Scene; perElement: boolean }) {
  const lines = scene.polylines.map((line) => {
    let d = `M${line[0]} ${line[1]}`;
    for (let i = 2; i < line.length; i += 2) d += `L${line[i]} ${line[i + 1]}`;
    return d;
  });
  const p = scene.points;
  return (
    <svg
      viewBox={`0 0 ${IMAGE.width} ${IMAGE.height}`}
      className="absolute inset-0 h-full w-full"
      style={{ overflow: "visible" }}
    >
      <g fill="none" stroke="#4cc9f0" strokeWidth={STROKE_PX} strokeLinejoin="round" style={STROKE}>
        {perElement ? lines.map((d, i) => <path key={i} d={d} style={STROKE} />) : <path d={lines.join("")} style={STROKE} />}
      </g>
      <g fill="none" stroke="#f5a524" strokeWidth={MARKER_DIAMETER_PX} strokeLinecap="round">
        {perElement ? (
          Array.from({ length: p.length / 2 }, (_, i) => (
            <path key={i} data-i={i} d={`M${p[2 * i]} ${p[2 * i + 1]}h0`} style={STROKE} />
          ))
        ) : (
          <path d={Array.from({ length: p.length / 2 }, (_, i) => `M${p[2 * i]} ${p[2 * i + 1]}h0`).join("")} style={STROKE} />
        )}
      </g>
    </svg>
  );
});

export function svg(options: { perElement: boolean }): Candidate {
  let root: Root;
  let host: HTMLElement;
  let setView: (view: View) => void = () => {};
  let grid: GridIndex;

  function Harness({ scene, url, initial }: { scene: Scene; url: string; initial: View }) {
    const [view, set] = useState<View>(initial);
    setView = set;
    return (
      <ImageStage image={IMAGE} view={view} onView={() => {}} shortcuts={false} className="h-full w-full">
        <img src={url} alt="" className="absolute inset-0 h-full w-full" style={{ imageRendering: "pixelated" }} draggable={false} />
        <Overlay scene={scene} perElement={options.perElement} />
      </ImageStage>
    );
  }

  return {
    label: options.perElement
      ? "(a) lab-ui ImageStage: DOM img + SVG, element per feature"
      : "(a′) lab-ui ImageStage: DOM img + SVG, one path per layer",
    hitTest: options.perElement ? "native DOM (document.elementFromPoint)" : "uniform grid (64 px cells)",
    async mount(target, box: Box, scene: Scene, assets: Assets) {
      host = target;
      grid = buildGrid(scene.points, IMAGE.width, IMAGE.height);
      const container = document.createElement("div");
      container.style.cssText = `width:${box.width}px;height:${box.height}px;position:relative`;
      target.appendChild(container);
      root = createRoot(container);
      const initial = { scale: Math.min(box.width / IMAGE.width, box.height / IMAGE.height), tx: 0, ty: 0 };
      flushSync(() => root.render(<Harness scene={scene} url={assets.url} initial={initial} />));
      const img = container.querySelector("img")!;
      await img.decode();
    },
    setView(view: View) {
      flushSync(() => setView(view));
    },
    hit(p, view) {
      if (options.perElement) {
        const rect = host.getBoundingClientRect();
        const element = document.elementFromPoint(rect.left + p.x, rect.top + p.y);
        const index = element?.getAttribute("data-i");
        return index == null ? -1 : Number(index);
      }
      const q = toImage(view, p);
      return nearest(grid, q.x, q.y, (MARKER_DIAMETER_PX / 2 + 2) / view.scale);
    },
    destroy() {
      root.unmount();
    },
  };
}
