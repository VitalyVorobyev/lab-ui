---
"@vitavision/three-react": minor
---

`SceneCanvas` can be driven from the keyboard.

- **Behaviour change: the view is a focusable, labelled group.** The wrapper was an `img` named by `label`, which told assistive technology the view was a still picture. It is now a `group` announced as a "3D view", still named by `label`, and a tab stop whose keys are described to screen readers. While it has focus, Left and Right orbit about the up axis and Up and Down tilt over the target (5° a press, 15° with Shift, within the orbit's limits), `+` and `-` zoom in and out by a factor of 1.2, and `0` returns to the opening view. Keys pressed with Ctrl, Cmd or Alt are left to the browser, and keys pressed on content inside the view are left to that content.
- **New prop `keyboard`**, default `true`. To keep the previous pointer-only behaviour, pass `keyboard={false}`: the view then takes no tab stop and handles no keys. It stays a labelled `group` either way.
- Selecting objects in the view is still by pointer only; offer the same choices in a list or an inspector beside it.
