/**
 * The in-page harness. `?candidate=<id>` picks the engine; the result lands on
 * `window.__bench` for `run.ts` (or a person with DevTools) to read.
 *
 * Timing: the view is a pure function of elapsed time (`workload.ts`), so a slow engine
 * skips ahead rather than slowing the script down. Per frame it records
 *   - the rAF-to-rAF interval (what a user perceives; p95 is gate G6.1's frame time),
 *   - the synchronous render work inside the frame,
 *   - one hit-test at the scripted pointer position (gate G6.1's hit-test time).
 */

import "./styles.css";

import { canvas2d } from "./candidates/canvas2d";
import { konva } from "./candidates/konva";
import { svg } from "./candidates/svg";
import type { Candidate } from "./candidates/types";
import { IMAGE, imageUrl, makeImage, makeScene } from "./scene";
import { DURATION_MS, percentile, pointerAt, viewAt, type Box } from "./workload";

const CANDIDATES: Record<string, () => Candidate> = {
  a: () => svg({ perElement: true }),
  "a-batched": () => svg({ perElement: false }),
  b: () => konva({ cache: true }),
  "b-nocache": () => konva({ cache: false }),
  c: () => canvas2d(),
};

export interface Stats {
  p50: number;
  p95: number;
  p99: number;
  max: number;
}

export interface BenchResult {
  candidate: string;
  label: string;
  hitTest: string;
  frames: number;
  frame: Stats;
  work: Stats;
  hit: Stats;
  /** Frames whose interval exceeded 16.7 ms. */
  over16: number;
  mountMs: number;
  heapMB: number | null;
  devicePixelRatio: number;
  viewport: Box;
}

declare global {
  interface Window {
    __bench?: BenchResult | { error: string };
  }
}

function stats(values: number[]): Stats {
  const sorted = [...values].sort((a, b) => a - b);
  const round = (v: number) => Math.round(v * 100) / 100;
  return {
    p50: round(percentile(sorted, 50)),
    p95: round(percentile(sorted, 95)),
    p99: round(percentile(sorted, 99)),
    max: round(sorted[sorted.length - 1] ?? NaN),
  };
}

function nextFrame(): Promise<number> {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

async function run(id: string): Promise<BenchResult> {
  const factory = CANDIDATES[id];
  if (!factory) throw new Error(`unknown candidate "${id}" (have: ${Object.keys(CANDIDATES).join(", ")})`);
  const host = document.getElementById("host")!;
  const box = { width: host.clientWidth, height: host.clientHeight };
  const scene = makeScene();
  const bitmap = await makeImage();
  const url = await imageUrl(bitmap);
  const candidate = factory();

  const t0 = performance.now();
  await candidate.mount(host, box, scene, { bitmap, url });
  candidate.setView(viewAt(0, box, IMAGE));
  await nextFrame();
  const mountMs = performance.now() - t0;

  // Warm-up: one second of the workload, discarded (JIT, texture uploads, caches).
  const warm = performance.now();
  for (let now = await nextFrame(); now - warm < 1000; now = await nextFrame()) {
    candidate.setView(viewAt((now - warm) * 4, box, IMAGE));
  }

  const frames: number[] = [];
  const work: number[] = [];
  const hits: number[] = [];
  const start = await nextFrame();
  performance.mark("bench:start");
  let last = start;
  for (;;) {
    const now = await nextFrame();
    const t = now - start;
    if (t > DURATION_MS) break;
    frames.push(now - last);
    last = now;
    const view = viewAt(t, box, IMAGE);
    const w0 = performance.now();
    candidate.setView(view);
    const w1 = performance.now();
    candidate.hit(pointerAt(t, box), view);
    const w2 = performance.now();
    work.push(w1 - w0);
    hits.push(w2 - w1);
  }
  performance.mark("bench:end");

  const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
  return {
    candidate: id,
    label: candidate.label,
    hitTest: candidate.hitTest,
    frames: frames.length,
    frame: stats(frames),
    work: stats(work),
    hit: stats(hits),
    over16: frames.filter((f) => f > 16.7).length,
    mountMs: Math.round(mountMs),
    heapMB: memory ? Math.round(memory.usedJSHeapSize / 1e6) : null,
    devicePixelRatio: window.devicePixelRatio,
    viewport: box,
  };
}

const id = new URLSearchParams(location.search).get("candidate") ?? "c";
run(id).then(
  (result) => {
    window.__bench = result;
    console.log(JSON.stringify(result));
  },
  (error: unknown) => {
    window.__bench = { error: String(error instanceof Error ? error.stack : error) };
    console.error(error);
  },
);
