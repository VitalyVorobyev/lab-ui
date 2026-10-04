import { type CanonicalPinhole, type FrameTreeRuntime, type RemapTable, SensorView } from "@vitavision/three";
import { useEffect, useRef } from "react";
import { WebGLRenderer } from "three";

import { useSceneColors } from "./colors";
import type { PlayheadSource } from "./FrameTree";
import { onSceneInvalidate } from "./sceneSignal";

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
  /** Which sample to show, read every animation frame while the image is visible. */
  playhead: PlayheadSource;
  /** Class of the canvas (size it with CSS; its pixel size is the LUT's). */
  className?: string;
  /** Accessible name. */
  label?: string;
}

/**
 * A calibrated camera's image of the scene in the enclosing `FrameTree`: a
 * `SensorView` (`@vitavision/three`) on a canvas of its own, rendered from the same objects (physical layer
 * only) at the playhead.
 *
 * It redraws only when something changed: the playhead's sample, the theme, an
 * {@link invalidateScene} of `runtime` (`Robot` and `TargetBoard` send one when they change the
 * scene; call it yourself after changing the scene outside React), or the image coming back
 * into view. While it is scrolled out of view or its tab is hidden it does no work at all.
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

  // Any theme change (not only the background's) may recolour what the image shows.
  useEffect(() => {
    backgroundRef.current = background;
    repaintRef.current?.();
  }, [background, colors]);

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

    // The loop runs only while the image is visible, polling the playhead (a cheap read) every
    // frame and rendering only when it moved or something marked the image dirty.
    let raf = 0;
    let last = Number.NaN;
    let dirty = true;
    let inView = true;
    const visible = () => inView && document.visibilityState !== "hidden";
    const tick = () => {
      raf = 0;
      if (!visible()) return;
      raf = requestAnimationFrame(tick);
      const k = playheadRef.current.get();
      if (!dirty && k === last) return;
      dirty = false;
      last = k;
      runtime.apply(k);
      const scene = runtime.root.parent ?? runtime.root;
      scene.updateMatrixWorld();
      const camera = runtime.frame(frame);
      if (camera) view.render(renderer, scene, camera.matrixWorld);
    };
    const wake = () => {
      dirty = true;
      if (raf === 0 && visible()) raf = requestAnimationFrame(tick);
    };
    repaintRef.current = () => {
      renderer.setClearColor(backgroundRef.current);
      view.setBackground(backgroundRef.current);
      wake();
    };
    repaintRef.current();

    const stopInvalidate = onSceneInvalidate(runtime, wake);
    const onVisibility = () => {
      if (visible()) wake();
    };
    document.addEventListener("visibilitychange", onVisibility);
    // Without IntersectionObserver the image counts as always in view.
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver((entries) => {
            const was = inView;
            inView = entries.at(-1)?.isIntersecting ?? inView;
            if (inView && !was) wake();
          });
    observer?.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      stopInvalidate();
      document.removeEventListener("visibilitychange", onVisibility);
      observer?.disconnect();
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
