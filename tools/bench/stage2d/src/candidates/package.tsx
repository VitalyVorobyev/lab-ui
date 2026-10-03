/**
 * (p) The package's own layers: `ImageStage` with `PolylineSet` and `PointSet`, and
 * hit-testing through `useStageHitTest` (both layers answer, ranked). This is the L6-2 gate
 * re-measurement: candidate (a′) with its hand-built overlay replaced by what the package
 * ships.
 *
 * Differences from (a′) that are the package's, not the bench's: markers are the overlay
 * grammar's dot (r 2.5 px, not 3), every mark has a halo (a second path under each batch),
 * and the polylines are `PolylineSet`'s hit path and hover/selection machinery.
 *
 * `kind: "plus"` draws the corner glyph instead: an outline sized in screen pixels, so the
 * path is regenerated at every zoom step (and culled to the viewport), unlike the dot.
 */

import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { useState } from "react";

import {
  ImageStage,
  PointSet,
  PolylineSet,
  useStageHitTest,
  type PointSetItem,
  type PolylineSetItem,
  type StageHitTestApi,
} from "@vitavision/stage2d";
import { IMAGE, MARKER_DIAMETER_PX, type Scene } from "../scene";
import { toImage, type Box, type View } from "../workload";
import type { Assets, Candidate } from "./types";

export function packageLayers(options: { kind: "dot" | "plus" } = { kind: "dot" }): Candidate {
  let root: Root;
  let setView: (view: View) => void = () => {};
  let api: StageHitTestApi | null = null;

  /** Hands the hit-test of the enclosing stage out to the harness, refreshed on every render. */
  function Probe() {
    api = useStageHitTest();
    return null;
  }

  function Harness({
    points,
    lines,
    url,
    initial,
  }: {
    points: PointSetItem[];
    lines: PolylineSetItem[];
    url: string;
    initial: View;
  }) {
    const [view, set] = useState<View>(initial);
    setView = set;
    return (
      <ImageStage image={IMAGE} view={view} onView={() => {}} shortcuts={false} className="h-full w-full">
        <img src={url} alt="" className="absolute inset-0 h-full w-full" style={{ imageRendering: "pixelated" }} draggable={false} />
        <PolylineSet items={lines} layerId="lines" />
        <PointSet items={points} kind={options.kind} layerId="points" />
        <Probe />
      </ImageStage>
    );
  }

  return {
    label:
      options.kind === "dot"
        ? "(p) @vitavision/stage2d layers: PointSet (dot) + PolylineSet, useStageHitTest"
        : "(p+) @vitavision/stage2d layers: PointSet (plus, regenerated per zoom) + PolylineSet",
    hitTest: "stage hit registry: point grid + segment grid, ranked across layers",
    async mount(target, box: Box, scene: Scene, assets: Assets) {
      const container = document.createElement("div");
      container.style.cssText = `width:${box.width}px;height:${box.height}px;position:relative`;
      target.appendChild(container);
      root = createRoot(container);
      const points: PointSetItem[] = Array.from({ length: scene.points.length / 2 }, (_, i) => ({
        id: i,
        x: scene.points[2 * i]!,
        y: scene.points[2 * i + 1]!,
      }));
      const lines: PolylineSetItem[] = scene.polylines.map((line, i) => ({ id: i, points: line }));
      const initial = { scale: Math.min(box.width / IMAGE.width, box.height / IMAGE.height), tx: 0, ty: 0 };
      flushSync(() => root.render(<Harness points={points} lines={lines} url={assets.url} initial={initial} />));
      const img = container.querySelector("img")!;
      await img.decode();
    },
    setView(view: View) {
      flushSync(() => setView(view));
    },
    hit(p, view) {
      const q = toImage(view, p);
      const hit = api?.hitTest(q, MARKER_DIAMETER_PX / 2 + 2);
      return hit && hit.layerId === "points" ? Number(hit.id) : -1;
    },
    destroy() {
      root.unmount();
    },
  };
}
