/*
 * A menu of commands or toggles behind a trigger: a layers menu, an overflow menu.
 *
 * Use it for things a person *does* or *switches*. To pick one value from a set use `Select`,
 * or a `Listbox` in a `Popover` when the options need more than a label.
 */

import * as RadixMenu from "@radix-ui/react-dropdown-menu";
import { Check } from "lucide-react";
import type { ReactNode } from "react";

import { Kbd } from "./Kbd";
import { cn } from "./cn";

/** Props of `DropdownMenu`. */
export interface DropdownMenuProps {
  /** The element that opens it: one focusable element that accepts a ref (Radix `asChild`). */
  trigger: ReactNode;
  /** `MenuItem`, `MenuCheckboxItem`, `MenuLabel` and `MenuSeparator` elements. */
  children: ReactNode;
  /** Controlled open state. */
  open?: boolean | undefined;
  /** Called when it opens or closes. */
  onOpenChange?: ((open: boolean) => void) | undefined;
  /** Its alignment along the trigger. Defaults to `start`. */
  align?: "start" | "center" | "end" | undefined;
  /** The trigger's side it opens on. Defaults to `bottom`. */
  side?: "top" | "right" | "bottom" | "left" | undefined;
  /** Merged with the menu's own classes through `cn`. */
  className?: string | undefined;
}

/**
 * A menu (`role="menu"`) that opens from `trigger`, with arrow-key navigation, typeahead,
 * Escape or a press outside to close, and focus returned to the trigger. It is non-modal: the
 * page behind stays readable and operable. Toggling a `MenuCheckboxItem` keeps the menu open,
 * so several layers can be switched in one visit.
 */
export function DropdownMenu({
  trigger,
  children,
  open,
  onOpenChange,
  align = "start",
  side = "bottom",
  className,
}: DropdownMenuProps) {
  return (
    <RadixMenu.Root
      // Non-modal: a modal menu hides the rest of the page from assistive technology while
      // its trigger stays focusable under it, and a layers menu is used next to the canvas
      // it controls.
      modal={false}
      {...(open === undefined ? {} : { open })}
      {...(onOpenChange === undefined ? {} : { onOpenChange })}
    >
      <RadixMenu.Trigger asChild>{trigger}</RadixMenu.Trigger>
      <RadixMenu.Portal>
        <RadixMenu.Content
          side={side}
          align={align}
          sideOffset={6}
          collisionPadding={8}
          className={cn(
            "z-50 min-w-44 rounded-panel border border-line bg-overlay p-1 text-sm text-fg shadow-lg shadow-black/25",
            className,
          )}
        >
          {children}
        </RadixMenu.Content>
      </RadixMenu.Portal>
    </RadixMenu.Root>
  );
}

const itemClasses = cn(
  "relative flex h-7 cursor-default items-center gap-2 rounded-control pr-2 pl-7 text-sm outline-none select-none",
  "data-[highlighted]:bg-raised data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
);

/** Props of `MenuItem`. */
export interface MenuItemProps {
  /** The item's text. */
  children: ReactNode;
  /** Runs the command. */
  onSelect?: (() => void) | undefined;
  /** An icon before the text, in the indicator column. */
  icon?: ReactNode;
  /** `defect` for a destructive command. */
  tone?: "defect" | undefined;
  /** A shortcut shown at the end of the row, as a `Kbd`. Display only: binding it is the app's. */
  shortcut?: string | undefined;
  /** Blocks the item. */
  disabled?: boolean | undefined;
}

/**
 * A command. `onSelect` runs when it is clicked or chosen with Enter, and the menu then
 * closes. `tone="defect"` marks a destructive command.
 */
export function MenuItem({ children, onSelect, shortcut, disabled, icon, tone }: MenuItemProps) {
  return (
    <RadixMenu.Item
      {...(disabled === undefined ? {} : { disabled })}
      onSelect={() => onSelect?.()}
      className={cn(itemClasses, tone === "defect" && "text-defect")}
    >
      {icon && (
        <span aria-hidden className="absolute left-2 flex size-3.5 items-center [&>svg]:size-3.5">
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {shortcut && <Kbd>{shortcut}</Kbd>}
    </RadixMenu.Item>
  );
}

/** Props of `MenuCheckboxItem`. */
export interface MenuCheckboxItemProps {
  /** The item's text. */
  children: ReactNode;
  /** Whether it is on. */
  checked: boolean;
  /** Called with the new state. */
  onCheckedChange: (checked: boolean) => void;
  /** A shortcut shown at the end of the row, as a `Kbd`. Display only: binding it is the app's. */
  shortcut?: string | undefined;
  /** Blocks the item. */
  disabled?: boolean | undefined;
}

/**
 * A toggle (`role="menuitemcheckbox"`): a layer on or off. A check marks it on. Choosing it
 * leaves the menu open.
 */
export function MenuCheckboxItem({
  children,
  checked,
  onCheckedChange,
  shortcut,
  disabled,
}: MenuCheckboxItemProps) {
  return (
    <RadixMenu.CheckboxItem
      checked={checked}
      onCheckedChange={onCheckedChange}
      {...(disabled === undefined ? {} : { disabled })}
      // A toggle in a menu of toggles: keep the menu open for the next one.
      onSelect={(event) => event.preventDefault()}
      className={itemClasses}
    >
      <RadixMenu.ItemIndicator className="absolute left-2 flex items-center text-signal">
        <Check className="size-3.5" aria-hidden />
      </RadixMenu.ItemIndicator>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {shortcut && <Kbd>{shortcut}</Kbd>}
    </RadixMenu.CheckboxItem>
  );
}

/** A heading over a group of items, in the eyebrow role. Not focusable. */
export function MenuLabel({
  children,
}: {
  /** The heading. */
  children: ReactNode;
}) {
  return (
    <RadixMenu.Label className="px-2 pt-1.5 pb-1 text-[11px] font-semibold tracking-wider text-fg-muted uppercase">
      {children}
    </RadixMenu.Label>
  );
}

/** A divider between groups of items. */
export function MenuSeparator() {
  return <RadixMenu.Separator className="my-1 h-px bg-line" />;
}
