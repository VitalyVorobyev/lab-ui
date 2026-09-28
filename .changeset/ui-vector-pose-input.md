---
"@vitavision/ui": minor
---

Three additions for editing physical quantities, incubated in etendue's studio (`web/packages/ui-next`) and moved here with their stories and tests:

- **`NumberInput` takes a `unit`** (`mm`, `m`, `°`, `px`), written inside the field after the number — mono, muted, not part of the value, and announced as the field's description (after the caller's own `aria-describedby`, before a surrounding `Field`'s). The input then sits in a full-width wrapper carrying `data-unit`; `className`, `style` and `ref` still go to the `<input>`. Without `unit` the markup is byte-identical to 0.6.0. Its props are now exported as `NumberInputProps`.
- **`VectorInput`** — a small vector (a position, a set of angles) edited as one row: an axis label before each field, the unit once at the end, `precision` at rest and the typed text while a field has focus (Escape restores the value on focus). `readOnly` renders a `ReadoutStrip`.
- **`PoseInput`** — an SE(3) pose in the wire form `{ rotation: [qx, qy, qz, qw], translation: [tx, ty, tz] }`, edited as a translation (m or mm) and three angles in degrees. It does no rotation mathematics: the conversion is passed in as a `RotationView`. New types: `PoseInputProps`, `PoseValue`, `Quaternion`, `RotationView`, `Vec3`, `VectorInputProps`.
