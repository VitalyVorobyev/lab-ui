---
"@vitavision/three-react": minor
---

`TargetBoard` is printed paper and ink in every theme, and `SensorImage` redraws only when something changed.

- **Behaviour change: `TargetBoard` colours.** The board was drawn in the theme's surface and foreground colours, and its squares took the accent colour while selected, so a sensor image showed inverted squares in a dark theme and a tinted board when it was selected. It is now white paper with black squares whatever the theme. New props `color` and `edgeColor` (any CSS colour) set the paper and square colours. The outline, which only the 3D view shows, is drawn in the `muted` scene colour, and in `signal` over other objects while `active`. To get the old look back, pass the theme's colours yourself: with `const colors = useSceneColors()`, render `<TargetBoard color={colors.surface} edgeColor={colors.fg} … />`.
- **Behaviour change: `SensorImage` redraws on demand.** It used to redraw about four times a second forever, even when nothing moved or it was scrolled out of view. Now it draws when the playhead's sample changes, when the theme changes, when the scene is invalidated, and when it comes back into view. It does nothing at all while it is out of view or its tab is hidden.
- **New: `invalidateScene(runtime)` and `useSceneInvalidate()`.** They tell every `SensorImage` of a scene to redraw. `Robot` calls `invalidateScene` when its meshes attach, detach or change colour, and `TargetBoard` when it is added, removed or recoloured. If you change the scene yourself outside React (add your own meshes, swap a material or texture), call `invalidateScene` with the `FrameTree`'s runtime, or call the function `useSceneInvalidate()` returns from inside the `FrameTree`. Poses that follow the playhead need no call.
