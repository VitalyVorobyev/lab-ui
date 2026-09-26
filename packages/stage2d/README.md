# @vitavision/stage2d

The vitavision 2D image stage: one view transform over a stack of layers, the measurement overlay drawn into it, and the value planes behind a rendered image.

```bash
bun add @vitavision/stage2d @vitavision/ui
```

```css
@import "@vitavision/ui/styles.css";
@import "@vitavision/stage2d/styles.css";
```

**Image viewing** — `ImageStage`, a pannable/zoomable frame that transforms every stacked
child layer together (image, mask, measurement overlay, interactive handles) so they never
drift apart, with `StageToolbar` / `StageReadout` as the in-canvas controls and `useStage()`
as the way a layer reads the transform. The arithmetic behind it is pure and exported —
`fitScale`, `fitView`, `toImage`, `toScreen`, `zoomAbout`, `clampView`, `frameRect`,
`preserveCenter`, `steppedScale`. See "The image stage" below. `ZoomPanCanvas` is its
deprecated predecessor, still exported unchanged.
`api/mapValues.ts` decodes the `VAM1` float32-plane wire format into indexable values
(`decodePlane`, `valueAt`, `valuesAt`, `fractionOf`, `fetchPlane`) — it never draws;
colour range and colormap stay the caller's decision.

**Measurement overlay** — `MeasureOverlay` is a pure-props SVG layer meant to sit inside
`ImageStage`'s transformed stack, drawing `point`, `segment`, `circle`, `arc`, `caliper`
and `dimension` primitives given in **source-image pixel coordinates**, each with an
optional `tone`. No app state and no DOM measurement: a `strokeScale` prop (the current
image-px→screen-px scale) is all it needs to keep strokes and labels a constant size on
screen at any zoom. Its geometry lives in `measureGeometry.ts` and is tested without React.

Overlay and `LineProfile` edge marks share one tone vocabulary, `MeasureTone`/`toneColor`
(`signal` / `normal` / `defect` / `warn` / `muted`). `Badge`'s `Tone` is a separate,
verdict-badge vocabulary and keeps its own name.

### The image stage

```tsx
const [view, setView] = useState<StageView | null>(null); // null = "open at a sensible view"

<ImageStage
  image={{ width: 1280, height: 1024 }}
  view={view}
  onView={setView}
  toolbar={<StageToolbar />}
  readout={<StageReadout cursor={cursor} />}
  onHover={setCursor}
>
  <img src={url} className="h-full w-full" />
  <MeasureOverlay nativeWidth={1280} nativeHeight={1024} primitives={overlay} strokeScale={view?.scale ?? 1} />
  <MyInteractiveLayer />
</ImageStage>
```

Three things about it are load-bearing, and each replaces a way `ZoomPanCanvas` could be
held wrong:

**The stage is laid out at the image's own pixel size** and carries the whole transform.
A child `<svg viewBox="0 0 W H" class="absolute inset-0">` is therefore registered with the
photograph at every viewport size, with no aspect ratio for a caller to remember to set and
no letterbox to correct for. Layers are absolutely positioned and sized by the stage; they
do no scaling of their own.

**Image coordinates name pixel centres.** `i` means the centre of pixel `i`, which is what
every image-processing result means by it; CSS and SVG mean the pixel's *leading edge*. The
half pixel between the two conventions lives in `PIXEL_CENTRE`, and it is carried by
`toImage` / `toScreen` and by `imageViewBox(image)` — which is what an SVG layer drawn in
image coordinates must use for its `viewBox` instead of `0 0 W H`. `MeasureOverlay` already
does. It is invisible at fit and four screen pixels of error at 8×, which is exactly the zoom
at which someone is checking whether an overlay lands on the edge it claims to mark.

**`scale` is CSS pixels per image pixel.** `1` is 100%; fit is `fitScale(box, image)`, a
value rather than a magic constant, so zooming *out* past fit is expressible (down to
`MIN_SCALE_VS_FIT` × fit). A `ResizeObserver` keeps a fit view fit and re-centres any other
view on the image point that was centred before, so a window resize moves the frame around
the picture rather than the picture around the frame.

**Panning is the default reading of a press, and a layer opts out by stopping propagation.**
That is what lets an interactive layer — a draggable ROI handle, a clickable contour — live
*inside* the transform. A layer that must yield to the hand tool or a held space bar checks
`useStage().panMode` before claiming the press; `onBackgroundClick` fires for a press that
reached the stage and never became a drag, which is how a layer hears "deselect".

Gestures: wheel zooms about the cursor, double-click toggles fit against **the view you were
just at**, space or the middle button pans from anywhere, and `+` / `-` / `0` (fit) / `1`
(100%) / arrows work when the stage has focus.

## License

Licensed under either of

- Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE))
- MIT license ([LICENSE-MIT](LICENSE-MIT))

at your option.

Unless you explicitly state otherwise, any contribution intentionally submitted
for inclusion in this package by you, as defined in the Apache-2.0 license, shall
be dual licensed as above, without any additional terms or conditions.
