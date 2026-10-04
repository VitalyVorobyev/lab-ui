/**
 * Scene invalidation. `SensorImage` redraws only when something changed; a change it cannot
 * see for itself — a mesh attached to or removed from the scene, a material recoloured —
 * reaches it through {@link invalidateScene}, keyed by the scene's `FrameTreeRuntime`.
 */

import type { FrameTreeRuntime } from "@vitavision/three";
import { useCallback } from "react";

import { useFrameTree } from "./FrameTree";

// Keyed weakly, so a runtime dropped with its scene takes its listeners with it.
const listeners = new WeakMap<FrameTreeRuntime, Set<() => void>>();

/**
 * Tell every view that draws `runtime`'s scene on demand (`SensorImage`) to redraw. Call it
 * after changing the scene outside React: adding or removing objects, changing materials or
 * textures. Poses set by the playhead need no call.
 */
export function invalidateScene(runtime: FrameTreeRuntime): void {
  for (const listener of [...(listeners.get(runtime) ?? [])]) listener();
}

/** Call `listener` on every {@link invalidateScene} of `runtime`. Returns the unsubscribe function. */
export function onSceneInvalidate(runtime: FrameTreeRuntime, listener: () => void): () => void {
  let set = listeners.get(runtime);
  if (!set) {
    set = new Set();
    listeners.set(runtime, set);
  }
  set.add(listener);
  return () => {
    set.delete(listener);
  };
}

/**
 * {@link invalidateScene} for the enclosing `FrameTree`'s runtime, as a stable function: call it
 * from an effect after changing that scene outside React. Must be used inside a `FrameTree`.
 */
export function useSceneInvalidate(): () => void {
  const runtime = useFrameTree();
  return useCallback(() => invalidateScene(runtime), [runtime]);
}
