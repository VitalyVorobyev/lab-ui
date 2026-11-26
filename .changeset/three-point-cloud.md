---
"@vitavision/three": patch
---

Add `PointCloud`, many points in one draw call.

It takes flat `positions` (`[x, y, z, …]`, metres), optional per-point `colors` (`[r, g, b, …]`, 0 to 1) or one `color`, a `size` (screen pixels, or metres with `sizeAttenuation`) and an `opacity`. A point with a non-finite coordinate is dropped with its colour, and the bounding box and sphere are computed from the points that remain, so frustum culling is exact. `setPoints` replaces the points in place and frees the old GPU buffers; `setColor`, `setSize` and `setOpacity` change the look. It is drawn on `GIZMO_LAYER` by default (pass `layer: PHYSICAL_LAYER` for a cloud a `SensorView` should see) and is not pickable. A `Float32Array` of finite points is used without a copy: do not change it afterwards. `finitePoints` is the pure filter behind it.
