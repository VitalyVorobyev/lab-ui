/**
 * `@vitavision/workbench` — the building blocks of a studio app on `@vitavision/ui`: the
 * shell, its split panes and status bar, a tree navigator, a playback transport over a sampled timeline,
 * file opening, and (re-exported from `@vitavision/ui`) notifications.
 *
 * Import `@vitavision/workbench/styles.css` after `@vitavision/ui/styles.css`.
 *
 * @packageDocumentation
 */

export { AppShell, type AppShellProps, type SidePanelSize } from "./components/AppShell";
export { StatusBar, type StatusBarProps } from "./components/StatusBar";
export { SplitPane, type SplitPaneProps } from "./components/SplitPane";
export {
  type PaneSize,
  type SizedPane,
  type SplitOrientation,
  clampSize,
  resolveLimits,
  resolveSize,
  type SplitLimits,
} from "./components/splitSize";

export { TreeView, type TreeViewProps } from "./components/TreeView";
export {
  type TreeKeyAction,
  type TreeNode,
  type TreeRow,
  ancestorIds,
  parentIds,
  treeKeyAction,
  visibleRows,
} from "./components/treeModel";

export {
  DEFAULT_SPEEDS,
  PlaybackBar,
  type PlaybackBarProps,
  type PlaybackMarker,
} from "./components/PlaybackBar";
export {
  type AdvanceResult,
  advance,
  clampIndex,
  createPlayhead,
  formatSeconds,
  type Playhead,
} from "./components/playhead";
export {
  type PlaybackClockOptions,
  usePlaybackClock,
  usePlayhead,
  usePlayheadTimeline,
} from "./components/usePlayback";

export { FileDrop, type FileDropProps, type PathSource } from "./components/FileDrop";
export { acceptsFile, acceptsPath, collectDroppedFiles, type DropEntry } from "./components/dropFiles";

export {
  SequenceNavigator,
  type SequenceItem,
  type SequenceItemStatus,
  type SequenceNavigatorProps,
} from "./components/SequenceNavigator";
export { stepIndex } from "./components/sequence";

// Notifications moved to `@vitavision/ui` (a second app needed them). These are re-exports of
// the same bindings, so there is still one default store; prefer importing from `@vitavision/ui`.
export {
  createToastStore,
  defaultToastStore,
  Toaster,
  toast,
  type ToasterProps,
  type ToastOptions,
  type ToastRecord,
  type ToastStore,
  type ToastTone,
} from "@vitavision/ui";
