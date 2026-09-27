---
"@vitavision/three": minor
---

New package (PLAN L8-1): framework-agnostic three.js building blocks for robot-cell scenes. It has no React dependency, and `three` (`^0.186.0`) is a peer. The package was incubated in etendue's studio and moved here with its tests.

- **Conventions**, defined in one place: `Iso3Wire` (`{ rotation: [qx, qy, qz, qw], translation }`), `matrixFromIso3`, `iso3FromMatrix`, `composeIso3`, `invertIso3`, `CV_TO_GL`, `glCameraMatrix`, `Z_UP`, and URDF roll/pitch/yaw (`rpyFromQuaternion`, `quaternionFromRpy`).
- **`FrameTreeRuntime`**: applies a baked scenario to an `Object3D` graph with one object per frame. It provides `apply(k)`, `pose(frame, k)` and capture markers. It does no kinematics.
- **Robots**: `loadRobotVisuals` reports failed meshes instead of throwing. Also `attachRobotVisuals`, `applyRobotMaterial` and `gltfMeshLoader`.
- **Gizmos**: `CameraFrustum` (built from back-projected border rays, with `imageBorderPixels`), `LaserFan`, `TargetBoard`, `LightGizmo` and `Axes`. `disposeObject` frees their GPU resources.
- **Theme**: `readSceneColors` and `observeSceneColors` take scene colours from the `@vitavision/ui` tokens.
