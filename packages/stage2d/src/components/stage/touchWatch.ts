/**
 * Watching a touch without claiming it.
 *
 * A layer that claims a touch (`stopPropagation` plus pointer capture) takes it from the stage,
 * so a second finger can no longer pinch and a drag can no longer pan. A layer that only wants
 * to know whether the touch was a tap leaves the press alone and follows its pointer on
 * `window`, where the moves and the release arrive whoever captured the pointer.
 */

import { TAP_SLOP, isTap } from "./gesture";

/** What a watched touch reports. */
export interface TouchWatch {
  /** The finger has left the tap slop, and moved again. Not called for a finger that stays put. */
  onMove?: ((event: PointerEvent) => void) | undefined;
  /**
   * The finger lifted. `moved` is whether it ever left the tap slop; `tap` whether it was a
   * tap (it stayed put and was quick).
   */
  onEnd: (event: PointerEvent, moved: boolean, tap: boolean) => void;
  /** The browser took the touch (`pointercancel`), a second finger landed, or the watch was cancelled. */
  onCancel?: (() => void) | undefined;
}

/** The press a watch begins from. */
export interface TouchOrigin {
  /** `PointerEvent.pointerId`. */
  pointerId: number;
  /** Client x of the press. */
  clientX: number;
  /** Client y of the press. */
  clientY: number;
  /** `PointerEvent.timeStamp` of the press. */
  timeStamp: number;
}

/**
 * Follow one touch on `window` until it lifts. A second touch landing, or `pointercancel`,
 * cancels the watch and leaves the touches to the stage.
 *
 * @param origin - The `pointerdown` of the touch.
 * @param watch - What to report.
 * @returns A function that cancels the watch (calling `onCancel`); a no-op once it has ended.
 */
export function watchTouch(origin: TouchOrigin, watch: TouchWatch): () => void {
  const id = origin.pointerId;
  let moved = false;
  let done = false;
  const travel = (e: PointerEvent) => Math.hypot(e.clientX - origin.clientX, e.clientY - origin.clientY);

  const stop = () => {
    done = true;
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", cancelEvent);
    window.removeEventListener("pointerdown", other);
  };
  const cancel = () => {
    if (done) return;
    stop();
    watch.onCancel?.();
  };
  function move(e: PointerEvent) {
    if (e.pointerId !== id) return;
    if (!moved && travel(e) > TAP_SLOP) moved = true;
    if (moved) watch.onMove?.(e);
  }
  function up(e: PointerEvent) {
    if (e.pointerId !== id) return;
    stop();
    if (!moved && travel(e) > TAP_SLOP) moved = true;
    watch.onEnd(e, moved, isTap(moved ? Infinity : travel(e), e.timeStamp - origin.timeStamp));
  }
  function cancelEvent(e: PointerEvent) {
    if (e.pointerId === id) cancel();
  }
  function other(e: PointerEvent) {
    if (e.pointerId !== id && e.pointerType === "touch") cancel();
  }
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", cancelEvent);
  window.addEventListener("pointerdown", other);
  return cancel;
}
