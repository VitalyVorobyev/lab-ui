# @vitavision/three

## 0.1.0

### Minor Changes

- 376b38a: New package (PLAN L8-1): framework-agnostic three.js building blocks for robot-cell scenes. It has no React dependency, and `three` (`^0.186.0`) is a peer. The package was incubated in etendue's studio and moved here with its tests.
  
  - **Conventions**, defined in one place: `Iso3Wire` (`{ rotation: [qx, qy, qz, qw], translation }`), `matrixFromIso3`, `iso3FromMatrix`, `composeIso3`, `invertIso3`, `CV_TO_GL`, `glCameraMatrix`, `Z_UP`, and URDF roll/pitch/yaw (`rpyFromQuaternion`, `quaternionFromRpy`).
  - **`FrameTreeRuntime`**: applies a baked scenario to an `Object3D` graph with one object per frame. It provides `apply(k)`, `pose(frame, k)` and capture markers. It does no kinematics.
  - **Robots**: `loadRobotVisuals` reports failed meshes instead of throwing. Also `attachRobotVisuals`, `applyRobotMaterial` and `gltfMeshLoader`.
  - **Gizmos**: `CameraFrustum` (built from back-projected border rays, with `imageBorderPixels`; `pickPadding` pads its pick hull and makes the optical centre pickable), `LaserFan` and `TargetBoard` (`setActive`, plus `setOpacity` on the board; their outlines never take picks), `LightGizmo` and `Axes`. `disposeObject` frees their GPU resources.
  - **Layers**: `PHYSICAL_LAYER` (what a sensor sees) and `GIZMO_LAYER` (viewer-only; every gizmo but the target board, which sensors see, lives there), with `setLayer`.
  - **`SensorView`**: a calibrated camera's image. It renders the canonical pinhole (physical layer only) and resamples it through a host-supplied remap LUT (`RemapTable`, `CanonicalPinhole`, `PixelCentre`), so distortion, skew and Scheimpflug geometry appear with no camera-model math in the shader. `precision: "half"` keeps linear radiance unquantised for measurement, and `taps` box-filters a supersampled render over each pixel's footprint.
  - **Theme**: `readSceneColors` and `observeSceneColors` take scene colours from the `@vitavision/ui` tokens, including `canvas` for image backgrounds. `normalizeColor` passes each value through the browser's colour parser, so three.js reads modern CSS colours (`oklch()`, space-separated `hsl()`, `color-mix()`) it would otherwise ignore.
