# @vitavision/workbench

## 0.1.0

### Minor Changes

- 6f8bd54: New package: the building blocks of a studio app on `@vitavision/ui` (ADR-0003). Incubated in etendue's studio and moved here with its stories and tests.
  
  - `AppShell`: a full-viewport frame (header; left | main | right with resizable, optionally remembered side panels; bottom), with landmarks.
  - `SplitPane`: two panes with a draggable, keyboard-operable divider (WAI-ARIA window splitter). Sizes in px or %, min/max, collapsible, controlled or uncontrolled, `storageKey`. Split panes nest.
  - `TreeView`: a data-driven tree (WAI-ARIA tree pattern) with controlled selection, controlled or uncontrolled expansion, and type-ahead. It reveals a selection made elsewhere.
  - `PlaybackBar`: the transport for a sampled timeline, driven by an external playhead store (`createPlayhead`, `usePlayhead`, `usePlayheadTimeline`, `usePlaybackClock`). Per-frame readers call `playhead.get()` and never re-render.
  - `FileDrop`: an inline drop zone or a window-wide overlay, plus a picker button. `accept` applies to both routes, and dropped folders are walked.
  - `Toaster` and `toast()`: notifications raised from anywhere.
  
  The pure logic behind these components is exported as well: `resolveSize`, `resolveLimits`, `clampSize`, `visibleRows`, `treeKeyAction`, `ancestorIds`, `parentIds`, `advance`, `clampIndex`, `formatSeconds`, `acceptsFile`, `collectDroppedFiles` and `createToastStore`.

### Patch Changes

- Updated dependencies [a019b87]
  - @vitavision/ui@0.8.0
