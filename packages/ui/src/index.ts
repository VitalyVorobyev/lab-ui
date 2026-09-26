/**
 * `@vitavision/ui` — the instrument design system: tokens, theme, and the primitive set.
 *
 * Import `@vitavision/ui/styles.css` once, from the CSS entry that already has
 * `@import "tailwindcss";` — see the README for the wiring.
 *
 * @packageDocumentation
 */

export {
  DEFAULT_THEME_STORAGE_KEY,
  initTheme,
  readThemeChoice,
  resolveTheme,
  setThemeChoice,
  type ThemeChoice,
} from "./theme";

export { toneColor, type MeasureTone } from "./tone";

export { ThemeToggle } from "./components/ThemeToggle";

export * from "./components/ui";

export { Tabs, type TabItem } from "./components/Tabs";
