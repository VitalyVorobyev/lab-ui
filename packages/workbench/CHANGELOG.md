# @vitavision/workbench

## 0.3.0

### Minor Changes

- 4747e4c: New `NavRail` and `NavRailItem`: the workspaces of an app as a column of icons for `AppShell`'s `rail` slot, one of them current.
  
  ```tsx
  <AppShell
    rail={
      <NavRail value={workspace} onValueChange={setWorkspace} labels="tooltip">
        <NavRailItem value="library" label="Library" icon={<Library />} />
        <NavRailItem value="review" label="Review" icon={<ScanSearch />} badge={pending.length} />
        <NavRailItem value="settings" label="Settings" icon={<Settings />} asChild>
          <Link to="/settings" />
        </NavRailItem>
      </NavRail>
    }
    main={…}
  />
  ```
  
  - **Current item:** controlled with `value` / `onValueChange`, or kept by the rail from `defaultValue`. The current item has `aria-current="page"` and `data-state="active"` (the others `"inactive"`). Choosing the current item again does not call `onValueChange`.
  - **Labels:** `labels="visible"` (the default) sets each label under its icon; `labels="tooltip"` draws icon-only buttons, names each by its label and shows the label in a tooltip (a `TooltipProvider` must be above it, as for every tooltip).
  - **Items:** `value`, `label`, `icon` (decorative), `badge` (a number is drawn as a count, over 99 as "99+"; anything else as given; it describes the item rather than renaming it), `disabled` and `className`.
  - **Links:** with `asChild`, the item renders onto its one child, such as a router's `<Link to="…" />` given without content. The icon and label become the link's content, the link's `className` is kept beside the item's, and its own `onClick` runs first; calling `event.preventDefault()` there keeps the item from being chosen. A disabled link gets `aria-disabled="true"` and its clicks are cancelled.
  - **Accessibility:** the rail is a list with no landmark of its own, because `AppShell`'s `rail` slot is already a named `<nav>`. Outside `AppShell`, wrap it in a `<nav aria-label="…">`. Every item is its own Tab stop.
- ae0c6ab: `SequenceNavigator` shows a status per item, and its strip no longer stretches.
  
  - **`SequenceItem.status?: SequenceItemStatus`** (`{ tone, label }`, where `tone` is `@vitavision/ui`'s `Tone`): a status dot in the thumbnail's top-right corner, drawn over the default thumbnail, the label fallback and a `renderThumbnail` rendering alike. The item carries `data-status` (the tone), and its accessible name and tooltip become `"label, status"`, e.g. `"frame_0003.bmp, not found"`. Items without a `status` render as before. A `renderThumbnail` that drew its own status badge can drop it and pass `status` instead.
  - **Fix, behaviour change: the thumbnail strip is as wide as its thumbnails.** It used to take all of the row's free width, so with a short sequence Next, the position and the key hints sat at the far end of the row, away from the thumbnails. They now follow the last thumbnail. A sequence too long for the row still scrolls as before. To keep the old placement (the strip filling the row, Next at its end), pass `className="[&>ol]:flex-1"`.
- 1e03d02: New `StatusBar`: the status line for `AppShell`'s `bottom` slot.
  
  ```tsx
  <AppShell
    main={…}
    bottom={
      <StatusBar
        start={[{ label: "frame", value: frame.name }, { label: "model", value: model?.name }]}
        end={[{ label: "last run", value: lastRun && `${lastRun} ms` }]}
      >
        {running && <ProgressBar fraction={done} aria-label="Detecting" className="w-40" />}
      </StatusBar>
    }
  />
  ```
  
  - One 24 px row: a `ReadoutStrip` of the `start` items at the left end, one of the `end` items at the right end, and `children` between them. Items are `@vitavision/ui`'s `ReadoutItem`s (`{ label?, value, href?, link? }`); an item whose `value` is `null` or `undefined` is skipped, as in `ReadoutStrip`. The row does not wrap.
  - It is a `role="group"` named by `aria-label` (default "Status"). With `live`, it is a `role="status"` instead, a polite live region (and carries `data-live`), so screen readers announce what changes in it; keep `live` for changes worth hearing, such as an operation finishing.
- bfa285f: New `Stepper`: the steps of a gated sequence, such as Teach, then Find, then Verify, where a step can be entered only once what it depends on is in place.
  
  ```tsx
  <Stepper
    aria-label="Inspection steps"
    value={step}
    onValueChange={setStep}
    steps={[
      { id: "teach", label: "Teach", complete: model !== null },
      { id: "find", label: "Find", blockedBy: model ? undefined : "Teach a model first." },
      { id: "verify", label: "Verify", blockedBy: finds ? undefined : "Run Find first." },
    ]}
  />
  ```
  
  - **Steps:** `{ id, label, blockedBy?, complete? }`, drawn as an ordered list of numbered buttons. A complete step shows a check, a blocked one a lock. `orientation` is `"horizontal"` (the default) or `"vertical"`.
  - **Current step:** controlled with `value` / `onValueChange`, or kept by the stepper from `defaultValue`, which defaults to the first step. The current step has `aria-current="step"`. Choosing the current step again does not call `onValueChange`.
  - **Blocked steps:** a step with a `blockedBy` reason keeps its Tab stop but has `aria-disabled="true"`. Its reason is its accessible description and its tooltip (a `TooltipProvider` must be above it, as for every tooltip). Choosing it, by click or by key, does nothing. The current step is shown as current even if it has a reason.
  - **State:** each step carries `data-state` (`current`, `complete`, `blocked` or `upcoming`), and the list `data-orientation`.
  - **`stepStates(steps, current)`**, the rule on its own: each step's state, and whether choosing it would make it current.

### Patch Changes

- 1914f7f: READMEs, Storybook descriptions and editor documentation no longer refer to the project's internal tickets, decision records or private apps; the text now stands on its own.
- 18e8b6b: `SequenceNavigator`: the current item's outline and the keyboard focus outline are no longer cut off at the ends of the thumbnail strip.
  
  The strip scrolls and clips at its edge, and it had no room at its left and right ends, so the outline of the first and last thumbnails lost its outer side. The strip now has 4 px of padding all round, and an item scrolled into view keeps the same 4 px from the strip's edge. The thumbnails move 4 px right and the row grows 8 px wider; nothing else changes.
- Updated dependencies [c91bc50]
- Updated dependencies [d224648]
- Updated dependencies [1914f7f]
  - @vitavision/ui@0.12.0

## 0.2.1

### Patch Changes

- Updated dependencies [3a82c8f]
  - @vitavision/ui@0.11.0

## 0.2.0

### Minor Changes

- 6e4fdf5: Add `SequenceNavigator`, a path route through `FileDrop` for desktop shells, and an `AppShell` rail slot.
  
  - **`SequenceNavigator`:** the current item of an ordered set (a frame of a capture) as a lazy
    thumbnail strip with previous/next and the position. `[` / `]` work from anywhere outside a
    text field. `renderThumbnail` covers thumbnails that must be fetched first, and `stepIndex`
    is exported.
  - **`FileDrop` `pathSource` / `onPaths` / `onRejectPaths`.** A Tauri or Electron shell's
    native drops and dialogs yield paths, which `FileDrop` filters by `accept` on their
    extensions (`acceptsPath`). The README shows a Tauri implementation. `onFiles` is now
    optional.
  - **`AppShell` `rail` (+ `railLabel`):** a fixed-width `<nav>` at the far left, outside the
    resizable panels, for an icon rail of workspaces. Before, there was nowhere to put one but
    inside `main`.

## 0.1.2

### Patch Changes

- Updated dependencies [c2d73ad]
  - @vitavision/ui@0.10.0

## 0.1.1

### Patch Changes

- a037a0f: `Toaster` and `toast()` move from `@vitavision/workbench` to `@vitavision/ui`: notifications are a generic primitive, and apps without the studio shell need them too. Moved with their stories and tests; the API is unchanged.
  
  - `@vitavision/ui` exports `Toaster`, `ToasterProps`, `toast`, `createToastStore`, `defaultToastStore` and the types `ToastTone`, `ToastOptions`, `ToastRecord`, `ToastStore`. No new dependency and no new styles: the stack uses the existing tokens, and `styles.css` already scans the component sources.
  - `@vitavision/workbench` re-exports the same names from `@vitavision/ui` (the same bindings, so there is still exactly one default store), and `import { toast } from "@vitavision/workbench"` keeps working. **Deprecated:** import them from `@vitavision/ui`; the re-exports are kept for compatibility.
- Updated dependencies [5115556]
- Updated dependencies [a037a0f]
  - @vitavision/ui@0.9.0

## 0.1.0

### Minor Changes

- 6f8bd54: New package: the building blocks of a studio app on `@vitavision/ui`.
  
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
