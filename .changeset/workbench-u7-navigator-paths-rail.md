---
"@vitavision/workbench": minor
---

Add `SequenceNavigator`, a path route through `FileDrop` for desktop shells, and an `AppShell` rail slot.

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
