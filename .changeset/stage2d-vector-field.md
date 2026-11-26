---
"@vitavision/stage2d": patch
---

Add `VectorField`, an arrow overlay for `ImageStage`, and `VectorFieldKey`, its reference length.

`VectorField` takes flat `anchors` (`[x, y, …]`, image coordinates) and `vectors` (`[dx, dy, …]`, data units) and draws them as a halo path and one path per colour step, so ten thousand arrows are a dozen elements. `scale` is image pixels per data unit, or `{ length, percentile }` to make the percentile vector span `length` screen pixels at every zoom (the default is the 95th percentile at 28 px). Colour is one tone (`color` or `role`) or by magnitude through `colormap` and `range`; a non-finite number or an arrow under a screen pixel is skipped. `onHoverChange` and `onItemPress` pick the vector whose anchor is nearest, through the stage's hit-test.

`VectorFieldKey` takes the same `vectors` and `scale` and shows an arrow of a round length with its value ("0.1 px"); put it in the stage's `readout`, or in a `StageReadout`'s `extra` with `bare`. The arithmetic (`arrowPath`, `vectorMagnitudes`, `magnitudePercentile`, `imagePerUnit`, `niceLength`, `colorBin`) is exported.
