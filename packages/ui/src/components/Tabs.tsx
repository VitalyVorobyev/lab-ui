/*
 * A tab strip.
 *
 * The count is set in mono beside the label rather than in parentheses inside it: it is a
 * quantity -- how many overrides sit behind an options tab, how many samples a filter chip
 * covers -- and mono makes it read as one at a glance.
 */

import type { KeyboardEvent } from "react";

import { cn, focusRing } from "./ui/cn";

/** One tab of a `Tabs` strip. */
export interface TabItem<Id extends string> {
  /** Identifies the tab to `active` and `onSelect`. Unique within the strip. */
  id: Id;
  /** The tab's text, and its accessible name. */
  label: string;
  /** Shown after the label, for the chips that carry a row or override count. */
  count?: number;
  /** Shown but not selectable, and skipped by the arrow keys. */
  disabled?: boolean;
  /** Why this tab has nothing to show, for a reader wondering what they missed. */
  title?: string;
}

const NEXT_KEYS: Record<string, (index: number, length: number) => number> = {
  ArrowRight: (index, length) => (index + 1) % length,
  ArrowLeft: (index, length) => (index - 1 + length) % length,
  Home: () => 0,
  End: (_, length) => length - 1,
};

/**
 * A tab strip (`role="tablist"`): the caller renders the panel for the `active` tab.
 *
 * Keyboard: one tab stop for the whole strip (the active tab); ←/→ move to the previous or
 * next enabled tab and select it, Home/End to the first and last. Each tab carries
 * `data-state` (`active`/`inactive`). Pass `idPrefix` to wire the tabs to the panel: the tab
 * for `id` gets the element id `<idPrefix>-tab-<id>` and the active tab gets
 * `aria-controls="<idPrefix>-panel-<id>"`, so render the panel as a `role="tabpanel"` element
 * with the id `<idPrefix>-panel-<active>` and `aria-labelledby="<idPrefix>-tab-<active>"`.
 */
export function Tabs<Id extends string>({
  items,
  active,
  onSelect,
  label,
  idPrefix,
  className,
}: {
  /** The tabs, in order. */
  items: TabItem<Id>[];
  /** The selected tab's id. */
  active: Id;
  /** Called with a tab's id when it is clicked or reached with the arrow keys. */
  onSelect: (id: Id) => void;
  /** Names the tab list. */
  label: string;
  /** Prefix for the tab and panel element ids; enables `aria-controls` (see above). */
  idPrefix?: string | undefined;
  /** Merged with the strip's own classes through `cn`. */
  className?: string | undefined;
}) {
  const enabled = items.filter((item) => !item.disabled);
  // The one tab stop: the active tab, or the first enabled one when the active tab is
  // disabled or not in the list.
  const focusable = enabled.some((item) => item.id === active) ? active : enabled[0]?.id;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const move = NEXT_KEYS[event.key];
    const target = event.target as HTMLElement;
    const current = enabled.findIndex((item) => item.id === target.dataset["tabId"]);
    if (move === undefined || current === -1) return;
    event.preventDefault();
    const next = enabled[move(current, enabled.length)];
    if (next === undefined) return;
    const tabs = event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]');
    for (const tab of tabs) if (tab.dataset["tabId"] === next.id) tab.focus();
    if (next.id !== active) onSelect(next.id);
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      aria-orientation="horizontal"
      onKeyDown={onKeyDown}
      className={cn(
        "inline-flex max-w-full flex-wrap items-center gap-0.5 rounded-control border border-line bg-raised p-0.5",
        className,
      )}
    >
      {items.map((item) => {
        const selected = item.id === active;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={idPrefix === undefined ? undefined : `${idPrefix}-tab-${item.id}`}
            aria-selected={selected}
            aria-controls={
              idPrefix !== undefined && selected ? `${idPrefix}-panel-${item.id}` : undefined
            }
            tabIndex={item.id === focusable ? 0 : -1}
            data-tab-id={item.id}
            data-state={selected ? "active" : "inactive"}
            disabled={item.disabled}
            title={item.title}
            onClick={() => onSelect(item.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-[0.3rem] px-2.5 py-1 text-xs font-medium transition-colors",
              "disabled:cursor-not-allowed disabled:opacity-40",
              selected
                ? "bg-surface text-fg shadow-sm"
                : "text-fg-muted hover:text-fg",
              focusRing,
            )}
          >
            {item.label}
            {item.count !== undefined && item.count > 0 && (
              <span
                className={cn(
                  "rounded-full px-1.5 font-mono text-[10px] tabular-nums",
                  selected ? "bg-signal/15 text-signal" : "bg-line text-fg-muted",
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
