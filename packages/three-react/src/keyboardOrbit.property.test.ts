/**
 * Property tests for the keyboard camera moves: the laws an orbit and a dolly must obey,
 * checked over a few hundred seeded-random eyes, targets and up axes rather than a handful of
 * hand-picked ones. The generator is seeded, so a failure reproduces exactly.
 */

import { Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { dollyEye, orbitEye } from "./keyboardOrbit";

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

const RUNS = 400;

function generators(seed: number) {
  const random = prng(seed);
  const between = (low: number, high: number) => low + (high - low) * random();
  const point = () => new Vector3(between(-5, 5), between(-5, 5), between(-5, 5));
  const direction = () => {
    for (;;) {
      const v = point();
      if (v.lengthSq() > 0.01) return v.normalize();
    }
  };
  /** An eye at least 0.1 from the target and at least 1° off the up axis. */
  const eye = (target: Vector3, up: Vector3) => {
    for (;;) {
      const e = point();
      const offset = e.clone().sub(target);
      if (offset.length() > 0.1 && Math.abs(offset.clone().normalize().dot(up)) < Math.cos(Math.PI / 180)) return e;
    }
  };
  return { between, point, direction, eye };
}

const polarOf = (eye: Vector3, target: Vector3, up: Vector3) => eye.clone().sub(target).angleTo(up);

describe("orbitEye laws", () => {
  it("keeps the distance to the target", () => {
    const g = generators(1);
    for (let i = 0; i < RUNS; i++) {
      const [target, up] = [g.point(), g.direction()];
      const eye = g.eye(target, up);
      const next = orbitEye(eye, target, up, g.between(-Math.PI, Math.PI), g.between(-1, 1));
      expect(next.distanceTo(target)).toBeCloseTo(eye.distanceTo(target), 9);
    }
  });

  it("an azimuth step keeps the polar angle, and its opposite undoes it", () => {
    const g = generators(2);
    for (let i = 0; i < RUNS; i++) {
      const [target, up] = [g.point(), g.direction()];
      const eye = g.eye(target, up);
      const a = g.between(-Math.PI, Math.PI);
      const turned = orbitEye(eye, target, up, a, 0);
      expect(polarOf(turned, target, up)).toBeCloseTo(polarOf(eye, target, up), 9);
      expect(orbitEye(turned, target, up, -a, 0).distanceTo(eye)).toBeLessThan(1e-9);
    }
  });

  it("a polar step lands on the clamped polar angle", () => {
    const g = generators(3);
    for (let i = 0; i < RUNS; i++) {
      const [target, up] = [g.point(), g.direction()];
      const eye = g.eye(target, up);
      const low = g.between(0, 1.5);
      const high = g.between(1.6, Math.PI);
      const step = g.between(-2, 2);
      const expected = Math.min(high, Math.max(low, polarOf(eye, target, up) + step));
      const next = orbitEye(eye, target, up, g.between(-1, 1), step, [low, high]);
      expect(polarOf(next, target, up)).toBeCloseTo(Math.max(expected, 1e-6), 6);
    }
  });
});

describe("dollyEye laws", () => {
  it("scales the distance, keeps the direction, and is undone by the inverse factor", () => {
    const g = generators(4);
    for (let i = 0; i < RUNS; i++) {
      const [target, up] = [g.point(), g.direction()];
      const eye = g.eye(target, up);
      const factor = Math.exp(g.between(-2, 2));
      const next = dollyEye(eye, target, factor);
      expect(next.distanceTo(target)).toBeCloseTo(eye.distanceTo(target) * factor, 9);
      expect(next.clone().sub(target).angleTo(eye.clone().sub(target))).toBeLessThan(1e-6);
      expect(dollyEye(next, target, 1 / factor).distanceTo(eye)).toBeLessThan(1e-9);
    }
  });
});
