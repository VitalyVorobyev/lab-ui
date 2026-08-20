/**
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
import { useEffect, useState } from "react";

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

export function ThemeToggle({
  storageKey = DEFAULT_THEME_STORAGE_KEY,
  className,
}: {
  storageKey?: string;
  className?: string;
}) {
  const [choice, setChoice] = useState<ThemeChoice>("system");

  // Read after mount rather than during render: the inline script in index.html has
  // already painted the right palette, and touching localStorage during render would make
  // the first client render disagree with itself under StrictMode's double invocation.
  useEffect(() => setChoice(readThemeChoice(storageKey)), [storageKey]);

  const advance = () => {
    const next = ORDER[(ORDER.indexOf(choice) + 1) % ORDER.length]!;
    setChoice(next);
    setThemeChoice(next, storageKey);
  };

  const Icon = ICON[choice];

  return (
    <Tooltip content={LABEL[choice]}>
      <button
        type="button"
        onClick={advance}
        aria-label={LABEL[choice]}
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
