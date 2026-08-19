/**
 * The verdict vocabulary, for the components that paint outside of `className`.
 *
 * Every Tailwind-driven primitive under `components/ui` reaches the palette through a
 * class name, which only works where Tailwind's own build sees the class. `MeasureOverlay`
 * and `LineProfile` paint through raw SVG `stroke`/`fill` attributes instead — a caliper
 * box or an edge mark is drawn from data the consumer supplies at runtime, not from a
 * fixed set of class names a bundler can scan for. So these two read the same five tokens
 * `styles.css` defines (`--signal`, `--normal`, `--defect`, `--warn`, `--fg-subtle`)
 * directly as CSS custom properties, which resolves correctly in both themes without
 * needing Tailwind involved in the overlay's own render path at all.
 */

/**
 * Named `MeasureTone` rather than `Tone` — `components/ui/Badge.tsx` already owns that name
 * for the verdict-badge vocabulary (`neutral`/`normal`/`defect`/`unlabeled`/`warning`/
 * `info`), and both are re-exported from the package root, where two types of the same name
 * would collide.
 */
export type MeasureTone = "signal" | "normal" | "defect" | "warn" | "muted";

const TONE_VAR: Record<MeasureTone, string> = {
  signal: "var(--signal)",
  normal: "var(--normal)",
  defect: "var(--defect)",
  warn: "var(--warn)",
  muted: "var(--fg-subtle)",
};

/** The CSS paint value for a tone — usable directly as a `stroke`, `fill` or `color`. */
export function toneColor(tone: MeasureTone | undefined, fallback: MeasureTone = "signal"): string {
  return TONE_VAR[tone ?? fallback];
}
