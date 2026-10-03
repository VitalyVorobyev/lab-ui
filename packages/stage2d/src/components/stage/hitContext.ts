/**
 * The context an `ImageStage` provides its layers' hit registry through. Its own module so
 * that `ImageStage` (which provides it) and `useStageHitTest` (which reads it, and reads
 * `useStage` from `ImageStage`) do not import each other.
 */

import { createContext } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import type { HitRegistry } from "./hitTest";

/** The press event a layer's `press` handler receives. */
export type StagePointerEvent = ReactPointerEvent<Element>;

/** The enclosing stage's registry, or `null` outside a stage. */
export const StageHitContext = createContext<HitRegistry<StagePointerEvent> | null>(null);
