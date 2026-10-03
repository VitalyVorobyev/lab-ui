/*
 * Stepping through an ordered set, as a pure function so its edge cases (an empty set, no
 * current item, wrapping) are tested without a DOM.
 */

/**
 * The index one step from `index`.
 *
 * @param length - The number of items.
 * @param index - The current index, or -1 for none.
 * @param delta - +1 for next, -1 for previous.
 * @param wrap - Wrap from the last item to the first and back.
 * @returns The next index; the first (or, stepping back, the last) item when there is no
 *   current one; the same index at an end without `wrap`; `null` for an empty set.
 */
export function stepIndex(length: number, index: number, delta: 1 | -1, wrap = false): number | null {
  if (length <= 0) return null;
  if (index < 0 || index >= length) return delta > 0 ? 0 : length - 1;
  const next = index + delta;
  if (wrap) return (next + length) % length;
  return Math.min(length - 1, Math.max(0, next));
}
