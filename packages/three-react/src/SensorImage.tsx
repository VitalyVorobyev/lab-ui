import { type CanonicalPinhole, type FrameTreeRuntime, type RemapTable, SensorView } from "@vitavision/three";
import { useEffect, useRef } from "react";
import { WebGLRenderer } from "three";

import { useSceneColors } from "./colors";
import type { PlayheadSource } from "./FrameTree";

/** Props of {@link SensorImage}. */
export interface SensorImageProps {
  /** The runtime of the scene's `FrameTree` (its `onRuntime`). */
  runtime: FrameTreeRuntime;
  /** The camera's frame name (a CV camera frame). */
  frame: string;
  /** The camera's canonical pinhole. */
  canonical: CanonicalPinhole;
  /** The camera's remap LUT; the canvas is `lut.width × lut.height` pixels. */
  lut: RemapTable;
  /** Which sample to show, read every animation frame. */
  playhead: PlayheadSource;
  /** Class of the canvas (size it with CSS; its pixel size is the LUT's). */
  className?: string;
  /** Accessible name. */
  label?: string;
}

/**
 * A calibrated camera's image of the scene in the enclosing `FrameTree`: a
 * `SensorView` (`@vitavision/three`) on a canvas of its own, rendered from the same objects (physical layer
 * only) at the playhead. Redraws when the playhead moves, and a few times a second otherwise
 * so late-loading meshes and theme changes appear.
 */
export function SensorImage({ runtime, frame, canonical, lut, playhead, className, label }: SensorImageProps) {
  const hostRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const colors = useSceneColors();
  const background = colors.canvas;
  const name = label ?? `${frame} sensor image`;
  // Read by the render loop, so a new playhead object, a theme change or a new-but-equal
  // `canonical` never rebuilds the renderer (which recompiles and re-uploads the whole scene).
  const playheadRef = useRef(playhead);
  const backgroundRef = useRef(background);
  const attributesRef = useRef({ className, name });
  const repaintRef = useRef<(() => void) | null>(null);
  const canonicalKey = JSON.stringify([canonical.width, canonical.height, canonical.focalPx]);

  useEffect(() => {
    playheadRef.current = playhead;
  }, [playhead]);

  useEffect(() => {
    backgroundRef.current = background;
    repaintRef.current?.();
  }, [background]);

  useEffect(() => {
    attributesRef.current = { className, name };
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.className = className ?? "";
    canvas.setAttribute("aria-label", name);
  }, [className, name]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    // A canvas of this effect's own, so cleanup can release its GL context with
    // `forceContextLoss()`: `renderer.dispose()` alone leaves the scene's buffers and textures
    // on the GPU, and a new renderer on a reused canvas would share (and keep) that context.
    const canvas = document.createElement("canvas");
    canvas.width = lut.width;
    canvas.height = lut.height;
    canvas.setAttribute("role", "img");
    canvas.className = attributesRef.current.className ?? "";
    canvas.setAttribute("aria-label", attributesRef.current.name);
    host.append(canvas);
    canvasRef.current = canvas;

    const [width, height, focalPx] = JSON.parse(canonicalKey) as [number, number, number];
    const renderer = new WebGLRenderer({ canvas, antialias: false });
    renderer.setPixelRatio(1);
    renderer.setSize(lut.width, lut.height, false);
    const view = new SensorView({ canonical: { width, height, focalPx }, lut });
    let raf = 0;
    let last = -1;
    let lastAt = 0;
    repaintRef.current = () => {
      renderer.setClearColor(backgroundRef.current);
      view.setBackground(backgroundRef.current);
      last = -1;
    };
    repaintRef.current();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const k = playheadRef.current.get();
      if (k === last && now - lastAt < 250) return;
      last = k;
      lastAt = now;
      runtime.apply(k);
      const scene = runtime.root.parent ?? runtime.root;
      scene.updateMatrixWorld();
      const camera = runtime.frame(frame);
      if (camera) view.render(renderer, scene, camera.matrixWorld);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      repaintRef.current = null;
      canvasRef.current = null;
      view.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    };
  }, [runtime, frame, canonicalKey, lut]);

  // `display: contents` keeps the layout the canvas's own, as if it were rendered here.
  return <span ref={hostRef} style={{ display: "contents" }} />;
}
