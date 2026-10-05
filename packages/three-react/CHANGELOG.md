# @vitavision/three-react

## 0.2.0

### Minor Changes

- 0de0291: `TargetBoard` is printed paper and ink in every theme, and `SensorImage` redraws only when something changed.
  
  - **Behaviour change: `TargetBoard` colours.** The board was drawn in the theme's surface and foreground colours, and its squares took the accent colour while selected, so a sensor image showed inverted squares in a dark theme and a tinted board when it was selected. It is now white paper with black squares whatever the theme. New props `color` and `edgeColor` (any CSS colour) set the paper and square colours. The outline, which only the 3D view shows, is drawn in the `muted` scene colour, and in `signal` over other objects while `active`. To get the old look back, pass the theme's colours yourself: with `const colors = useSceneColors()`, render `<TargetBoard color={colors.surface} edgeColor={colors.fg} … />`.
  - **Behaviour change: `SensorImage` redraws on demand.** It used to redraw about four times a second forever, even when nothing moved or it was scrolled out of view. Now it draws when the playhead's sample changes, when the theme changes, when the scene is invalidated, and when it comes back into view. It does nothing at all while it is out of view or its tab is hidden.
  - **New: `invalidateScene(runtime)` and `useSceneInvalidate()`.** They tell every `SensorImage` of a scene to redraw. `Robot` calls `invalidateScene` when its meshes attach, detach or change colour, and `TargetBoard` when it is added, removed or recoloured. If you change the scene yourself outside React (add your own meshes, swap a material or texture), call `invalidateScene` with the `FrameTree`'s runtime, or call the function `useSceneInvalidate()` returns from inside the `FrameTree`. Poses that follow the playhead need no call.
- 40aefd7: `SceneCanvas` can be driven from the keyboard.
  
  - **Behaviour change: the view is a focusable, labelled group.** The wrapper was an `img` named by `label`, which told assistive technology the view was a still picture. It is now a `group` announced as a "3D view", still named by `label`, and a tab stop whose keys are described to screen readers. While it has focus, Left and Right orbit about the up axis and Up and Down tilt over the target (5° a press, 15° with Shift, within the orbit's limits), `+` and `-` zoom in and out by a factor of 1.2, and `0` returns to the opening view. Keys pressed with Ctrl, Cmd or Alt are left to the browser, and keys pressed on content inside the view are left to that content.
  - **New prop `keyboard`**, default `true`. To keep the previous pointer-only behaviour, pass `keyboard={false}`: the view then takes no tab stop and handles no keys. It stays a labelled `group` either way.
  - Selecting objects in the view is still by pointer only; offer the same choices in a list or an inspector beside it.

### Patch Changes

- 4fac634: `SensorImage` no longer draws a `TargetBoard`'s outline, which is now a viewport-only marker, and its dark tones no longer band. The board's look in `SceneCanvas` is unchanged.
- 1914f7f: READMEs, Storybook descriptions and editor documentation no longer refer to the project's internal tickets, decision records or private apps; the text now stands on its own.
- Updated dependencies [4fac634]
- Updated dependencies [1914f7f]
  - @vitavision/three@0.2.0

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
