/*
 * The keyboard shortcuts of a screen, listed for its help: the `?` dialog of a review tool, a
 * shortcuts section in a side panel.
 */

import { Fragment, useId, type ComponentProps } from "react";

import { cn } from "./cn";
import { Kbd } from "./Kbd";

/** One command and the keys that run it. */
export interface Shortcut {
  /**
   * The keys, as the keyboard labels them: each entry is one key or chord (`J`, `⇧ click`,
   * `⌘K`), and several distinct entries are alternatives (`["J", "↓"]` reads "J or ↓").
   */
  keys: readonly string[];
  /** What it does, as a short phrase ("Next tile"), unique within its group. */
  description: string;
}

/** A titled group of shortcuts ("Navigation", "Flags"). */
export interface ShortcutGroup {
  /** The group's heading, unique within the list. */
  title: string;
  /** Its shortcuts, in the order they should read. */
  shortcuts: readonly Shortcut[];
}

/** Props of `ShortcutList`. */
export type ShortcutListProps = Omit<ComponentProps<"div">, "children"> & {
  /** The groups, in the order they should read. Empty groups are left out. */
  groups: readonly ShortcutGroup[];
};

/**
 * The keyboard shortcuts of a screen as titled groups: each row a command's keys, as `Kbd`
 * caps, beside what it does. Groups flow into two columns where there is room.
 *
 * It only lists: binding the keys is the app's. Put it in a `Dialog` for a `?` help, or in a
 * panel. Each group is a `<section>` labelled by its heading, and its rows are a description
 * list, so a screen reader announces "J or ↓, Next tile".
 */
export function ShortcutList({ groups, className, ...rest }: ShortcutListProps) {
  const baseId = useId();
  return (
    <div {...rest} className={cn("grid gap-x-8 gap-y-4 sm:grid-cols-2", className)}>
      {groups.map((group, g) =>
        group.shortcuts.length === 0 ? null : (
          <section key={group.title} aria-labelledby={`${baseId}-${g}`} className="min-w-0">
            <h3 id={`${baseId}-${g}`} className="mb-1.5 text-[11px] font-semibold tracking-wider text-fg-muted uppercase">
              {group.title}
            </h3>
            <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1 text-sm">
              {group.shortcuts.map((shortcut) => (
                <Fragment key={shortcut.description}>
                  <dt className="flex flex-wrap items-center gap-1 text-xs text-fg-muted">
                    {shortcut.keys.map((key, k) => (
                      <Fragment key={key}>
                        {k > 0 && <span>or</span>}
                        <Kbd>{key}</Kbd>
                      </Fragment>
                    ))}
                  </dt>
                  <dd className="text-fg">{shortcut.description}</dd>
                </Fragment>
              ))}
            </dl>
          </section>
        ),
      )}
    </div>
  );
}
