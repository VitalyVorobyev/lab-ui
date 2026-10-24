---
"@vitavision/overlays": minor
---

`fromCalibTargets` maps a `@vitavision/calib-targets` result to a `TargetDetection`, and `TargetOverlay` can draw each corner's position uncertainty.

- **`fromCalibTargets(result)`** takes the result tagged with its detector, `{ kind, detection, diagnostics? }`, for `chessboard`, `charuco`, `markerboard`, `puzzleboard`, `puzzlepole` and raw `corners` (`{ kind: "corners", corners }`). Board corners keep their lattice index (`(u, v)` becomes `(i, j)`); ChArUco markers come from `corners_img`, labelled with the dictionary id; the marker-board circles and the PuzzleBoard edge bits come from the matching `diagnose_*` call's `diagnostics`; raw corners draw both axes. Positions pass through unchanged. Ids are `corner-<n>`, `marker-<n>` and `circle-<n>`, `n` being the index in the result. A miss (`null`) gives an empty detection of the same kind. The package still has no dependencies: the input types are the structure the mapping reads, and calib-targets' own result types fit them.
- **`TargetCorner.cov`**: an optional position covariance `[xx, xy, yy]`, image pixels squared. `fromCalibTargets` fills it from a corner's `position_covariance` when the result has one; results without the field are accepted unchanged.
- **`TargetOverlay`'s `uncertainty={{ scale }}`** draws each corner's `cov` as its 1σ ellipse with both semi-axes multiplied by `scale`, in the `model` role, under the corners. A detector's σ is a fraction of a pixel, so choose a large scale and print it beside the image ("ellipses ×40"). The ellipses follow their corner's hover, selection and dimming; a covariance that is not positive definite is not drawn. Off by default, so existing overlays look the same.
- **`covarianceEllipse(cov, scale)`** and **`uncertaintyEllipses(corners, scale)`** are exported for an app that composes the layers itself.
