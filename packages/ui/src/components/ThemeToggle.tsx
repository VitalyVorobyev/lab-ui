/*
 * The palette switch, shared by every lab app.
 *
 * Three states, not two, and cycled by one button rather than spread across a
 * segmented control: this sits in a header next to the thing the app is
 * actually about, and a control that costs one glyph is the right size for a
 * preference that is set once a session. "System" is a real state — an app that
 * silently stops following the OS the first time you touch the switch has taken
 * something away.
 *
 * Lived in visual-anomaly-lab's own `App.tsx` first. It moved here the moment a
 * second app needed it, rather than being copied: two copies of a control that
 * writes to `localStorage` is two chances to disagree about the key, the cycle
 * order, or which icon means which state.
 *
 * `storageKey` is per app on purpose — `theme.ts` takes the key as an argument
 * for the same reason. Two apps sharing a browser profile each keep their own
 * preference, and an app that already had one under its own key does not lose
 * it by adopting this component.
 */

import { Moon, Sun, SunMoon } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

import { DEFAULT_THEME_STORAGE_KEY, readThemeChoice, setThemeChoice, type ThemeChoice } from "../theme";
import { Tooltip } from "./ui/Tooltip";
import { cn, focusRing } from "./ui/cn";

const ORDER: ThemeChoice[] = ["system", "light", "dark"];
const ICON = { system: SunMoon, light: Sun, dark: Moon };
const LABEL: Record<ThemeChoice, string> = {
  system: "Theme: following the system",
  light: "Theme: light",
  dark: "Theme: dark",
};

/** Another tab (or window) changing the stored choice re-renders the toggle. */
function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

/** What the server, and a hydrating client's first render, show: no stored choice read yet. */
const serverChoice = (): ThemeChoice => "system";

/**
 * The palette switch: one button cycling system → light → dark, stored in `localStorage`
 * under `storageKey` and painted as the `dark` class on `<html>`.
 *
 * Its `aria-label` (repeated in a tooltip) names the current state; it needs a
 * `TooltipProvider` above it. The stored choice is read as an external store, so the server
 * render and the hydrating first client render agree ("system") and the stored choice
 * follows without a mismatch. The state is exposed as `data-theme-choice`.
 */
export function ThemeToggle({
  storageKey = DEFAULT_THEME_STORAGE_KEY,
  className,
}: {
  /** The `localStorage` key; per app, so two apps sharing a profile keep their own choice. */
  storageKey?: string | undefined;
  /** Merged with the button's own classes through `cn`. */
  className?: string | undefined;
}) {
  const stored = useSyncExternalStore(subscribe, () => readThemeChoice(storageKey), serverChoice);
  // What this toggle last set, so it keeps cycling even where storage is unavailable and the
  // stored value cannot follow.
  const [chosen, setChosen] = useState<{ key: string; choice: ThemeChoice } | null>(null);
  const choice = chosen?.key === storageKey ? chosen.choice : stored;

  const advance = () => {
    const next = ORDER[(ORDER.indexOf(choice) + 1) % ORDER.length]!;
    setChosen({ key: storageKey, choice: next });
    setThemeChoice(next, storageKey);
  };

  const Icon = ICON[choice];

  return (
    <Tooltip content={LABEL[choice]}>
      <button
        type="button"
        onClick={advance}
        aria-label={LABEL[choice]}
        data-theme-choice={choice}
        className={cn(
          "rounded-control p-1.5 text-fg-muted transition-colors hover:bg-raised hover:text-fg",
          focusRing,
          className,
        )}
      >
        <Icon className="size-4" />
      </button>
    </Tooltip>
  );
}
