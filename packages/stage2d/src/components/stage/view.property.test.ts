/**
 * Property tests for the view transform (PLAN §4.3): the laws every view must obey, checked
 * over a few hundred seeded-random views, viewports and images rather than a handful of
 * hand-picked ones. The generator is seeded, so a failure reproduces exactly.
 */

import { describe, expect, it } from "vitest";

import {
  MAX_SCALE,
  clampView,
  fitScale,
  fitView,
  frameRect,
  initialView,
  insideImage,
  isFit,
  preserveCenter,
  scaleRange,
  steppedScale,
  toImage,
  toScreen,
  zoomAbout,
  type Box,
  type StageView,
} from "./view";

/** mulberry32: a small, fast, seedable PRNG — deterministic runs without a dependency. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const RUNS = 500;

function generators(seed: number) {
  const random = prng(seed);
  const between = (low: number, high: number) => low + (high - low) * random();
  /** Log-uniform, so 3% and 3000% are equally likely. */
  const logBetween = (low: number, high: number) => Math.exp(between(Math.log(low), Math.log(high)));
  const box = (): Box => ({ width: Math.round(between(80, 2400)), height: Math.round(between(60, 1600)) });
  const image = (): Box => ({ width: Math.round(between(16, 8192)), height: Math.round(between(16, 8192)) });
  const view = (): StageView => ({
    scale: logBetween(0.01, MAX_SCALE),
    tx: between(-20_000, 20_000),
    ty: between(-20_000, 20_000),
  });
  const point = () => ({ x: between(-3000, 3000), y: between(-3000, 3000) });
  return { random, between, logBetween, box, image, view, point };
}

/** Relative closeness, for values whose magnitude spans several decades. */
function expectNear(actual: number, expected: number, relative = 1e-9) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(relative * Math.max(1, Math.abs(expected)));
}

function expectSameView(actual: StageView, expected: StageView, relative = 1e-9) {
  expectNear(actual.scale, expected.scale, relative);
  expectNear(actual.tx, expected.tx, relative);
  expectNear(actual.ty, expected.ty, relative);
}

describe("view transform properties", () => {
  it("toImage ∘ toScreen and toScreen ∘ toImage are the identity", () => {
    const g = generators(1);
    for (let run = 0; run < RUNS; run += 1) {
      const view = g.view();
      const p = g.point();
      const back = toImage(view, toScreen(view, p));
      expectNear(back.x, p.x);
      expectNear(back.y, p.y);
      const forth = toScreen(view, toImage(view, p));
      expectNear(forth.x, p.x);
      expectNear(forth.y, p.y);
    }
  });

  it("toScreen is affine: image distances scale by exactly `scale`", () => {
    const g = generators(2);
    for (let run = 0; run < RUNS; run += 1) {
      const view = g.view();
      const a = g.point();
      const b = g.point();
      const sa = toScreen(view, a);
      const sb = toScreen(view, b);
      expectNear(Math.hypot(sb.x - sa.x, sb.y - sa.y), Math.hypot(b.x - a.x, b.y - a.y) * view.scale, 1e-7);
    }
  });

  it("zoomAbout keeps the image point under the anchor fixed", () => {
    const g = generators(3);
    for (let run = 0; run < RUNS; run += 1) {
      const view = g.view();
      const anchor = g.point();
      const scale = g.logBetween(0.01, MAX_SCALE);
      const before = toImage(view, anchor);
      const zoomed = zoomAbout(view, scale, anchor);
      expect(zoomed.scale).toBe(scale);
      const after = toImage(zoomed, anchor);
      expectNear(after.x, before.x, 1e-7);
      expectNear(after.y, before.y, 1e-7);
    }
  });

  it("zooming there and back about the same anchor is the identity", () => {
    const g = generators(4);
    for (let run = 0; run < RUNS; run += 1) {
      const view = g.view();
      const anchor = g.point();
      const there = zoomAbout(view, g.logBetween(0.01, MAX_SCALE), anchor);
      expectSameView(zoomAbout(there, view.scale, anchor), view, 1e-7);
    }
  });

  it("zoomAbout leaves the view alone for a non-positive scale", () => {
    const g = generators(5);
    for (let run = 0; run < 50; run += 1) {
      const view = g.view();
      expect(zoomAbout(view, -g.random(), g.point())).toBe(view);
      expect(zoomAbout(view, 0, g.point())).toBe(view);
    }
  });

  it("clampView is idempotent", () => {
    const g = generators(6);
    for (let run = 0; run < RUNS; run += 1) {
      const box = g.box();
      const image = g.image();
      const once = clampView(g.view(), box, image);
      expectSameView(clampView(once, box, image), once);
    }
  });

  it("clampView lands inside the scale range and keeps the image on screen", () => {
    const g = generators(7);
    for (let run = 0; run < RUNS; run += 1) {
      const box = g.box();
      const image = g.image();
      const view = clampView(g.view(), box, image);
      const [min, max] = scaleRange(box, image);
      expect(view.scale).toBeGreaterThanOrEqual(min);
      expect(view.scale).toBeLessThanOrEqual(max);

      for (const [t, boxLength, imageLength] of [
        [view.tx, box.width, image.width * view.scale],
        [view.ty, box.height, image.height * view.scale],
      ] as const) {
        if (imageLength <= boxLength) {
          // Under-filled: centred.
          expectNear(t, (boxLength - imageLength) / 2);
        } else {
          // Over-filled: the viewport stays covered.
          expect(t).toBeLessThanOrEqual(1e-9);
          expect(t + imageLength).toBeGreaterThanOrEqual(boxLength - 1e-6);
        }
      }
    }
  });

  it("a legal view is a fixed point of clampView", () => {
    const g = generators(8);
    for (let run = 0; run < RUNS; run += 1) {
      const box = g.box();
      const image = g.image();
      for (const view of [fitView(box, image), initialView(box, image)]) {
        expectSameView(clampView(view, box, image), view);
      }
    }
  });

  it("fitView shows the whole image, touching the box on the constrained axis, and is fit", () => {
    const g = generators(9);
    for (let run = 0; run < RUNS; run += 1) {
      const box = g.box();
      const image = g.image();
      const view = fitView(box, image);
      expect(isFit(view, box, image)).toBe(true);
      const width = image.width * view.scale;
      const height = image.height * view.scale;
      expect(width).toBeLessThanOrEqual(box.width + 1e-6);
      expect(height).toBeLessThanOrEqual(box.height + 1e-6);
      expect(Math.max(width / box.width, height / box.height)).toBeCloseTo(1, 9);
      expect(view.scale).toBe(fitScale(box, image));
    }
  });

  it("initialView never magnifies past 1:1 and never exceeds fit", () => {
    const g = generators(10);
    for (let run = 0; run < RUNS; run += 1) {
      const box = g.box();
      const image = g.image();
      const view = initialView(box, image);
      expect(view.scale).toBeLessThanOrEqual(1);
      expect(view.scale).toBeLessThanOrEqual(fitScale(box, image) + 1e-12);
    }
  });

  it("preserveCenter returns a legal view, and re-fits a fit one", () => {
    const g = generators(11);
    for (let run = 0; run < RUNS; run += 1) {
      const from = g.box();
      const to = g.box();
      const image = g.image();
      const moved = preserveCenter(clampView(g.view(), from, image), from, to, image);
      expectSameView(clampView(moved, to, image), moved, 1e-7);
      expect(isFit(preserveCenter(fitView(from, image), from, to, image), to, image)).toBe(true);
    }
  });

  it("preserveCenter keeps the centred image point centred when nothing needs clamping", () => {
    const g = generators(12);
    let checked = 0;
    for (let run = 0; run < RUNS; run += 1) {
      const image = g.image();
      const from = g.box();
      const to = g.box();
      // Zoomed in far enough that the image overflows both viewports four times over,
      // centred on a point near its middle, so the clamp has nothing to do.
      const scale =
        4 * Math.max(from.width / image.width, from.height / image.height, to.width / image.width, to.height / image.height);
      if (scale > MAX_SCALE) continue;
      const centre = { x: image.width * g.between(0.45, 0.55), y: image.height * g.between(0.45, 0.55) };
      const offset = toScreen({ scale, tx: 0, ty: 0 }, centre);
      const view = { scale, tx: from.width / 2 - offset.x, ty: from.height / 2 - offset.y };
      expectSameView(clampView(view, from, image), view);
      const moved = preserveCenter(view, from, to, image);
      const after = toImage(moved, { x: to.width / 2, y: to.height / 2 });
      expectNear(after.x, centre.x, 1e-7);
      expectNear(after.y, centre.y, 1e-7);
      checked += 1;
    }
    // Most draws are admissible; a generator change that skipped them all would pass vacuously.
    expect(checked).toBeGreaterThan(RUNS / 4);
  });

  it("frameRect returns a legal view no deeper than MAX_SCALE", () => {
    const g = generators(13);
    for (let run = 0; run < RUNS; run += 1) {
      const box = g.box();
      const image = g.image();
      const x = g.between(0, image.width);
      const y = g.between(0, image.height);
      const rect = { x, y, width: g.between(0, image.width - x), height: g.between(0, image.height - y) };
      const view = frameRect(box, image, rect, g.between(0, 0.5));
      expect(view.scale).toBeLessThanOrEqual(MAX_SCALE);
      expectSameView(clampView(view, box, image, { maxScale: MAX_SCALE }), view, 1e-7);
    }
  });

  it("steppedScale moves in the asked direction and stays in range", () => {
    const g = generators(14);
    for (let run = 0; run < RUNS; run += 1) {
      const min = g.logBetween(0.001, 2);
      const max = Math.max(min, g.logBetween(0.5, 64));
      const scale = g.between(min, max);
      const up = steppedScale(scale, 1, min, max);
      const down = steppedScale(scale, -1, min, max);
      expect(up).toBeGreaterThanOrEqual(Math.min(scale, max) - 1e-12);
      expect(down).toBeLessThanOrEqual(Math.max(scale, min) + 1e-12);
      for (const s of [up, down]) {
        expect(s).toBeGreaterThanOrEqual(min - 1e-9);
        expect(s).toBeLessThanOrEqual(max + 1e-9);
      }
    }
  });

  it("insideImage agrees with where toScreen puts the image's edges", () => {
    const g = generators(15);
    for (let run = 0; run < RUNS; run += 1) {
      const image = g.image();
      const view = g.view();
      const p = { x: g.between(-0.2, 1.2) * image.width, y: g.between(-0.2, 1.2) * image.height };
      const screen = toScreen(view, p);
      const topLeft = toScreen(view, { x: -0.5, y: -0.5 });
      const bottomRight = toScreen(view, { x: image.width - 0.5, y: image.height - 0.5 });
      const onScreenInside =
        screen.x >= topLeft.x && screen.y >= topLeft.y && screen.x < bottomRight.x && screen.y < bottomRight.y;
      // Skip points within rounding distance of an edge, where either answer is right.
      const nearEdge =
        Math.min(
          Math.abs(p.x + 0.5),
          Math.abs(p.y + 0.5),
          Math.abs(p.x - image.width + 0.5),
          Math.abs(p.y - image.height + 0.5),
        ) < 1e-6;
      if (!nearEdge) expect(insideImage(p, image)).toBe(onScreenInside);
    }
  });
});
