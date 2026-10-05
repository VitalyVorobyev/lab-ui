---
"@vitavision/stage2d": minor
---

New `DatumEditor`: a frame on the image, an origin and the direction of its i axis, moved and turned like an object.

- **Value**: `Datum { origin: { x, y }; angle }`, the angle in radians, clockwise on screen from `+x` (the same convention as `RotatedShape.rotation`). It takes `value` / `defaultValue` / `onValueChange`, and `onCommit` once a drag is released or a key pressed. Without a value it starts at the image's centre, pointing along `+x`.
- **Glyph**: a ring (7 screen px) at the origin, the i axis as an arm (`armLength`, 40 screen px by default) ending in a rotation handle, and the j axis at half the length, a quarter turn clockwise on screen. All of it is drawn over a halo, at a constant size on screen, in the overlay `model` colour unless `stroke` is given.
- **Pointer**: drag the ring to move the origin, or the arm or its handle to turn the datum about the origin. A press grabs whichever is nearer, and nothing moves until the pointer has travelled 3 px, so a click does not nudge it. A turn keeps the point of the arm that was grabbed under the pointer, so it does not jump. Shift rounds the angle to `angleSnap` (π/12, i.e. 15°); `snapAlways` rounds every turn. `originSnap` rounds the origin to a grid of that many image pixels, and `bounds` keeps it inside a rectangle (the image by default). `rotatable={false}` fixes the angle, and `editable={false}` only draws the datum.
- **Keyboard**: the origin is a focusable button (`aria-roledescription="datum"`, named with its numbers, e.g. "Datum: origin 200, 150, angle 0°"). Arrow keys move it one image pixel (ten with Shift, or grid steps with `originSnap`), and `[` / `]` turn it by 1° (15° with Shift). These keys do not pan the stage.
- The arithmetic is exported for apps that draw their own: `datumAxes`, `moveDatum`, `rotateDatum`, `datumPress` and the glyph sizes `DATUM_RING_PX`, `DATUM_ARM_PX` and `DATUM_HANDLE_PX`.
- New `snapAngle(angle, step)`: rounds an angle to a multiple of a step. `rotateShape` now uses it and behaves as before.
