---
"@vitavision/three-react": patch
---

Add `PointCloud`, a React component over `@vitavision/three`'s `PointCloud`.

`<PointCloud positions colors? color? size? sizeAttenuation? opacity? physical? />` draws a cloud in the enclosing frame (place it with `AtFrame`). Without `colors` it is drawn in the `fg` token, so it reads in both themes. A new `positions` or `colors` array replaces the points in place instead of rebuilding the object. It is viewer-only unless `physical`, in which case a `SensorImage` sees it and redraws when it changes, and it is not pickable.
