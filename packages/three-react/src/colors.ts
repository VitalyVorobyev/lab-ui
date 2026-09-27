import { observeSceneColors, readSceneColors, type SceneColors } from "@vitavision/three";
import { useSyncExternalStore } from "react";

let cached: SceneColors | undefined;
const listeners = new Set<() => void>();
let stop: (() => void) | undefined;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  stop ??= observeSceneColors((colors) => {
    cached = colors;
    for (const l of listeners) l();
  });
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      stop?.();
      stop = undefined;
      cached = undefined;
    }
  };
}

function snapshot(): SceneColors {
  cached ??= readSceneColors();
  return cached;
}

/*
 * On the server there is no document to read tokens from: every colour is `gray`, as for a
 * token no stylesheet defines. Hydration starts from the same value, then reads the real ones.
 */
const SERVER_COLORS: SceneColors = Object.freeze({
  background: "gray",
  surface: "gray",
  fg: "gray",
  muted: "gray",
  line: "gray",
  lineStrong: "gray",
  signal: "gray",
  normal: "gray",
  defect: "gray",
  warn: "gray",
});
const serverSnapshot = (): SceneColors => SERVER_COLORS;

/**
 * The vitavision scene colours (`SceneColors` from `@vitavision/three`), re-read whenever the theme class on
 * the document element changes. One observer is shared by every caller. Server-safe: a
 * server render gets neutral `gray` for every colour.
 */
export function useSceneColors(): SceneColors {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
