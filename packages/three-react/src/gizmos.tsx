import type { ThreeEvent } from "@react-three/fiber";
import {
  Axes,
  CameraFrustum as CameraFrustumObject,
  LaserFan as LaserFanObject,
  LightGizmo as LightGizmoObject,
  type LightShapeLike,
  TargetBoard as TargetBoardObject,
  disposeObject,
  normalizeColor,
} from "@vitavision/three";
import { useEffect, useMemo, useRef } from "react";
import type { Object3D } from "three";

import { useSceneColors } from "./colors";
import { useOptionalFrameTree } from "./FrameTree";
import { invalidateScene } from "./sceneSignal";

/** Colour an object is built with before its effect applies the theme's. */
const UNSET = "gray";

function useDisposed<T extends Object3D>(object: T): T {
  useEffect(() => () => disposeObject(object), [object]);
  return object;
}

function usePick(onSelect: (() => void) | undefined) {
  const hoveredRef = useRef(false);
  const pickable = onSelect !== undefined;
  // `onPointerOut` never fires when the object unmounts or stops being pickable under the
  // pointer: restore the cursor then.
  useEffect(
    () => () => {
      if (hoveredRef.current) document.body.style.cursor = "";
      hoveredRef.current = false;
    },
    [pickable],
  );
  if (!onSelect) return {};
  return {
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      onSelect();
    },
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      hoveredRef.current = true;
      document.body.style.cursor = "pointer";
    },
    onPointerOut: () => {
      hoveredRef.current = false;
      document.body.style.cursor = "";
    },
  };
}

/** Props of {@link CameraFrustum}. */
export interface CameraFrustumProps {
  /** Border rays on the camera's `z = 1` plane (see `imageBorderPixels` in `@vitavision/three`). */
  borderRays: ArrayLike<number>;
  /** Far outline depth in metres. */
  depth: number;
  /** Emphasised (selected); drawn in the accent colour. */
  active?: boolean;
  /**
   * How much larger than the drawn frustum its pick hull is, with a pickable sphere of
   * `pickPadding − 1` × `depth` at the optical centre (`CameraFrustumOptions.pickPadding` in
   * `@vitavision/three`). Default 1.2.
   */
  pickPadding?: number;
  /** Makes it pickable. */
  onSelect?: (() => void) | undefined;
}

/** A camera's field of view, in the camera frame (place it with `AtFrame`). */
export function CameraFrustum({ borderRays, depth, active = false, pickPadding, onSelect }: CameraFrustumProps) {
  const colors = useSceneColors();
  const picking = usePick(onSelect);
  const object = useDisposed(
    useMemo(
      () =>
        new CameraFrustumObject({
          borderRays,
          depth,
          color: UNSET,
          ...(pickPadding !== undefined ? { pickPadding } : {}),
        }),
      [borderRays, depth, pickPadding],
    ),
  );
  useEffect(() => {
    object.setActive(active);
    object.setColor(active ? colors.signal : colors.muted);
  }, [object, active, colors.signal, colors.muted]);
  return <primitive object={object} {...picking} />;
}

/** Props of {@link LaserFan}. */
export interface LaserFanProps {
  /** Half-angle in radians. */
  halfAngle: number;
  /** Reach in metres. */
  length: number;
  /** Emphasised (selected). */
  active?: boolean;
  /** Makes it pickable. */
  onSelect?: (() => void) | undefined;
}

/** A line laser's light sheet, in the laser frame. Drawn in the `defect` (red) token. */
export function LaserFan({ halfAngle, length, active = false, onSelect }: LaserFanProps) {
  const colors = useSceneColors();
  const picking = usePick(onSelect);
  const object = useDisposed(useMemo(() => new LaserFanObject({ halfAngle, length, color: UNSET }), [halfAngle, length]));
  useEffect(() => {
    object.setColor(colors.defect);
    object.setActive(active);
  }, [object, active, colors.defect]);
  return <primitive object={object} {...picking} />;
}

/** Props of {@link TargetBoard}. */
export interface TargetBoardProps {
  /** Extent along local X, metres. */
  width: number;
  /** Extent along local Y, metres. */
  height: number;
  /** Checkerboard squares, columns along X. */
  checker?: { cols: number; rows: number } | undefined;
  /**
   * Light (paper) colour, any CSS colour. Default: white paper (`#f2f2f2`). The board is a
   * physical object, so this is its colour in every theme and in a `SensorImage`.
   */
  color?: string | undefined;
  /** Dark-square (ink) colour, any CSS colour. Default: black ink (`#1a1a1a`). */
  edgeColor?: string | undefined;
  /** Emphasised (selected): the outline is drawn in the accent colour and over other objects. */
  active?: boolean;
  /** Makes it pickable. */
  onSelect?: (() => void) | undefined;
}

/**
 * A planar target in the target frame (z = 0, facing +Z): a printed board in fixed paper and
 * ink colours, whatever the theme. Only its outline, which a `SensorImage` does not show,
 * follows the theme (`muted`) and the selection (`signal`).
 */
export function TargetBoard({ width, height, checker, color, edgeColor, active = false, onSelect }: TargetBoardProps) {
  const colors = useSceneColors();
  const picking = usePick(onSelect);
  const runtime = useOptionalFrameTree();
  const cols = checker?.cols;
  const rows = checker?.rows;
  const object = useDisposed(
    useMemo(
      () =>
        new TargetBoardObject({
          width,
          height,
          outlineColor: UNSET,
          checker: cols !== undefined && rows !== undefined ? { cols, rows } : undefined,
        }),
      [width, height, cols, rows],
    ),
  );
  useEffect(() => {
    object.setColors(color === undefined ? undefined : normalizeColor(color), edgeColor === undefined ? undefined : normalizeColor(edgeColor));
    if (runtime) invalidateScene(runtime);
  }, [object, color, edgeColor, runtime]);
  // A board leaving the scene changes what a sensor sees, too.
  useEffect(
    () => () => {
      if (runtime) invalidateScene(runtime);
    },
    [object, runtime],
  );
  useEffect(() => {
    object.setOutlineColor(active ? colors.signal : colors.muted);
    object.setActive(active);
  }, [object, active, colors.signal, colors.muted]);
  return <primitive object={object} {...picking} />;
}

/** Props of {@link LightGizmo}. */
export interface LightGizmoProps {
  /** Emitter shape. */
  shape: LightShapeLike;
  /** Symbol size in metres. */
  size?: number;
  /** Makes it pickable. */
  onSelect?: (() => void) | undefined;
}

/** A light's wireframe symbol, in the light frame. Drawn in the `warn` token. */
export function LightGizmo({ shape, size = 0.05, onSelect }: LightGizmoProps) {
  const colors = useSceneColors();
  const picking = usePick(onSelect);
  const key = JSON.stringify(shape);
  const object = useDisposed(useMemo(() => new LightGizmoObject(JSON.parse(key) as LightShapeLike, UNSET, size), [key, size]));
  useEffect(() => object.setColor(colors.warn), [object, colors.warn]);
  return <primitive object={object} {...picking} />;
}

/** Props of {@link FrameAxes}. */
export interface FrameAxesProps {
  /** Axis length in metres. */
  size?: number;
}

/** A frame's axes: X `defect`, Y `normal`, Z `signal`. */
export function FrameAxes({ size = 0.05 }: FrameAxesProps) {
  const colors = useSceneColors();
  const object = useDisposed(useMemo(() => new Axes(size, { x: UNSET, y: UNSET, z: UNSET }), [size]));
  useEffect(
    () => object.setColors({ x: colors.defect, y: colors.normal, z: colors.signal }),
    [object, colors.defect, colors.normal, colors.signal],
  );
  return <primitive object={object} />;
}
