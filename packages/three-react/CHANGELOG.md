# @vitavision/three-react

## 0.1.0

### Minor Changes

- 376b38a: New package: React Three Fiber components over `@vitavision/three`. Peers are `react`, `react-dom`, `three` (`^0.186.0`) and `@react-three/fiber` (`^9.8.1`).
  
  - `SceneCanvas`: a Z-up viewport in vitavision colours, with orbit controls, a ground grid and lights. `up`, `fov` and `clip` adapt it to other scenes, such as a camera-frame (CV, +Y down) one. Its camera and raycaster enable `GIZMO_LAYER`.
  - `FrameTree`, `AtFrame` and `useFrameTree`: a baked scenario as a frame graph, posed at `playhead.get()` on every rendered frame (`PlayheadSource`, e.g. a `@vitavision/workbench` playhead). Playback never re-renders React.
  - `Robot`, `CameraFrustum`, `LaserFan`, `TargetBoard`, `LightGizmo` and `FrameAxes`. Their colours come only from design tokens. `LaserFan` and `TargetBoard` take `active`; `CameraFrustum` takes `pickPadding`.
  - `SensorImage`: a camera's calibrated image of the enclosing `FrameTree` at the playhead, from a remap LUT (`SensorView` on a canvas of its own).
  - `useSceneColors`: the theme's scene colours, which follow the `dark` class. It is server-safe and returns neutral colours on the server.
  - `SceneColorsProvider`: colours to use instead of the tokens, for an app whose palette does not define them.

### Patch Changes

- Updated dependencies [376b38a]
  - @vitavision/three@0.1.0
