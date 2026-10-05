/*
 * The workspaces of a studio app as a column of icons down its left edge: Library, Teach,
 * Inspect. One is current; choosing another swaps the screen.
 *
 * Each item is a button, or — through `asChild` — the app's own link element, so a router's
 * `<Link>` keeps client-side navigation and this package never imports a router.
 */

import {
  cloneElement,
  createContext,
  isValidElement,
  use,
  useId,
  useState,
  type HTMLAttributes,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from "react";

import { Tooltip, cn, focusRing } from "@vitavision/ui";

/** How a `NavRail` shows its items' labels. */
export type NavRailLabels = "visible" | "tooltip";

/** Props of `NavRail`. */
export interface NavRailProps {
  /** The current item's `value`, or `null` for none. Leave undefined to let the rail keep it. */
  value?: string | null | undefined;
  /** The current item at first, when the rail keeps it (`value` undefined). */
  defaultValue?: string | undefined;
  /** Called with an item's `value` when a person chooses an item other than the current one. */
  onValueChange?: ((value: string) => void) | undefined;
  /**
   * `"visible"` (the default) sets each label under its icon; `"tooltip"` draws icon-only
   * buttons and shows the label in a tooltip on hover or focus.
   */
  labels?: NavRailLabels | undefined;
  /** The `NavRailItem`s, in order. */
  children: ReactNode;
  /** Merged with the list's own classes through `cn`. */
  className?: string | undefined;
}

/** Props of `NavRailItem`. */
export interface NavRailItemProps {
  /** Identifies the item to the rail's `value`. Unique within the rail. */
  value: string;
  /** The item's name: its text under the icon, or its tooltip and accessible name. */
  label: string;
  /** The item's icon, decorative (`aria-hidden`): the label carries the meaning. */
  icon: ReactNode;
  /**
   * A mark on the icon's corner: a number is drawn as a count (over 99 as "99+"), anything
   * else as given. It describes the item (`aria-describedby`); it is not part of its name.
   */
  badge?: ReactNode | number;
  /** Shown but not choosable. A link item gets `aria-disabled` and its clicks are cancelled. */
  disabled?: boolean | undefined;
  /**
   * Render onto the one child element — a router's `<Link to="…" />` or an `<a href>` —
   * instead of a `<button>`. Give the child without content: the icon and label become its
   * children. Its own `className` is kept beside the item's, and its own `onClick` runs first;
   * calling `event.preventDefault()` there keeps the item from being chosen.
   */
  asChild?: boolean | undefined;
  /** With `asChild`, the one element to render as. */
  children?: ReactElement | undefined;
  /** Merged with the item's own classes through `cn`. */
  className?: string | undefined;
}

interface NavRailState {
  value: string | null;
  labels: NavRailLabels;
  choose: (value: string) => void;
}

const NavRailContext = createContext<NavRailState | null>(null);

/**
 * A vertical rail of workspaces: `NavRailItem`s as a list of buttons (or the app's links, via
 * `asChild`), one of them current. Controlled with `value` and `onValueChange`, or kept by the
 * rail from `defaultValue`.
 *
 * The current item carries `aria-current="page"` and `data-state="active"` (the others
 * `"inactive"`). Every item is its own Tab stop. The rail is a plain list with no landmark of
 * its own: `AppShell`'s `rail` slot is already a named `<nav>`, so elsewhere wrap it in a
 * `<nav aria-label="…">`.
 */
export function NavRail({ value, defaultValue, onValueChange, labels = "visible", children, className }: NavRailProps) {
  const [kept, setKept] = useState<string | null>(defaultValue ?? null);
  const current = value === undefined ? kept : value;
  const choose = (next: string) => {
    if (next === current) return;
    if (value === undefined) setKept(next);
    onValueChange?.(next);
  };

  return (
    <NavRailContext value={{ value: current, labels, choose }}>
      <ul data-labels={labels} className={cn("flex flex-col items-center gap-1 p-1.5", className)}>
        {children}
      </ul>
    </NavRailContext>
  );
}

/**
 * One workspace of a `NavRail`: an icon over its label, or an icon-only button with the label
 * in a tooltip (the rail's `labels`). A `<button>` by default; with `asChild`, the one child
 * element (the app's link) takes the item's look, `aria-current` and click.
 */
export function NavRailItem({
  value,
  label,
  icon,
  badge,
  disabled = false,
  asChild = false,
  children,
  className,
}: NavRailItemProps) {
  const rail = use(NavRailContext);
  if (rail === null) throw new Error("NavRailItem must be rendered inside a NavRail.");
  const badgeId = useId();

  const active = rail.value === value;
  const iconOnly = rail.labels === "tooltip";
  const hasBadge = badge !== undefined && badge !== null && badge !== false;

  const content = (
    <>
      <span aria-hidden className="relative grid place-items-center [&>svg]:size-4.5">
        {icon}
        {hasBadge && (
          <span
            id={badgeId}
            data-badge=""
            className={cn(
              "absolute -top-1.5 left-[calc(100%-0.375rem)]",
              typeof badge === "number" &&
                "min-w-4 rounded-full bg-signal px-1 text-center font-mono text-[10px] leading-4 text-signal-fg tabular-nums",
            )}
          >
            {typeof badge === "number" ? formatCount(badge) : badge}
          </span>
        )}
      </span>
      {!iconOnly && <span className="max-w-full truncate text-[10px] leading-tight">{label}</span>}
    </>
  );

  const shared = {
    "aria-current": active ? ("page" as const) : undefined,
    "aria-label": iconOnly ? label : undefined,
    "aria-describedby": hasBadge ? badgeId : undefined,
    "data-state": active ? "active" : "inactive",
    "data-disabled": disabled ? "" : undefined,
  };
  const classes = cn(
    "relative flex flex-col items-center justify-center gap-0.5 rounded-control text-fg-muted transition-colors",
    iconOnly ? "size-9" : "w-14 px-1 py-1.5",
    active ? "bg-signal/12 text-fg [&_svg]:text-signal" : "hover:bg-raised hover:text-fg",
    disabled && "cursor-not-allowed opacity-50 hover:bg-transparent hover:text-fg-muted",
    focusRing,
  );

  let item: ReactElement;
  if (asChild && isValidElement<ChildProps>(children)) {
    const own = children.props;
    // `@vitavision/ui` keeps its Slot to itself, and this package takes no Radix dependency of
    // its own: the one child element is cloned with the item's props merged in.
    // eslint-disable-next-line @eslint-react/no-clone-element -- the asChild merge, see above
    item = cloneElement(children, {
      ...shared,
      "aria-disabled": disabled ? true : undefined,
      className: cn(classes, className, own.className),
      onClick: (event: MouseEvent<HTMLElement>) => {
        own.onClick?.(event);
        if (disabled) {
          event.preventDefault();
          return;
        }
        if (!event.defaultPrevented) rail.choose(value);
      },
      children: content,
    });
  } else {
    item = (
      <button
        type="button"
        {...shared}
        disabled={disabled}
        onClick={() => rail.choose(value)}
        className={cn(classes, className)}
      >
        {content}
      </button>
    );
  }

  return <li>{iconOnly ? <Tooltip content={label}>{item}</Tooltip> : item}</li>;
}

/** The props `asChild` reads from, and merges into, the child element. */
type ChildProps = HTMLAttributes<HTMLElement> & Partial<Record<`data-${string}`, string>>;

/** A badge count: up to 99 as is, more as "99+". */
function formatCount(count: number): string {
  return count > 99 ? "99+" : String(count);
}
