# @vitavision/workbench

The building blocks of a vitavision *studio* app — a tool whose surfaces are all permanent: a
navigator, a viewport, an inspector, a timeline. Built on `@vitavision/ui` and its tokens.

Scope: the application shell and its navigation parts, shared by the vitavision studio apps.

```bash
bun add @vitavision/workbench @vitavision/ui
```

```css
@import "tailwindcss";
@import "@vitavision/ui/styles.css";
@import "@vitavision/workbench/styles.css";
```

| Export | What |
|---|---|
| `AppShell` | Full-viewport frame: `header`, a fixed-width `rail` (an icon nav, `<nav>`), `left` \| `main` \| `right` (side panels resizable and optionally remembered), `bottom`. Landmarks included. |
| `NavRail`, `NavRailItem` | The workspaces of an app as an icon column for `AppShell`'s `rail` slot, one current (`aria-current="page"`): labels under the icons or in tooltips, count badges, disabled items, and `asChild` to render each item as a router's link. Controlled or not. |
| `StatusBar` | One 24 px status line for `AppShell`'s `bottom` slot: `ReadoutItem` facts at the `start` and `end`, anything (a `ProgressBar`) between. A named group; a polite `role="status"` with `live`. |
| `SplitPane` | Two panes, horizontal or vertical, with a draggable, keyboard-operable divider (`role="separator"`, WAI-ARIA window splitter). Sizes in px or `%`, min/max, collapsible, controlled or not, `storageKey`. Nests. |
| `TreeView` | Data-driven tree (`TreeNode[]` with `icon`/`meta`), WAI-ARIA tree keyboard, controlled selection, controlled or uncontrolled expansion; reveals a selection made elsewhere. |
| `PlaybackBar` | Transport for a sampled timeline: step, play/pause, markers, scrubber, `t = k · dt`, speed, loop. |
| `createPlayhead`, `usePlayhead`, `usePlaybackClock` | The playback position as an external store, and the real-time clock that drives it. |
| `FileDrop` | Drop zone (or full-window `overlay`) plus an "Open files…" button; `accept` applied to both routes; dropped folders walked. In a desktop shell, a `pathSource` yields paths to `onPaths` instead of `File`s (see below). |
| `SequenceNavigator` | The current item of an ordered set (a frame of a capture) as a lazy thumbnail strip with previous/next, the position, and `[` / `]` from anywhere outside a text field. A per-item `status` (`{ tone, label }`) draws a dot in the thumbnail's corner and is said in the item's name. |
| `Stepper` | The steps of a gated sequence (Teach, then Find, then Verify): numbered, the current one `aria-current="step"`, done ones checked. A step with a `blockedBy` reason stays focusable but `aria-disabled`, described by its reason (also its tooltip), and cannot be chosen. Row or column; controlled or not. |
| `Toaster`, `toast()` | Notifications from anywhere; one `<Toaster />` near the root. **Now lives in `@vitavision/ui`**; re-exported here (same bindings, one default store) so existing imports keep working. Prefer `import { toast } from "@vitavision/ui"`. |

The pure logic behind them is exported too and tested without a DOM: `splitSize.ts`
(`resolveSize`, `resolveLimits`, `clampSize`), `treeModel.ts` (`visibleRows`, `treeKeyAction`,
`ancestorIds`, `parentIds`), `playhead.ts` (`advance`, `clampIndex`, `formatSeconds`),
`dropFiles.ts` (`acceptsFile`, `collectDroppedFiles`), `stepperModel.ts` (`stepStates`).

### Playback without re-rendering the app

The current frame changes every animation frame, so it is not React state. It is a `Playhead`:

```tsx
const [playhead] = useState(() => createPlayhead(trajectory.count, trajectory.dt));
const [playing, setPlaying] = useState(false);
const [speed, setSpeed] = useState(1);
const [loop, setLoop] = useState(false);
usePlaybackClock({ playhead, playing, speed, loop, onEnd: () => setPlaying(false) });

<PlaybackBar
  playhead={playhead}
  playing={playing} onPlayingChange={setPlaying}
  speed={speed} onSpeedChange={setSpeed}
  loop={loop} onLoopChange={setLoop}
  markers={captures.map((c) => ({ index: c.sample, label: c.name }))}
/>

// In the 3D view's own frame loop — no React involved:
renderer.setAnimationLoop(() => {
  robot.setJoints(trajectory.joints(playhead.get()));
  renderer.render(scene, camera);
});
```

The contract, kept deliberately small:

- `get()` — the current sample index, an integer in `0 … count − 1`. Cheap; call it every frame.
- `set(k)` — rounds and clamps; notifies only on a change.
- `subscribe(listener)` — returns the unsubscribe function (the `useSyncExternalStore` shape).
- `count`, `dt` — the timeline; sample `k` is at `t = k · dt`.
- `setTimeline(count, dt)` — a new scenario in the same store; the index is clamped, not reset.

Every member may be called detached. Only the bar (and anything using `usePlayhead`)
re-renders during playback. The fractional position real-time playback needs lives in the
clock, not the store, so a reader never sees a fractional frame.

### Desktop shells: paths, not files

A Tauri or Electron webview gives paths, not `File`s: its native drops and dialogs report file
system paths, and an app that opens images by path never wants their bytes in the webview.
Give `FileDrop` a `pathSource` built on the shell's APIs, and it delivers paths to `onPaths`,
filtered by `accept` on their extensions. The package stays shell-agnostic. For Tauri 2:

```tsx
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open } from "@tauri-apps/plugin-dialog";
import type { PathSource } from "@vitavision/workbench";

const tauriPaths: PathSource = {
  pick: async ({ multiple, directory }) => {
    const chosen = await open({ multiple, directory });
    return chosen === null ? [] : Array.isArray(chosen) ? chosen : [chosen];
  },
  subscribe: ({ onEnter, onLeave, onDrop }) => {
    let stop = () => {};
    void getCurrentWebview()
      .onDragDropEvent(({ payload }) => {
        if (payload.type === "enter") onEnter();
        else if (payload.type === "leave") onLeave();
        else if (payload.type === "drop") onDrop(payload.paths);
      })
      .then((unlisten) => (stop = unlisten));
    return () => stop();
  },
};

<FileDrop overlay accept="image/*" pathSource={tauriPaths} onPaths={openByPath} />
```

### Scope

No routing, no menus, no app state beyond what each component is asked to remember. A page
that scrolls — a document, a settings form — does not want `AppShell`.

## License

Licensed under either of

- Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE))
- MIT license ([LICENSE-MIT](LICENSE-MIT))

at your option.

Unless you explicitly state otherwise, any contribution intentionally submitted
for inclusion in this package by you, as defined in the Apache-2.0 license, shall
be dual licensed as above, without any additional terms or conditions.
