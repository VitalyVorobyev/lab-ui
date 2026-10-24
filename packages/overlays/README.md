# @vitavision/overlays

Calibration-target overlays for the vitavision apps, on the `@vitavision/stage2d` image stage: one `TargetOverlay` for a chessboard, ChArUco board, marker board, PuzzleBoard, ring grid or a loose set of corners.

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
| `corners` | `{ id, x, y, i?, j?, score?, angle?, angle2?, cov?, label? }` |
| `markers` | `{ id, corners: [x0, y0, … x3, y3], label? }` |
| `circles` | `{ id, x, y, polarity: "white" \| "black", i?, j?, label? }` |
| `rings` | `{ id, x, y, outer: { rx, ry, angle }, inner?, label? }` |
| `edgeBits` | `{ id, x, y, radius, bit: 0 \| 1, confidence }` (PuzzleBoard) |

Positions are image pixels with the **centre of pixel `i` at coordinate `i`**, which is what the WASM detectors report and what stage2d expects: do not add 0.5. Angles are radians, clockwise on screen. `rx`, `ry` and `radius` are image pixels, so they scale with the image. Ids must be unique within a detection; `selectedIds` and `hoveredId` apply to every part that has the id.

`cov` is the position covariance `[xx, xy, yy]` in image pixels squared, drawn on request as an uncertainty ellipse (below).

`edgeBitsFromPuzzleboard(edges, corners, alignment)` builds `edgeBits` from a PuzzleBoard decode: it maps each observed edge through the alignment (modulo the 501 master period) to its two corners and places the dot at the midpoint, with a radius of a quarter of the edge.

## From calib-targets

`fromCalibTargets` maps a result of the `@vitavision/calib-targets` detectors to a `TargetDetection`. Tag the result with the detector that produced it; TypeScript then checks the rest against that detector's shape:

```ts
import { fromCalibTargets } from "@vitavision/overlays";

fromCalibTargets({ kind: "chessboard", detection: detect_chessboard(w, h, gray, chess, params) });
fromCalibTargets({ kind: "charuco", detection: detect_charuco(w, h, gray, null, params) });
fromCalibTargets({ kind: "corners", corners: detect_corners(w, h, gray, chess) });

// The marker-board circles and the PuzzleBoard edge bits come from a diagnose_* call:
// `diagnosis` is diagnose_puzzleboard's payload, as plain objects.
const { result, diagnostics } = diagnosis;
fromCalibTargets({ kind: "puzzleboard", detection: result, diagnostics });
```

| `kind` | Corners | Also |
|---|---|---|
| `chessboard` | lattice, labelled `i,j` from the grid's `(u, v)` | |
| `charuco` | lattice | `markers` from each marker's `corners_img`, labelled with its dictionary id |
| `markerboard` | lattice | `circles` from `diagnostics`: the matched board circles, at the candidate's centre |
| `puzzleboard` | lattice in master indices | `edgeBits` from `diagnostics.observed_edges`, through the alignment |
| `puzzlepole` | drawn as a `puzzleboard` lattice | |
| `corners` | both axes as edge directions; `strength` is the score | |

- **Positions** pass through unchanged: calib-targets reports the centre of pixel `i` at `i`, as the overlay expects.
- **Ids** are `corner-<n>`, `marker-<n>` and `circle-<n>`, `n` being the index into the result's `corners`, `markers` or `circle_matches`, so a hover or press maps straight back to the item.
- **A miss** (`detection: null`, or `undefined` from a `diagnose_*` call) gives an empty detection of the same kind.
- **Covariance**: a corner's `position_covariance`, when the result has one, becomes its `cov`. Results without the field are accepted as they are.
- **No dependency**: the input types are the minimal structure the mapping reads, so the package does not depend on `@vitavision/calib-targets`; its result types fit them as they are. A `diagnose_*` payload must be plain objects: convert it first if it arrives as `Map`s.

## What is drawn

Each part goes to the stage2d layer that fits it, batched by appearance, so a detection of thousands of items is a few dozen DOM nodes and the pointer is resolved by the stage's hit-test index.

| Part | Drawn as | Layer |
|---|---|---|
| `corners` | plus (5 px arms); with `angle`, one or two edge directions, 8 px each way; on a board the lattice edges (i solid, j dashed) and `i,j` labels | `GridLayer` |
| `markers` | quad outline with 12 % fill, corner 0 ticked, id inside | `AreaSet` |
| `circles` | white: a hollow ring; black: a ring with a centre dot | `PointSet` |
| `rings` | the fitted outer and inner ellipse (exact arcs, image-sized) and a plus at the centre | `EllipseSet` + `PointSet` |
| `edgeBits` | a dot on the edge: solid for 1, dashed for 0, opacity 35 to 100 % from confidence | `EllipseSet` |
| corners' `cov` | with `uncertainty={{ scale }}`: the 1σ ellipse, both semi-axes × `scale`, under the corners | `EllipseSet` |

Colours are overlay roles only (`feature`, `model`, `structure`, `selection`). A score is never drawn as a verdict colour; polarity and bits are shapes, not hues.

States follow the overlay grammar: hover 2 px, selected 2.5 px in the selection colour with a ring on points, dimmed at 35 % opacity (`dimmed` takes `true`, a list of ids, or a predicate). Labels appear only where items are 24 screen px apart, at most 200 at a time.

**Uncertainty ellipses** are opt-in: `uncertainty={{ scale: 40 }}`. A detector's σ is a small fraction of a pixel, so the ellipse is drawn magnified; its shape and orientation are the data's, and its size is σ × `scale`. Print the scale beside the image ("ellipses ×40"), as you would a residual's gain; the layer's accessible name carries it too. The ellipses are in the `model` role, follow their corner's hover, selection and dimming, and are not picked. A covariance that is not positive definite is not drawn.

`onHoverChange` and `onItemPress` report `{ id, part }` with the id from the detection (`part` is `"corner"`, `"marker"`, `"circle"` or `"ring"`). A hover that moves between layers is reported once.

## Pieces

For an app that composes the layers itself:

- **Lattice**: `cornerGrid`, `gridEdges`, `idByGrid`, `gridKey`, `markerPolygons` (pure; `gridEdges` is stage2d's `latticeEdges` with positions).
- **Glyphs**: `TARGET_MARKERS` (`directed`, `circle-white`, `circle-black`) for `PointSet`'s `markers`; the `directed` marker reads a corner's two edge directions from `PointSetItem.angle` and `angle2`.
- **Layers**: `EllipseSet` and `ellipsePath`, re-exported from `@vitavision/stage2d`: a batched set of ellipses whose size is data. `TargetOverlay` draws its rings with `pickable={false}`.
- **Mapping**: `cornerNodes`, `markerAreas`, `circlePoints`, `ringCentres`, `ringEllipses`, `edgeBitEllipses`, `uncertaintyEllipses` are the detection-to-layer-items functions `TargetOverlay` uses. `covarianceEllipse(cov, scale)` is the eigen-decomposition behind the last: the ellipse of a 2×2 covariance, or `null` when it is not positive definite.

## License

MIT OR Apache-2.0
