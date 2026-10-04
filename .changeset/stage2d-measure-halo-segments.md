---
"@vitavision/stage2d": minor
---

`MeasureOverlay` draws a halo under role-coloured marks, and gains a `segments` primitive for many unconnected segments in one element.

- **Halo.** A primitive with a `role` (`feature`, `model`, `structure`) is now drawn over a dark band in the overlay's halo colour: the same geometry, 2 screen px wider, at 60 % opacity. Its label gets a 3 px halo behind the glyphs (`paint-order: stroke`). A role-coloured mark and its label therefore hold on a bright part of the image, where they used to wash out. A selected mark's halo sits under its selection ring and is 2 px wider than the ring.
- **`halo` prop**: `"role"` (the default) as above; `"all"` gives every primitive a halo, verdict tones included; `"none"` turns them off. Primitives with a `tone` and no `role` look exactly as before under the default, so pass `halo="none"` to keep role-coloured marks without a halo too.
- **`segments` primitive** (`SegmentsPrimitive`): `{ kind: "segments", points: [x1, y1, x2, y2, …] }`, with the usual `tone` / `role`, `dashed`, `label`, `id` and `state`. Every segment is drawn in one path, so thousands of ticks cost one element; use it for marks stored in no particular order, which a `polyline` would join. A trailing partial segment is ignored, and a segment with a non-finite coordinate is skipped rather than breaking the path. The path builder is exported as `segmentsPath(points)`.
- **The `MeasurePrimitive` union has a new member.** Code that switches over `primitive.kind` and checks the switch is exhaustive needs a `"segments"` case (or a default case) to compile.
- The selection ring under a selected dashed mark now breaks where the mark does, and a dimension's value is no longer written a second time, invisibly, into its selection ring.
