/**
 * Keyboard camera moves for `SceneCanvas`: orbit and dolly an eye about a target, as pure
 * functions of vectors (the orbit controls then take the new eye as their camera position).
 */

import { Quaternion, Vector3 } from "three";

/**
 * How close to the up axis an orbit may tilt, in radians: a polar angle of exactly 0 or π
 * leaves the camera's heading undefined.
 */
const POLE_MARGIN = 1e-6;

/**
 * `eye` orbited about `target`: by `dAzimuth` radians about the `up` axis (right-handed, so a
 * positive angle moves the eye to its right as seen looking at the target) and then by
 * `dPolar` radians away from `up` (a negative angle tilts the eye up, over the target). The
 * resulting polar angle is clamped to `polarRange` and kept off the poles; the distance to
 * `target` is unchanged. Returns a new vector.
 */
export function orbitEye(
  eye: Vector3,
  target: Vector3,
  up: Vector3,
  dAzimuth: number,
  dPolar: number,
  polarRange: readonly [number, number] = [0, Math.PI],
): Vector3 {
  const axis = up.clone().normalize();
  const offset = eye.clone().sub(target);
  const distance = offset.length();
  if (distance === 0) return eye.clone();
  offset.applyQuaternion(new Quaternion().setFromAxisAngle(axis, dAzimuth));

  const polar = Math.acos(Math.min(1, Math.max(-1, offset.dot(axis) / distance)));
  const low = Math.max(polarRange[0], POLE_MARGIN);
  const high = Math.min(polarRange[1], Math.PI - POLE_MARGIN);
  const next = Math.min(high, Math.max(low, polar + dPolar));
  // Tilting turns the offset about the horizontal axis `up × offset`; on the pole itself,
  // where that axis vanishes, any horizontal direction will do.
  const tilt = new Vector3().crossVectors(axis, offset);
  if (tilt.lengthSq() < 1e-24 * distance * distance) {
    tilt.crossVectors(axis, Math.abs(axis.x) < 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0));
  }
  offset.applyQuaternion(new Quaternion().setFromAxisAngle(tilt.normalize(), next - polar));
  return offset.add(target);
}

/**
 * `eye` moved along its line to `target`, to `factor` times its distance (below 1 is closer),
 * clamped to `distanceRange`. Returns a new vector.
 */
export function dollyEye(
  eye: Vector3,
  target: Vector3,
  factor: number,
  distanceRange: readonly [number, number] = [0, Number.POSITIVE_INFINITY],
): Vector3 {
  const offset = eye.clone().sub(target);
  const distance = offset.length();
  if (distance === 0) return eye.clone();
  const next = Math.min(distanceRange[1], Math.max(distanceRange[0], distance * factor));
  return offset.multiplyScalar(next / distance).add(target);
}
