/**
 * Property tests for the rotated-shape editing arithmetic, over seeded-random shapes and
 * pointers, so a failure reproduces exactly.
 */

import { describe, expect, it } from "vitest";

import { ROI_HANDLES, type RoiHandle } from "./roiEdit";
import {
  fromShapeFrame,
  moveShape,
  resizeShape,
  rotateShape,
  rotationHandlePoint,
  shapeCorner,
  shapeFromCorner,
  shapeHandlePoint,
  toShapeFrame,
  type RotatedShape,
} from "./shapeEdit";

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

const OPPOSITE: Record<RoiHandle, RoiHandle> = { nw: "se", n: "s", ne: "sw", e: "w", se: "nw", s: "n", sw: "ne", w: "e" };

function randomShape(rand: () => number): RotatedShape {
  return {
    cx: rand() * 1000 - 200,
    cy: rand() * 1000 - 200,
    width: 5 + rand() * 300,
    height: 5 + rand() * 300,
    rotation: (rand() * 2 - 1) * Math.PI,
  };
}

const close = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

describe("resizeShape", () => {
  it("keeps the opposite side or corner fixed, whatever the rotation and the pointer", () => {
    const rand = prng(11);
    let drifted = 0;
    let small = 0;
    for (let n = 0; n < 2000; n++) {
      const shape = randomShape(rand);
      const handle = ROI_HANDLES[Math.floor(rand() * 8)]!;
      const minSize = 1 + rand() * 20;
      const to = { x: rand() * 1600 - 500, y: rand() * 1600 - 500 };
      const next = resizeShape(shape, handle, to, minSize);
      const before = shapeHandlePoint(shape, OPPOSITE[handle]);
      const after = shapeHandlePoint(next, OPPOSITE[handle]);
      if (!close(before.x, after.x) || !close(before.y, after.y)) drifted++;
      if (next.width < minSize - 1e-9 && next.width < shape.width - 1e-9) small++;
      if (next.height < minSize - 1e-9 && next.height < shape.height - 1e-9) small++;
      expect(next.rotation).toBe(shape.rotation);
    }
    expect(drifted).toBe(0);
    expect(small).toBe(0);
  });

  it("puts the dragged handle on the pointer when the pointer is past the minimum size", () => {
    const rand = prng(12);
    let off = 0;
    let checked = 0;
    for (let n = 0; n < 2000; n++) {
      const shape = randomShape(rand);
      const handle = ROI_HANDLES[Math.floor(rand() * 8)]!;
      // A pointer that is somewhere further out along the handle's own directions than the opposite side + 1.
      const target = { x: (rand() * 2 - 1) * 400, y: (rand() * 2 - 1) * 400 };
      const to = fromShapeFrame(shape, target);
      const next = resizeShape(shape, handle, to, 1);
      const reached = shapeHandlePoint(next, handle);
      const local = toShapeFrame(next, to);
      const onX = handle.includes("e") || handle.includes("w");
      const onY = handle.includes("n") || handle.includes("s");
      // Only the axes the handle moves are compared, and only when not clamped to the minimum.
      const hp = toShapeFrame(next, reached);
      const clampedX = onX && next.width <= 1 + 1e-9;
      const clampedY = onY && next.height <= 1 + 1e-9;
      if (onX && !clampedX && !close(hp.x, local.x)) off++;
      if (onY && !clampedY && !close(hp.y, local.y)) off++;
      checked++;
    }
    expect(checked).toBe(2000);
    expect(off).toBe(0);
  });

  it("resizing a side leaves the other extent alone", () => {
    const rand = prng(13);
    for (let n = 0; n < 500; n++) {
      const shape = randomShape(rand);
      const to = { x: rand() * 800, y: rand() * 800 };
      expect(resizeShape(shape, "e", to, 3).height).toBe(shape.height);
      expect(resizeShape(shape, "n", to, 3).width).toBe(shape.width);
    }
  });
});

describe("rotateShape", () => {
  it("rotates about the centre: centre and size unchanged, the handle on the ray to the pointer", () => {
    const rand = prng(21);
    let bad = 0;
    for (let n = 0; n < 2000; n++) {
      const shape = randomShape(rand);
      const to = { x: shape.cx + (rand() * 2 - 1) * 300 + 0.5, y: shape.cy + (rand() * 2 - 1) * 300 + 0.5 };
      const next = rotateShape(shape, to);
      if (next.cx !== shape.cx || next.cy !== shape.cy || next.width !== shape.width || next.height !== shape.height) bad++;
      const handle = rotationHandlePoint(next, 25);
      // Collinear with the centre and the pointer, on the pointer's side.
      const cross = (handle.x - shape.cx) * (to.y - shape.cy) - (handle.y - shape.cy) * (to.x - shape.cx);
      const dot = (handle.x - shape.cx) * (to.x - shape.cx) + (handle.y - shape.cy) * (to.y - shape.cy);
      if (Math.abs(cross) > 1e-6 * Math.hypot(to.x - shape.cx, to.y - shape.cy) * 100 || dot <= 0) bad++;
      if (!(next.rotation > -Math.PI - 1e-12 && next.rotation <= Math.PI + 1e-12)) bad++;
    }
    expect(bad).toBe(0);
  });

  it("snaps to multiples of the step", () => {
    const rand = prng(22);
    const step = Math.PI / 12;
    for (let n = 0; n < 500; n++) {
      const shape = randomShape(rand);
      const next = rotateShape(shape, { x: shape.cx + rand() * 100 - 50, y: shape.cy + rand() * 100 - 50 }, step);
      const k = next.rotation / step;
      expect(Math.abs(k - Math.round(k))).toBeLessThan(1e-9);
    }
  });
});

describe("frames and corners", () => {
  it("round-trips through the shape's frame", () => {
    const rand = prng(31);
    for (let n = 0; n < 500; n++) {
      const shape = randomShape(rand);
      const p = { x: rand() * 1000, y: rand() * 1000 };
      const back = fromShapeFrame(shape, toShapeFrame(shape, p));
      expect(close(back.x, p.x, 1e-9)).toBe(true);
      expect(close(back.y, p.y, 1e-9)).toBe(true);
    }
  });

  it("round-trips through the Konva-style corner form, and moving keeps the corner offset", () => {
    const rand = prng(32);
    for (let n = 0; n < 500; n++) {
      const shape = randomShape(rand);
      const corner = shapeCorner(shape);
      const back = shapeFromCorner(corner, shape.width, shape.height, shape.rotation);
      for (const key of ["cx", "cy", "width", "height", "rotation"] as const) expect(close(back[key], shape[key], 1e-9)).toBe(true);
      const moved = moveShape(shape, 7, -9);
      const movedCorner = shapeCorner(moved);
      expect(close(movedCorner.x, corner.x + 7, 1e-9)).toBe(true);
      expect(close(movedCorner.y, corner.y - 9, 1e-9)).toBe(true);
    }
  });
});
