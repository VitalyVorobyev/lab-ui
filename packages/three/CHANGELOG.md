# @vitavision/three

## 0.2.0

### Minor Changes

- 4fac634: Physical target colours, sharper dark tones in sensor images, and no texture leak when restyling robots.
  
  - **Behaviour change: `TargetBoard` is paper and ink by default, and its outline is viewer-only.** `TargetBoardOptions.color` and `edgeColor` are now optional fixed colours, defaulting to `0xf2f2f2` (paper) and `0x1a1a1a` (ink): a printed calibration board is white with black squares whatever the viewer's theme, so a sensor image no longer shows inverted squares in a dark theme or a tint on a selected board. The outline moved to `GIZMO_LAYER`, so a `SensorView` no longer draws it; a viewport that enables that layer still does. New `outlineColor` option (default: the dark-square colour) and `setOutlineColor(color)` colour the outline on its own; `setColors(color, edgeColor)` now changes only the paper and ink colours, and either may be omitted to return to its default. While `setActive(true)`, the outline is drawn after the opaque geometry and ignores depth, so a selected board stays visible behind other objects. To keep the previous look, pass `color` and `edgeColor` (for example your theme's surface and foreground colours) and call `setOutlineColor` with the colour you used to pass to `setColors` as the edge colour.
  - **Fix: `SensorView` with `precision: "byte"` (the default) stores its canonical render as sRGB.** It stored 8-bit linear light, which leaves dark tones only a few levels and shows as banding in display images; neighbouring dark greys now come back distinct. `precision: "half"` is unchanged.
  - **Fix: `applyRobotMaterial` frees the replaced materials' textures.** It disposed the replaced materials but not their maps. Each replaced material is now disposed once, with its textures, however many meshes shared it, and the new shared material is never disposed even when `roots` overlap.

### Patch Changes

- 1914f7f: READMEs, Storybook descriptions and editor documentation no longer refer to the project's internal tickets, decision records or private apps; the text now stands on its own.

## 0.1.0

### Minor Changes

- 376b38a: New package: framework-agnostic three.js building blocks for robot-cell scenes. It has no React dependency, and `three` (`^0.186.0`) is a peer.
  
  - **Conventions**, defined in one place: `Iso3Wire` (`{ rotation: [qx, qy, qz, qw], translation }`), `matrixFromIso3`, `iso3FromMatrix`, `composeIso3`, `invertIso3`, `CV_TO_GL`, `glCameraMatrix`, `Z_UP`, and URDF roll/pitch/yaw (`rpyFromQuaternion`, `quaternionFromRpy`).
  - **`FrameTreeRuntime`**: applies a baked scenario to an `Object3D` graph with one object per frame. It provides `apply(k)`, `pose(frame, k)` and capture markers. It does no kinematics.
  - **Robots**: `loadRobotVisuals` reports failed meshes instead of throwing. Also `attachRobotVisuals`, `applyRobotMaterial` and `gltfMeshLoader`.
  - **Gizmos**: `CameraFrustum` (built from back-projected border rays, with `imageBorderPixels`; `pickPadding` pads its pick hull and makes the optical centre pickable), `LaserFan` and `TargetBoard` (`setActive`, plus `setOpacity` on the board; their outlines never take picks), `LightGizmo` and `Axes`. `disposeObject` frees their GPU resources.
  - **Layers**: `PHYSICAL_LAYER` (what a sensor sees) and `GIZMO_LAYER` (viewer-only; every gizmo but the target board, which sensors see, lives there), with `setLayer`.
  - **`SensorView`**: a calibrated camera's image. It renders the canonical pinhole (physical layer only) and resamples it through a host-supplied remap LUT (`RemapTable`, `CanonicalPinhole`, `PixelCentre`), so distortion, skew and Scheimpflug geometry appear with no camera-model math in the shader. `precision: "half"` keeps linear radiance unquantised for measurement, and `taps` box-filters a supersampled render over each pixel's footprint.
  - **Theme**: `readSceneColors` and `observeSceneColors` take scene colours from the `@vitavision/ui` tokens, including `canvas` for image backgrounds. `normalizeColor` passes each value through the browser's colour parser, so three.js reads modern CSS colours (`oklch()`, space-separated `hsl()`, `color-mix()`) it would otherwise ignore.
