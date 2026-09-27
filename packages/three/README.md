# @vitavision/three

Framework-agnostic three.js building blocks for robot-cell scenes: the frame and pose
conventions, a runtime that plays baked scenarios, robot visuals, and gizmos for cameras,
lasers, targets, and lights. No React; see `@vitavision/three-react` for the R3F layer.

```bash
bun add @vitavision/three three@0.186.1
```

`three` is a peer (`^0.186.0`): three breaks on minor releases, so the app owns the one copy.
Built in etendue (`web/packages/three`) for its studio and moved here as PLAN L8-1.

```ts
import { FrameTreeRuntime, CameraFrustum, imageBorderPixels } from "@vitavision/three";

const runtime = new FrameTreeRuntime(baked); // an etendue BakedScenario
scene.add(runtime.root);
runtime.frame("cam_left")!.add(new CameraFrustum({ borderRays, depth: 0.12, color }));
runtime.apply(k); // per animation frame: poses only, no kinematics
```

**No kinematics and no camera math here.** Poses arrive baked (etendue ADR 0003), and a
camera's field of view arrives as back-projected border rays from the host, e.g.
`@etendue/wasm`'s `backprojectPixels(imageBorderPixels(w, h))` — so distortion shows and
nothing re-implements a camera model.

| Module | What |
|---|---|
| `conventions` | `Iso3Wire` (`{rotation: [qx,qy,qz,qw], translation}`), `matrixFromIso3`, `composeIso3`, `invertIso3`, `CV_TO_GL` (Rx(π)), `glCameraMatrix`, `Z_UP`, URDF roll-pitch-yaw |
| `FrameTreeRuntime` | one `Object3D` per baked frame, `apply(k)`, `pose(frame, k)`, capture markers |
| `robot` | `loadRobotVisuals` (per-link GLB, failures reported not thrown), `attachRobotVisuals`, `applyRobotMaterial` |
| primitives | `CameraFrustum` (with `pickPadding`: a padded pick hull and a pickable optical centre), `LaserFan` and `TargetBoard` (`setActive`; the board also `setOpacity`; their outlines never take picks), `LightGizmo`, `Axes` |
| `layers` | `PHYSICAL_LAYER` (0, what a sensor sees) and `GIZMO_LAYER` (1, viewer-only); every gizmo above is on `GIZMO_LAYER`; `setLayer` |
| `SensorView` | a calibrated camera's image: renders the canonical pinhole (physical layer only), then resamples it through a host-supplied remap LUT (`RemapTable`, e.g. `@etendue/wasm` `remap`), so distortion, skew and Scheimpflug geometry appear with no camera math in the shader |
| `theme` | `readSceneColors` / `observeSceneColors`: scene colours from the `@vitavision/ui` tokens (including `canvas`), normalised by `normalizeColor` so three parses modern CSS colours (`oklch()`, space-separated `hsl()`, `color-mix()`) |

A viewport camera and its raycaster must enable `GIZMO_LAYER` to show and pick gizmos
(`@vitavision/three-react`'s `SceneCanvas` does); a `SensorView` never does.

Frames: world +Z up, metres; camera frames are OpenCV (+Z forward, +Y down); lasers fan in
their `x = 0` plane about +Z; targets lie in `z = 0` facing +Z; lights emit along +Z.

## License

Licensed under either of

- Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE))
- MIT license ([LICENSE-MIT](LICENSE-MIT))

at your option.

Unless you explicitly state otherwise, any contribution intentionally submitted
for inclusion in this package by you, as defined in the Apache-2.0 license, shall
be dual licensed as above, without any additional terms or conditions.
