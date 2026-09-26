/**
 * Class composition, and the shared focus treatment.
 *
 * A naive primitive *appends* the caller's `className` to its own base string, so
 * `<Button className="px-6">` produces `px-3 … px-6` and wins or loses on source order
 * rather than on intent. `twMerge` resolves that by conflict group: the caller's `px-6`
 * replaces the base `px-3` and leaves everything else alone.
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Compose class names: `clsx` for the conditionals, then `tailwind-merge` so a later class
 * replaces an earlier one of the same conflict group (the caller's `px-6` beats the base
 * `px-3`). Every primitive merges its caller's `className` through this.
 *
 * @param inputs - Class values: strings, arrays, and `{ class: condition }` records.
 * @returns One class string with conflicts resolved.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * One focus treatment for every interactive element in the design system.
 *
 * `outline` rather than `ring` because an outline follows the element's own border-radius
 * and needs no offset *colour* -- a ring offset has to know which surface it sits on, and
 * these primitives are used on `ground`, `surface` and `raised` alike.
 *
 * `focus-visible` rather than `focus`, so a mouse click does not leave a ring behind.
 */
export const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal";

/**
 * The focus treatment for controls whose own box is the hit target, where an offset ring
 * would clip: the same outline as {@link focusRing}, drawn with no offset.
 */
export const focusRingInset = "focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-signal";
