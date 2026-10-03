# @vitavision/overlays

Calibration-target overlays for the vitavision lab apps, on the `@vitavision/stage2d` image stage: one `TargetOverlay` for a chessboard, ChArUco board, marker board, PuzzleBoard, ring grid or a loose set of corners.

```bash
bun add @vitavision/overlays @vitavision/stage2d @vitavision/ui
```

```css
@import "@vitavision/ui/styles.css";
@import "@vitavision/stage2d/styles.css";
@import "@vitavision/overlays/styles.css";
```

`stage2d` is a **peer**: the layers find the stage through its React context, so the app and this package must share one copy. `stage2d/styles.css` defines the overlay role colours every mark is painted in; this package adds none.

```tsx
import { ImageLayer, ImageStage } from "@vitavision/stage2d";
import { TargetOverlay, type TargetDetection } from "@vitavision/overlays";

<ImageStage image={{ width, height }} view={view} onView={setView}>
  <ImageLayer src={url} />
  <TargetOverlay
    detection={detection}
    selectedIds={selected}
    onItemPress={({ id }) => select(id)}
  />
</ImageStage>
```

## The input

A `TargetDetection` is one detection run, independent of the library that produced it. An app maps its detector's result to it once; nothing here imports a detector package.

| Field | Items |
|---|---|
| `kind` | `"chessboard" \| "charuco" \| "markerboard" \| "puzzleboard" \| "ringgrid" \| "corners" \| "circles"`. The four boards draw lattice edges; the others do not. |
| `corners` | `{ id, x, y, i?, j?, score?, angle?, angle2?, label? }` |
| `markers` | `{ id, corners: [x0, y0, … x3, y3], label? }` |
| `circles` | `{ id, x, y, polarity: "white" \| "black", i?, j?, label? }` |
| `rings` | `{ id, x, y, outer: { rx, ry, angle }, inner?, label? }` |
| `edgeBits` | `{ id, x, y, radius, bit: 0 \| 1, confidence }` (PuzzleBoard) |

Positions are image pixels with the **centre of pixel `i` at coordinate `i`**, which is what the WASM detectors report and what stage2d expects: do not add 0.5. Angles are radians, clockwise on screen. `rx`, `ry` and `radius` are image pixels, so they scale with the image. Ids must be unique within a detection; `selectedIds` and `hoveredId` apply to every part that has the id.

`edgeBitsFromPuzzleboard(edges, corners, alignment)` builds `edgeBits` from a PuzzleBoard decode: it maps each observed edge through the alignment (modulo the 501 master period) to its two corners and places the dot at the midpoint, with a radius of a quarter of the edge.

## What is drawn

Each part goes to the stage2d layer that fits it, batched by appearance (ADR-0004), so a detection of thousands of items is a few dozen DOM nodes and the pointer is resolved by the stage's hit-test index.

| Part | Drawn as | Layer |
|---|---|---|
| `corners` | plus (5 px arms); with `angle`, one or two edge directions, 8 px each way; on a board the lattice edges (i solid, j dashed) and `i,j` labels | `GridLayer` |
| `markers` | quad outline with 12 % fill, corner 0 ticked, id inside | `AreaSet` |
| `circles` | white: a hollow ring; black: a ring with a centre dot | `PointSet` |
| `rings` | the fitted outer and inner ellipse (exact arcs, image-sized) and a plus at the centre | `EllipseSet` + `PointSet` |
| `edgeBits` | a dot on the edge: solid for 1, dashed for 0, opacity 35 to 100 % from confidence | `EllipseSet` |

Colours are overlay roles only (`feature`, `model`, `structure`, `selection`). A score is never drawn as a verdict colour; polarity and bits are shapes, not hues.

States follow the overlay grammar: hover 2 px, selected 2.5 px in the selection colour with a ring on points, dimmed at 35 % opacity (`dimmed` takes `true`, a list of ids, or a predicate). Labels appear only where items are 24 screen px apart, at most 200 at a time.

`onHoverChange` and `onItemPress` report `{ id, part }` with the id from the detection (`part` is `"corner"`, `"marker"`, `"circle"` or `"ring"`). A hover that moves between layers is reported once.

## Pieces

For an app that composes the layers itself:

- **Lattice**: `cornerGrid`, `gridEdges`, `idByGrid`, `gridKey`, `markerPolygons` (pure; `gridEdges` is stage2d's `latticeEdges` with positions).
- **Glyphs**: `TARGET_MARKERS` (`directed`, `circle-white`, `circle-black`) for `PointSet`'s `markers`; `packAxes` / `unpackAxes` fold a corner's two edge directions into the one `angle` a `MarkerShape` receives; `ellipsePath`.
- **Layers**: `EllipseSet`, a batched, non-picked set of ellipses whose size is data.
- **Mapping**: `cornerNodes`, `markerAreas`, `circlePoints`, `ringCentres`, `ringEllipses`, `edgeBitEllipses` are the detection-to-layer-items functions `TargetOverlay` uses.

## License

MIT OR Apache-2.0
