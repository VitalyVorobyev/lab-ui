/*
 * Pick one of a list of options that need more than a label: a frame with its thumbnail and
 * size, a model with its point counts.
 *
 * `Select` is the compact choice of a value by name. A `Listbox` shows its options in place —
 * on its own in a panel, or inside a `Popover` behind a trigger — and each option can render
 * whatever identifies it.
 */

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { cn, focusRing } from "./cn";
import { moveActive, nearestEnabled, type ListboxKey } from "./listboxModel";

/** One option of a `Listbox`. */
export interface ListboxOption {
  /** Its value, unique in the list. */
  value: string;
  /** Its name: the default rendering, and what a screen reader announces. */
  label: string;
  /** A second line under the label, in the default rendering. */
  description?: string | undefined;
  /** Shown but not choosable. */
  disabled?: boolean | undefined;
}

/** What `renderOption` is told about an option. */
export interface ListboxOptionState {
  /** It is the value. */
  selected: boolean;
  /** It has the keyboard cursor or the pointer. */
  active: boolean;
}

/** Props of `Listbox`. */
export interface ListboxProps {
  /** The options, in order. */
  options: readonly ListboxOption[];
  /** The selected value, or `null` for none. */
  value: string | null;
  /** Called with the value of the option chosen by click, Enter or Space. */
  onValueChange?: ((value: string) => void) | undefined;
  /**
   * Renders an option's content (the row keeps its own padding, states and accessibility).
   * Defaults to the label, with the description under it.
   */
  renderOption?: ((option: ListboxOption, state: ListboxOptionState) => ReactNode) | undefined;
  /** Names the list. */
  "aria-label": string;
  /** Focus the list when it mounts, e.g. when it opens in a `Popover`. */
  autoFocus?: boolean | undefined;
  /** Merged with the list's own classes through `cn`. */
  className?: string | undefined;
}

const KEYS = new Set<string>(["ArrowDown", "ArrowUp", "Home", "End", "PageDown", "PageUp"]);

/**
 * A single-select list (`role="listbox"`) of options that each render their own content.
 *
 * The list is one tab stop. The arrow keys, Home, End and Page keys move the active option
 * (`aria-activedescendant`), skipping disabled ones, and Enter or Space choose it. A click
 * chooses the option under the pointer. Controlled: the caller keeps `value`. Each option
 * carries `aria-selected`, `data-selected` and `data-active`; the list scrolls the active
 * option into view.
 */
export function Listbox({
  options,
  value,
  onValueChange,
  renderOption = defaultRender,
  "aria-label": ariaLabel,
  autoFocus,
  className,
}: ListboxProps) {
  const id = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const disabled = options.map((option) => option.disabled === true);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const [active, setActive] = useState(() => nearestEnabled(disabled, Math.max(0, selectedIndex)));
  // Options can change under the list; keep the cursor on an enabled option that exists.
  const current = active >= 0 && active < options.length && !disabled[active] ? active : nearestEnabled(disabled, active);

  const optionId = (index: number) => `${id}-option-${index}`;

  const activate = (index: number) => {
    setActive(index);
    listRef.current?.querySelector(`#${CSS.escape(optionId(index))}`)?.scrollIntoView({ block: "nearest" });
  };

  const choose = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    onValueChange?.(option.value);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (KEYS.has(event.key)) {
      event.preventDefault();
      const next = moveActive(disabled, current, event.key as ListboxKey);
      if (next >= 0) activate(next);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(current);
    }
  };

  return (
    <div
      ref={listRef}
      role="listbox"
      aria-label={ariaLabel}
      tabIndex={0}
      autoFocus={autoFocus}
      aria-activedescendant={current >= 0 ? optionId(current) : undefined}
      onKeyDown={onKeyDown}
      className={cn("flex flex-col gap-px rounded-control p-0.5 outline-none", focusRing, className)}
    >
      {options.map((option, index) => {
        const selected = index === selectedIndex;
        const isActive = index === current;
        return (
          <div
            key={option.value}
            id={optionId(index)}
            role="option"
            aria-selected={selected}
            aria-disabled={option.disabled ? true : undefined}
            data-selected={selected ? "" : undefined}
            data-active={isActive ? "" : undefined}
            onPointerMove={() => {
              if (!option.disabled && !isActive) setActive(index);
            }}
            onClick={() => choose(index)}
            className={cn(
              "flex min-w-0 cursor-default items-center gap-2 rounded-control px-2 py-1 text-sm text-fg",
              // Selected is a bar on the leading edge plus the accent text; active (keyboard
              // cursor or pointer) is the raised fill. The two can coincide and each stays
              // visible, and neither puts muted text on a tint it fails contrast on.
              "data-[selected]:text-signal data-[selected]:shadow-[inset_2px_0_0_var(--color-signal)]",
              "data-[active]:bg-raised",
              option.disabled && "opacity-50",
            )}
          >
            {renderOption(option, { selected, active: isActive })}
          </div>
        );
      })}
    </div>
  );
}

function defaultRender(option: ListboxOption) {
  return (
    <span className="flex min-w-0 flex-col">
      <span className="truncate">{option.label}</span>
      {option.description && <span className="truncate text-xs text-fg-muted">{option.description}</span>}
    </span>
  );
}
