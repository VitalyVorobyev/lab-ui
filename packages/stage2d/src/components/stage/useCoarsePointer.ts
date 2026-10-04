/**
 * Whether the device's primary pointer is coarse (a finger), for sizing a press target that
 * must exist before any pointer event says which pointer is coming.
 */

import { useSyncExternalStore } from "react";

const QUERY = "(pointer: coarse)";

function mediaList(): MediaQueryList | null {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(QUERY) : null;
}

function subscribe(onChange: () => void): () => void {
  const list = mediaList();
  list?.addEventListener("change", onChange);
  return () => list?.removeEventListener("change", onChange);
}

const snapshot = () => mediaList()?.matches ?? false;

/**
 * Whether `(pointer: coarse)` matches: the primary pointer is a finger. `false` on the server
 * and wherever `matchMedia` is missing.
 *
 * @returns `true` on a touch-first device.
 */
export function useCoarsePointer(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
