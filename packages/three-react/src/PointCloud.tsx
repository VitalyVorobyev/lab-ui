import { PointCloud as PointCloudObject, PHYSICAL_LAYER, GIZMO_LAYER, normalizeColor } from "@vitavision/three";
import { useEffect, useMemo } from "react";

import { useSceneColors } from "./colors";
import { useOptionalFrameTree } from "./FrameTree";
import { useDisposed } from "./gizmos";
import { invalidateScene } from "./sceneSignal";

/** Props of {@link PointCloud}. */
export interface PointCloudProps {
  /**
   * The points, flat `[x0, y0, z0, x1, y1, z1, …]` in the enclosing frame, in metres. A point with a
   * non-finite coordinate is dropped. A new array replaces the points in place, without
   * rebuilding the object; a `Float32Array` of finite points is used without a copy, so pass a new
   * one rather than changing it.
   */
  positions: ArrayLike<number>;
  /**
   * One colour per point, flat `[r0, g0, b0, …]`, each channel in `[0, 1]`. Without it every
   * point is `color`.
   */
  colors?: ArrayLike<number> | undefined;
  /** The colour of every point when `colors` is absent, any CSS colour. Defaults to the `fg` token, so it follows the theme. */
  color?: string | undefined;
  /** A point's size: screen pixels, or metres with `sizeAttenuation`. Default 2. */
  size?: number | undefined;
  /** Make `size` metres in the scene, so near points are bigger. Off by default. */
  sizeAttenuation?: boolean | undefined;
  /** Opacity in `[0, 1]`. Default 1. */
  opacity?: number | undefined;
  /**
   * Whether a `SensorImage` sees the cloud. Off by default: a cloud is something to look at in
   * the viewport, drawn on the viewer-only layer. On, it is part of the physical scene.
   */
  physical?: boolean | undefined;
}

/**
 * A point cloud in the enclosing frame (place it with `AtFrame`): one draw call, per-point colours
 * optional, bounds computed from its finite points so the camera culls it correctly.
 *
 * Without `colors` it is drawn in the `fg` token, so it reads in both themes. It is not pickable:
 * offer the choices in a list beside the view.
 */
export function PointCloud({
  positions,
  colors,
  color,
  size = 2,
  sizeAttenuation = false,
  opacity = 1,
  physical = false,
}: PointCloudProps) {
  const scene = useSceneColors();
  const runtime = useOptionalFrameTree();
  const layer = physical ? PHYSICAL_LAYER : GIZMO_LAYER;
  const object = useDisposed(useMemo(() => new PointCloudObject({ positions: [], sizeAttenuation, layer }), [sizeAttenuation, layer]));

  useEffect(() => {
    object.setPoints(positions, colors);
    if (physical && runtime) invalidateScene(runtime);
  }, [object, positions, colors, physical, runtime]);
  useEffect(() => object.setColor(color === undefined ? scene.fg : normalizeColor(color)), [object, color, scene.fg]);
  useEffect(() => object.setSize(size), [object, size]);
  useEffect(() => object.setOpacity(opacity), [object, opacity]);
  // A physical cloud leaving the scene changes what a sensor sees.
  useEffect(
    () => () => {
      if (physical && runtime) invalidateScene(runtime);
    },
    [object, physical, runtime],
  );
  return <primitive object={object} />;
}
