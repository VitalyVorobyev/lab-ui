# ADR-0005: App-shell building blocks are in scope, as `@vitavision/workbench`

- Status: Accepted
- Date: 2026-09-27 (numbered 0003 until 2026-10, when it was renumbered: 0003 is the type family)
- Plan: `docs/plan/PLAN.md` §2, ticket W-1
- Amends: the README's "Scope" section, which listed app-shell layout as deliberately out of scope

## Context

Until now the README excluded **app-shell layout rules**: how an app fills the viewport is that
app's decision, and a design system should not force every consumer into a fixed-viewport shell.
For the page-shaped apps that reasoning still holds. vitavision, the visual-anomaly-lab and the
calib-targets studio are documents and forms that scroll.

A *studio* is a different kind of screen. Every surface is permanent: a navigator, a viewport,
an inspector and a timeline. Nothing scrolls except the insides of panels, and the user resizes
the panels. Two apps need this shape now:

- **etendue studio** (`etendue/web/apps/studio`) is the first consumer. It is the robot-cell and
  sensor-rig simulator's web front end: a frame tree, a 3D viewport, an inspector, and scenario
  playback.
- **calibration-rs `calibration-diagnose`** is the expected second consumer. It shares etendue's 3D
  view (PLAN L8-1, etendue P2-4) and has the same navigator/viewport/inspector layout.

On 2026-09-27 the user decided to build the UI these studios share once and give them one
visual language. That UI was built in etendue (`web/packages/workbench`) to this repository's
§4 Definition of Done, then moved here. This is the promotion rule with a named second consumer.

## Decision

A new package, **`@vitavision/workbench`**, holds the building blocks of a studio app:

- `AppShell`: a full-viewport frame with a header, resizable left and right panels around the
  main surface, and a bottom strip. It includes the landmarks.
- `SplitPane`: two panes with a draggable, keyboard-operable divider (WAI-ARIA window splitter).
- `TreeView`: a data-driven tree (WAI-ARIA tree pattern) with controlled selection.
- `PlaybackBar`, with `createPlayhead`, `usePlayhead`, `usePlayheadTimeline` and `usePlaybackClock`:
  the transport for a sampled timeline.
- `FileDrop`: an inline or window-wide drop target, plus a picker button.
- `Toaster` and `toast()`: notifications.

Layering, enforced by `tools/inventory/check-deps.ts`: `workbench` depends on `@vitavision/ui`
and `lucide-react` (the icon set `ui` and `stage2d` already use), with `react` and `react-dom` as
peers. It has no router, no motion library and no state library. `ui` stays free of app-shell
concerns. An app that scrolls never installs `workbench`.

### The playhead contract

Playback position changes every animation frame, and render loops read it outside React, so it
is **not React state**. It is an external store, and the contract is deliberately small:

- `get()` returns the current sample index, **an integer** in `0 … count − 1` (0 when `count` is 0).
  It is cheap. **Per-frame readers call `get()`** in their own frame callback (a three.js render
  loop, R3F `useFrame`) and subscribe to nothing.
- `set(k)` rounds and clamps. It notifies subscribers only when the index changes.
- `subscribe(listener)` returns the unsubscribe function. This is the `useSyncExternalStore`
  shape. `usePlayhead` uses it, and only components that *display* the index should
  (the playback bar, a time readout).
- `count` and `dt` describe the timeline: sample `k` is at `t = k · dt`. `setTimeline(count, dt)`
  swaps in a new scenario on the same store and clamps the index without resetting it.
- Every member may be called detached.

The fractional position that real-time playback needs lives in the clock (`usePlaybackClock`,
`advance`), not in the store, so a reader never sees a fractional frame. A seek from anywhere
(the scrubber, a marker, a viewport pick) is a `set`. The clock picks it up on its next frame.

Any change to this contract is a breaking change to the package.

## Consequences

- The README's scope section changes. App-shell layout is out of scope for `ui`, and in scope
  for `workbench`, for apps that are studios.
- PLAN gains ticket **W-1**, and §2 gains the package and its layering rule.
- The new npm name needs its **trusted publisher** registered on npmjs.com before its first
  release from CI (ADR-0001): repository `VitalyVorobyev/lab-ui`, workflow `release.yml`,
  environment `npm`.
- 3D scenes read the same store without importing `workbench`. `@vitavision/three-react`'s
  `FrameTree` takes a structural `PlayheadSource` (`{ get(): number }`) and calls `get()` once per
  rendered frame, so a `Playhead` fits it as it is, and the two packages stay independent.
