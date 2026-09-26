# jscpd: re-check of F2

PLAN.md F2 says that a jscpd run (min 60 tokens) over the five §0 frontends found 3.1% duplication, almost all of it intra-repo. This file records the re-check done in L0-1 (2026-09-26).

## Run

```sh
bunx jscpd@4 --min-tokens 60 --format "typescript,tsx" \
  --ignore "**/node_modules/**,**/dist/**,**/*.test.*,**/__tests__/**,**/generated*/**,**/pkg/**" \
  --reporters json \
  lab-ui/src visual-anomaly-lab/frontend/src vitavision/src calibration-rs/app/src \
  calib-targets-rs/studio/src calib-targets-rs/demo/src
```

The commits measured are the ones in [concept-matrix.md](concept-matrix.md#repositories-measured).

| | |
|---|---|
| Sources | 943 files, 110,419 lines |
| Clones | 108 |
| Duplicated lines | 2,226 (**2.02%**; 2.25% by tokens) |

The run excludes tests, which is the likely reason it comes in under 3.1%.

## Where the clones are

Clones within a single frontend:

- **vitavision** has the most, and it is the F6 set:
  - the overlays: `ChessboardOverlay` ↔ `MarkerboardOverlay` (85 lines), `CharucoOverlay` ↔ `MarkerboardOverlay` (63), `PuzzleboardOverlay` ↔ `MarkerboardOverlay` (67), `CharucoOverlay` ↔ `ChessboardOverlay` (44);
  - the worker wrappers: `puzzleboard` ↔ `radsym` (32), `chessCorners` ↔ `radsym` (16);
  - the config forms: `CharucoConfigForm` ↔ `MarkerBoardConfigForm` (68).

  The remainder is editorial: `*Post.tsx`, blog `*Card.tsx`, and atlas views.
- **visual-anomaly-lab** and **calibration-rs** have small clones spread across routes and hooks.
- **lab-ui**: `LineChart` ↔ `LineProfile` (75 lines).

Clones between frontends in the same repository:

- **calib-targets-rs `studio` ↔ `demo`**: 550 lines in total, spread over `CanvasViewport` (254), `InfoTip` (95), `overlays.ts` (112), `LayerToggles` (79) and `useDebounced` (10). This is about a quarter of all duplicated lines.

Clones between repositories: **none among the §0 repos.**

**Verdict: F2 holds for the §0 repos.** The ~2% duplication is intra-repo. The largest block is between two frontends of one repository (calib-targets-rs studio/demo).

## Outside §0: a real cross-repo copy

**chess-corners-rs/demo ↔ calib-targets-rs/demo** has 756 duplicated lines, 20.3% of the two trees combined:

| File | Lines |
|---|---|
| `CanvasViewport.tsx` | 386 |
| `App.tsx` | 150 |
| `InfoTip.tsx` | 95 |
| `LayerToggles.tsx` | 81 |
| `useImageBitmap.ts` | 46 |
| `useDebounced.ts` | 10 |

It is the only copy-paste between repositories found so far. The chess-corners demo is therefore a direct candidate for `@vitavision/stage2d` and `@vitavision/overlays` once calib-targets `demo` migrates (see the concept matrix).
