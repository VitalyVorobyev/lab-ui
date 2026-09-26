/*
 * Which of the two palettes is on screen.
 *
 * Judging an anomaly map, or a measurement overlay drawn over a low-contrast part, against
 * a bright room and against a dark one are different tasks, and a researcher switches
 * between them within a session -- so dark mode is a real, storable choice here rather than
 * only `prefers-color-scheme`.
 *
 * Three states, not two. "system" is a real choice and has to survive a reload as itself,
 * otherwise the first time the OS flips at sunset the app disagrees with everything else on
 * the machine and there is no way back to following it.
 *
 * The class is applied to <html> rather than <body> so the page background painted before
 * React mounts is already correct. `applyTheme` (below, as `paint`) has to be duplicated as
 * an inline script in the consumer's `index.html` for exactly that reason -- see the
 * package README for the exact snippet, and keep it in agreement with this module if either
 * changes.
 */

/**
 * A stored theme preference: a palette, or `system` to follow the OS
 * (`prefers-color-scheme`) and keep following it.
 */
export type ThemeChoice = "light" | "dark" | "system";

/**
 * The `localStorage` key a consumer's theme choice is kept under.
 *
 * Every function here takes it as an optional last argument and defaults to this constant,
 * so a single app needs to pass nothing, while two apps sharing a browser profile -- or one
 * app that wants a namespaced key -- can each choose their own without stepping on the
 * other's stored preference.
 */
export const DEFAULT_THEME_STORAGE_KEY = "vitavision-theme";

// Every DOM access here is inside a function, and guarded: this module is imported on the
// server too.
const query = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;

/**
 * The stored preference.
 *
 * @param storageKey - The `localStorage` key. Defaults to `DEFAULT_THEME_STORAGE_KEY`.
 * @returns The stored choice, or `system` when nothing valid is stored or storage cannot be
 *   read (private browsing, the server).
 */
export function readThemeChoice(storageKey: string = DEFAULT_THEME_STORAGE_KEY): ThemeChoice {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    // Private browsing, or a WebView with storage disabled. Following the OS is a fine
    // answer to "I could not read your preference", and better than refusing to render.
  }
  return "system";
}

/**
 * What `choice` actually resolves to right now.
 *
 * @param choice - The preference.
 * @returns `choice` itself for `light`/`dark`; for `system`, the OS palette (`light` where
 *   it cannot be queried).
 */
export function resolveTheme(choice: ThemeChoice): "light" | "dark" {
  if (choice !== "system") return choice;
  return query()?.matches ? "dark" : "light";
}

function paint(choice: ThemeChoice): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", resolveTheme(choice) === "dark");
}

/**
 * Store a preference and paint it (the `dark` class on `<html>`).
 *
 * @param choice - The new preference.
 * @param storageKey - The `localStorage` key. Defaults to `DEFAULT_THEME_STORAGE_KEY`.
 */
export function setThemeChoice(
  choice: ThemeChoice,
  storageKey: string = DEFAULT_THEME_STORAGE_KEY,
): void {
  try {
    window.localStorage.setItem(storageKey, choice);
  } catch {
    // Not worth failing the click over; the choice still applies for this session.
  }
  paint(choice);
}

/**
 * Paint the stored choice and keep following the OS while the choice is "system".
 *
 * @param storageKey - The `localStorage` key. Defaults to `DEFAULT_THEME_STORAGE_KEY`.
 * @returns An unsubscribe, so a test can tear the listener down; a long-lived app never does.
 */
export function initTheme(storageKey: string = DEFAULT_THEME_STORAGE_KEY): () => void {
  paint(readThemeChoice(storageKey));

  const media = query();
  if (media === null) return () => {};

  const onSystemChange = () => {
    if (readThemeChoice(storageKey) === "system") paint("system");
  };
  media.addEventListener("change", onSystemChange);
  return () => media.removeEventListener("change", onSystemChange);
}
