import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  type ColorRepresentation,
  Float32BufferAttribute,
  Points,
  PointsMaterial,
  Sphere,
} from "three";

import { GIZMO_LAYER } from "../layers";

/** Options of {@link PointCloud}. */
export interface PointCloudOptions {
  /**
   * The points, flat `[x0, y0, z0, x1, y1, z1, …]` in the parent's frame, in metres. A `Float32Array`
   * of finite points is used in place, not copied: do not change it afterwards. A point with a
   * non-finite coordinate is dropped (and its colour with it): it would poison the bounds that
   * frustum culling relies on.
   */
  positions: ArrayLike<number>;
  /**
   * One colour per point, flat `[r0, g0, b0, …]` with each channel in `[0, 1]`. Without it every
   * point is `color`. Must have as many triples as `positions`; a shorter list leaves the rest black.
   */
  colors?: ArrayLike<number> | undefined;
  /** The colour of every point when `colors` is absent. Defaults to white. */
  color?: ColorRepresentation | undefined;
  /**
   * The size of a point. In screen pixels, or in metres with `sizeAttenuation`. Defaults to 2
   * pixels.
   */
  size?: number | undefined;
  /** Make `size` metres in the scene, so near points are bigger. Off by default: a point stays `size` pixels. */
  sizeAttenuation?: boolean | undefined;
  /** Opacity in `[0, 1]`. Defaults to 1; below 1 the points no longer write depth. */
  opacity?: number | undefined;
  /** The layer to draw on. Defaults to {@link GIZMO_LAYER}: seen in a viewport, not by a `SensorView`. */
  layer?: number | undefined;
}

/** The finite points of a flat `[x, y, z, …]` array, and which input points they are. */
export interface FinitePoints {
  /** The finite points, flat. The input itself, when every point is finite and it is a `Float32Array`. */
  positions: Float32Array;
  /** The indices (in the input) of the points kept, or `null` when it is all of them. */
  kept: Uint32Array | null;
  /** How many points are kept. */
  count: number;
}

/**
 * Keep the points whose three coordinates are finite.
 *
 * @param positions - Flat `[x, y, z, …]`. A trailing partial triple is ignored.
 * @returns The kept points as a `Float32Array`, and which input points they are.
 */
export function finitePoints(positions: ArrayLike<number>): FinitePoints {
  const total = Math.floor(positions.length / 3);
  let bad = 0;
  for (let i = 0; i < total; i++) {
    if (!Number.isFinite(positions[3 * i]) || !Number.isFinite(positions[3 * i + 1]) || !Number.isFinite(positions[3 * i + 2])) bad++;
  }
  if (bad === 0) {
    const array =
      positions instanceof Float32Array && positions.length === 3 * total
        ? positions
        : Float32Array.from({ length: 3 * total }, (_, k) => positions[k]!);
    return { positions: array, kept: null, count: total };
  }
  const out = new Float32Array(3 * (total - bad));
  const kept = new Uint32Array(total - bad);
  let n = 0;
  for (let i = 0; i < total; i++) {
    if (!Number.isFinite(positions[3 * i]) || !Number.isFinite(positions[3 * i + 1]) || !Number.isFinite(positions[3 * i + 2])) continue;
    out[3 * n] = positions[3 * i]!;
    out[3 * n + 1] = positions[3 * i + 1]!;
    out[3 * n + 2] = positions[3 * i + 2]!;
    kept[n++] = i;
  }
  return { positions: out, kept, count: n };
}

const NO_RAYCAST: Points["raycast"] = () => undefined;

/**
 * Many points as one draw call: a measured or reconstructed cloud, per-point colours optional.
 *
 * Its bounding box and sphere are computed from the finite points when they are set, so the
 * camera's frustum culling is exact: a cloud off screen is not drawn, and one in view is never
 * culled by a stray `NaN`. It is not pickable (a ray test over every point would cost more
 * than a viewport can spare); pick from the list of what it was built from.
 *
 * A viewer-only object by default (see {@link PointCloudOptions.layer}); place it in a frame with `AtFrame`.
 */
export class PointCloud extends Points<BufferGeometry, PointsMaterial> {
  #count = 0;

  constructor({
    positions,
    colors,
    color = "white",
    size = 2,
    sizeAttenuation = false,
    opacity = 1,
    layer = GIZMO_LAYER,
  }: PointCloudOptions) {
    super(
      new BufferGeometry(),
      new PointsMaterial({ color, size, sizeAttenuation, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 }),
    );
    this.raycast = NO_RAYCAST;
    this.layers.set(layer);
    this.setPoints(positions, colors);
  }

  /** How many points are drawn (those with finite coordinates). */
  get count(): number {
    return this.#count;
  }

  /**
   * The bounding box of the points, in the cloud's own frame; empty for no points.
   * A fresh box each time.
   */
  get bounds(): Box3 {
    return (this.geometry.boundingBox ?? new Box3()).clone();
  }

  /**
   * Replace the points and their colours, reusing nothing but the object.
   *
   * @param positions - Flat `[x, y, z, …]`; see {@link PointCloudOptions.positions}.
   * @param colors - Flat `[r, g, b, …]` in `[0, 1]`, or `undefined` for the single `color`.
   */
  setPoints(positions: ArrayLike<number>, colors?: ArrayLike<number>): void {
    const { positions: xyz, kept, count } = finitePoints(positions);
    const geometry = this.geometry;
    // Replacing an attribute leaves the old one's GPU buffer behind; disposing the geometry frees them, and the next draw uploads the new ones.
    if (geometry.hasAttribute("position")) geometry.dispose();
    geometry.setAttribute("position", new BufferAttribute(xyz, 3));
    if (colors === undefined) {
      geometry.deleteAttribute("color");
    } else {
      const rgb = new Float32Array(3 * count);
      for (let i = 0; i < count; i++) {
        const from = 3 * (kept === null ? i : kept[i]!);
        rgb[3 * i] = colors[from] ?? 0;
        rgb[3 * i + 1] = colors[from + 1] ?? 0;
        rgb[3 * i + 2] = colors[from + 2] ?? 0;
      }
      geometry.setAttribute("color", new Float32BufferAttribute(rgb, 3));
    }
    if (this.material.vertexColors !== (colors !== undefined)) {
      this.material.vertexColors = colors !== undefined;
      this.material.needsUpdate = true;
    }
    this.#count = count;
    // Bounds from the kept points only, so culling is right and a cloud with no points has an empty box.
    if (count === 0) {
      // An empty box and a sphere of radius -1, which no frustum intersects.
      geometry.boundingBox = new Box3();
      geometry.boundingSphere = new Sphere();
    } else {
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
    }
  }

  /** Change the colour used when there are no per-point colours. */
  setColor(color: ColorRepresentation): void {
    this.material.color.set(color);
  }

  /** Change the point size (see {@link PointCloudOptions.size}). */
  setSize(size: number): void {
    this.material.size = size;
  }

  /** Change the opacity. */
  setOpacity(opacity: number): void {
    this.material.opacity = opacity;
    const transparent = opacity < 1;
    if (this.material.transparent !== transparent) {
      this.material.transparent = transparent;
      this.material.needsUpdate = true;
    }
    this.material.depthWrite = !transparent;
  }
}
