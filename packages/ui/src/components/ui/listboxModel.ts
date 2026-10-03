/*
 * Keyboard movement in a single-select listbox, as a pure function so it is tested without a
 * DOM. `Listbox` calls it on every key press.
 */

/** The keys that move the active option. */
export type ListboxKey = "ArrowDown" | "ArrowUp" | "Home" | "End" | "PageDown" | "PageUp";

/**
 * The option a key moves the active one to, skipping disabled options.
 *
 * Arrows move by one and stop at the ends (no wrap: a long list that wraps loses its place).
 * Home and End go to the first and last enabled option. Page keys move by `page` options.
 * From no active option (`-1`), Down and Page Down go to the first enabled option, and Up and
 * Page Up to the last.
 *
 * @param disabled - Per option, whether it is disabled.
 * @param from - The active index, or -1.
 * @param key - The key pressed.
 * @param page - Options per page, for Page Up/Down. Defaults to 10.
 * @returns The new active index; `from` when there is nowhere to go; -1 when every option is
 *   disabled.
 */
export function moveActive(
  disabled: readonly boolean[],
  from: number,
  key: ListboxKey,
  page = 10,
): number {
  const enabled = disabled.flatMap((off, index) => (off ? [] : [index]));
  if (enabled.length === 0) return -1;
  const first = enabled[0]!;
  const last = enabled[enabled.length - 1]!;
  if (key === "Home") return first;
  if (key === "End") return last;
  if (from < 0) return key === "ArrowDown" || key === "PageDown" ? first : last;

  const forward = key === "ArrowDown" || key === "PageDown";
  const steps = key === "PageDown" || key === "PageUp" ? Math.max(1, page) : 1;
  let target = from;
  let moved = 0;
  for (let index = from + (forward ? 1 : -1); index >= 0 && index < disabled.length; index += forward ? 1 : -1) {
    if (disabled[index]) continue;
    target = index;
    moved += 1;
    if (moved === steps) break;
  }
  return target;
}

/**
 * The first enabled option at or after `index`, or before it when none is after. Used to place
 * the active option when the list opens or changes.
 *
 * @param disabled - Per option, whether it is disabled.
 * @param index - The preferred index.
 * @returns An enabled index, or -1 when every option is disabled.
 */
export function nearestEnabled(disabled: readonly boolean[], index: number): number {
  for (let i = Math.max(0, index); i < disabled.length; i += 1) if (!disabled[i]) return i;
  for (let i = Math.min(index, disabled.length) - 1; i >= 0; i -= 1) if (!disabled[i]) return i;
  return -1;
}
