/*
 * A key, as the keyboard shows it: the shortcut next to a command, the key a hint refers to.
 */

import type { ComponentProps } from "react";

import { cn } from "./cn";

/**
 * A keyboard key or chord (`F`, `⌘K`, `[`), set in mono on a raised key cap.
 *
 * Renders `<kbd>`, which screen readers announce as text. Write the key as the user's keyboard
 * labels it; for a chord, one `Kbd` with the whole chord reads better than several. Takes
 * every `<kbd>` prop, `ref` included.
 */
export function Kbd({ className, ...rest }: ComponentProps<"kbd">) {
  return (
    <kbd
      {...rest}
      className={cn(
        "inline-flex min-w-[1.5em] items-center justify-center rounded-control border border-line-strong",
        "bg-raised px-1 font-mono text-[10px] leading-4 text-fg-muted",
        className,
      )}
    />
  );
}
