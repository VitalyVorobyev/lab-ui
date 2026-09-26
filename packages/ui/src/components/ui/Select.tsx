/*
 * A picker with a list you can actually see.
 *
 * A native `<select>` cannot style its option list on macOS, so the popup arrives in the OS
 * palette in the middle of an otherwise deliberate instrument panel, and it cannot render a
 * two-line option or a disabled one with a reason.
 *
 * The one contract worth reading before changing this: **`""` means unset.** Radix reserves
 * the empty string internally -- an `Item` may not carry it -- so an explicit "use the
 * default" entry travels under a sentinel and is mapped back at the boundary. Callers only
 * ever see `""`.
 */

import * as RadixSelect from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";

import { useFieldDescription } from "./Field";
import { cn, focusRingInset } from "./cn";

const UNSET_SENTINEL = "__unset__";

/** One entry of a `Select`'s list. */
export type SelectOption = {
  /** What `onValueChange` reports. Must not be `""`, which means unset. */
  value: string;
  /** What the list and the trigger show. */
  label: string;
  /** Shown quietly after the label -- a strategy, a count, a reason it is unavailable. */
  note?: string;
  /** Shown but not choosable; say why in `note`. */
  disabled?: boolean;
};

/**
 * A picker whose option list is styled with the app, with room for a quiet note per option.
 *
 * Controlled, and **`""` means unset**: the trigger then shows `placeholder`, and the
 * `unsetLabel` entry (when given) reports `""`. The trigger carries Radix's `data-state`
 * (`open`/`closed`), `data-placeholder` while unset and `data-disabled`; inside a `Field` it
 * is described by the field's description and error.
 */
export function Select({
  value,
  onValueChange,
  options,
  placeholder = "Choose…",
  unsetLabel,
  disabled = false,
  "aria-label": ariaLabel,
  "aria-describedby": ownDescribedBy,
  className,
}: {
  /** The chosen option's value, or `""` for unset. */
  value: string;
  /** Called with the chosen value, or `""` for the unset entry. */
  onValueChange: (value: string) => void;
  /** The list, in order. */
  options: SelectOption[];
  /** Shown on the trigger while the value is unset. Defaults to "Choose…". */
  placeholder?: string | undefined;
  /** When given, adds a leading entry that returns the field to unset. */
  unsetLabel?: string | undefined;
  /** Blocks the trigger. */
  disabled?: boolean | undefined;
  /** Names the trigger, where no `<label>` does. */
  "aria-label"?: string | undefined;
  /** Ids of elements describing the trigger, merged with a surrounding `Field`'s. */
  "aria-describedby"?: string | undefined;
  /** Merged with the trigger's own classes through `cn`. */
  className?: string | undefined;
}) {
  const [open, setOpen] = useState(false);
  const described = useFieldDescription(ownDescribedBy);

  return (
    <RadixSelect.Root
      // Controlled for its whole lifetime: Radix treats `value=""` as "no selection" and shows
      // the placeholder, which is exactly this component's unset.
      value={value}
      onValueChange={(next) => onValueChange(next === UNSET_SENTINEL ? "" : next)}
      open={open}
      onOpenChange={setOpen}
      disabled={disabled}
    >
      <RadixSelect.Trigger
        aria-label={ariaLabel}
        {...described}
        // While the list is open Radix hides everything outside it from assistive technology
        // (`aria-hidden`), this trigger included; a hidden element must not stay in the tab
        // order. Focus returns to it on close all the same.
        tabIndex={open ? -1 : undefined}
        className={cn(
          "flex h-8 w-full items-center justify-between gap-2 rounded-control border border-line-strong bg-raised px-2.5 text-sm text-fg",
          "transition-colors hover:border-fg-subtle",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "data-[placeholder]:text-fg-subtle",
          focusRingInset,
          className,
        )}
      >
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon className="shrink-0 text-fg-subtle">
          <ChevronDown className="size-3.5" />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>

      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={4}
          className={cn(
            "z-50 max-h-72 min-w-(--radix-select-trigger-width) overflow-hidden",
            "rounded-panel border border-line bg-overlay shadow-lg shadow-black/25",
          )}
        >
          <RadixSelect.Viewport className="p-1">
            {unsetLabel !== undefined && (
              <SelectItem value={UNSET_SENTINEL} label={unsetLabel} muted />
            )}
            {options.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
                label={option.label}
                note={option.note}
                disabled={option.disabled}
              />
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}

function SelectItem({
  value,
  label,
  note,
  disabled,
  muted = false,
}: {
  value: string;
  label: string;
  note?: string | undefined;
  disabled?: boolean | undefined;
  muted?: boolean;
}) {
  return (
    <RadixSelect.Item
      value={value}
      disabled={disabled ?? false}
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-control py-1.5 pr-2 pl-7 text-sm outline-none select-none",
        "data-highlighted:bg-raised data-highlighted:text-fg",
        "data-disabled:pointer-events-none data-disabled:opacity-45",
        muted ? "text-fg-muted" : "text-fg",
      )}
    >
      <RadixSelect.ItemIndicator className="absolute left-2 text-signal">
        <Check className="size-3.5" />
      </RadixSelect.ItemIndicator>
      <RadixSelect.ItemText>{label}</RadixSelect.ItemText>
      {note && <span className="ml-auto font-mono text-xs text-fg-subtle">{note}</span>}
    </RadixSelect.Item>
  );
}
