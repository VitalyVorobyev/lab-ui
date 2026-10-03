/**
 * The overlay grammar's roles and states (docs/visual-language.md §5), for layers that paint
 * through SVG attributes rather than class names.
 */

/**
 * What an overlay mark is.
 * - `feature`: detected or observed (corners, edges, contours).
 * - `model`: predicted (reprojections, fitted geometry).
 * - `structure`: context (a board outline, grid lines).
 * - `selection`: the selected item.
 * - `label`: ids and text.
 * - `halo`: the dark band under every stroke and label, so a mark holds on any image.
 */
export type OverlayRole = "feature" | "model" | "structure" | "selection" | "label" | "halo";

/**
 * A mark's interaction state.
 * - `default` is drawn 1.5 screen px wide.
 * - `hover` is 2 px, and nothing else changes.
 * - `selected` is 2.5 px with a ring in the selection colour.
 * - `dimmed` is 35 % opacity.
 */
export type OverlayState = "default" | "hover" | "selected" | "dimmed";

/** The roles, in the order the spec lists them. */
export const OVERLAY_ROLES: readonly OverlayRole[] = ["feature", "model", "structure", "selection", "label", "halo"];

/**
 * The CSS paint for a role: a `var(--stage-…)` reference defined by `@vitavision/stage2d/styles.css`.
 *
 * @param role - The role.
 * @returns A CSS value usable as an SVG `stroke` or `fill`.
 */
export function overlayRole(role: OverlayRole): string {
  return `var(--stage-${role})`;
}

/** Screen-pixel stroke widths for each state, before the stage's scale is applied. */
export const OVERLAY_STATE_WIDTH: Readonly<Record<OverlayState, number>> = {
  default: 1.5,
  hover: 2,
  selected: 2.5,
  dimmed: 1.5,
};

/** Opacity for each state. */
export const OVERLAY_STATE_OPACITY: Readonly<Record<OverlayState, number>> = {
  default: 1,
  hover: 1,
  selected: 1,
  dimmed: 0.35,
};
