---
"@vitavision/forms": patch
---

`SchemaValueForm` can show what differs from a baseline, and per-field messages from elsewhere.

- **`baseline`:** a value to compare with, such as the defaults or a previous run. A field that differs gets a rule in the gutter and a note under the control saying "changed" and what it was, with a Reset that writes the baseline's value back through `onValueChange`. A struct, a variant or a tuple row says how many leaves under it changed, with one Reset for them all. A key missing on one side differs from a key present on the other; arrays of equal length compare by index, others as a whole. Without `baseline` nothing is marked. `diffPaths(value, baseline)` is the same comparison as a list of dot paths.
- **`messages`:** text attached to fields by dot path (`solver.max_iters`, `cameras.0.id`), for validation that comes from a backend. A string, or `{ severity: "error", text }`, is announced as an alert and marks the control invalid; `{ severity: "warning", text }` is shown without blocking; the path `""` shows above the form. A control's own error (a fraction in an integer field) is shown ahead of the message. A path that no visible field has shows nowhere. `FieldMessage` and `FieldMessages` are exported.
