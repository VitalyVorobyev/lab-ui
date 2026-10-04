import { Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { dollyEye, orbitEye } from "./keyboardOrbit";

const ORIGIN = new Vector3();
const Z_UP = new Vector3(0, 0, 1);
const deg = (d: number) => (d * Math.PI) / 180;

function expectClose(actual: Vector3, expected: readonly [number, number, number]) {
  expect(actual.x).toBeCloseTo(expected[0], 9);
  expect(actual.y).toBeCloseTo(expected[1], 9);
  expect(actual.z).toBeCloseTo(expected[2], 9);
}

describe("orbitEye", () => {
  it("turns about the up axis, a positive angle to the eye's right", () => {
    // Looking along +Y from (0, -1, 0) with +Z up, the eye's right is +X.
    expectClose(orbitEye(new Vector3(0, -1, 0), ORIGIN, Z_UP, deg(90), 0), [1, 0, 0]);
    expectClose(orbitEye(new Vector3(0, -1, 0), ORIGIN, Z_UP, deg(-90), 0), [-1, 0, 0]);
  });

  it("tilts towards the up axis for a negative polar step, about the target", () => {
    const target = new Vector3(1, 2, 3);
    const eye = orbitEye(new Vector3(2, 2, 3), target, Z_UP, 0, deg(-45));
    expectClose(eye, [1 + Math.SQRT1_2, 2, 3 + Math.SQRT1_2]);
  });

  it("keeps the polar angle inside the range and off the poles", () => {
    const top = orbitEye(new Vector3(1, 0, 0), ORIGIN, Z_UP, 0, deg(-180));
    expect(top.z).toBeLessThan(1);
    expect(top.z).toBeCloseTo(1, 5);
    const limited = orbitEye(new Vector3(1, 0, 0), ORIGIN, Z_UP, 0, deg(-80), [deg(60), deg(120)]);
    expectClose(limited, [Math.sin(deg(60)), 0, Math.cos(deg(60))]);
  });

  it("leaves a pole along any horizontal direction", () => {
    const eye = orbitEye(new Vector3(0, 0, 2), ORIGIN, Z_UP, 0, deg(90));
    expect(eye.z).toBeCloseTo(0, 9);
    expect(eye.length()).toBeCloseTo(2, 9);
    const south = orbitEye(new Vector3(0, 0, -2), ORIGIN, Z_UP, 0, deg(-90));
    expect(south.z).toBeCloseTo(0, 9);
    const xUp = orbitEye(new Vector3(3, 0, 0), ORIGIN, new Vector3(1, 0, 0), 0, deg(90));
    expect(xUp.x).toBeCloseTo(0, 9);
  });

  it("returns an eye on the target unchanged", () => {
    const eye = orbitEye(ORIGIN, ORIGIN, Z_UP, 1, 1);
    expect(eye).not.toBe(ORIGIN);
    expectClose(eye, [0, 0, 0]);
  });
});

describe("dollyEye", () => {
  it("scales the distance to the target along the line of sight", () => {
    const target = new Vector3(1, 1, 1);
    expectClose(dollyEye(new Vector3(1, 1, 3), target, 0.5), [1, 1, 2]);
    expectClose(dollyEye(new Vector3(1, 1, 3), target, 1.2), [1, 1, 3.4]);
  });

  it("clamps the distance to the range", () => {
    expectClose(dollyEye(new Vector3(0, 0, 2), ORIGIN, 0.1, [1, 10]), [0, 0, 1]);
    expectClose(dollyEye(new Vector3(0, 0, 2), ORIGIN, 100, [1, 10]), [0, 0, 10]);
  });

  it("returns an eye on the target unchanged", () => {
    expectClose(dollyEye(ORIGIN, ORIGIN, 2), [0, 0, 0]);
  });
});
