import { Slot, Slottable } from "@radix-ui/react-slot";
import { Loader2 } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { byDensity, useDensity } from "./Density";
import { cn, focusRing } from "./cn";

/**
 * A button's look, by what the action is: `primary` for the one action a screen is for,
 * `secondary` for the rest, `ghost` for toolbar actions, `danger` for an action that
 * destroys something.
 */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

/** A button's height and padding. `md` is the comfortable density's size, `sm` the compact one's. */
export type ButtonSize = "sm" | "md";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-signal text-signal-fg hover:bg-signal-strong",
  secondary: "bg-surface text-fg ring-1 ring-inset ring-line-strong hover:bg-raised",
  ghost: "text-fg-muted hover:bg-raised hover:text-fg",
  // Soft rather than a solid red block. The verdict red is also the colour of a defect
  // badge, and a filled button of it reads as an alarm on a screen that is mostly grey.
  // Genuinely destructive actions are behind a confirmation dialog regardless. The hover
  // tint stops at /15 so the red label keeps 4.5:1 on it.
  danger: "bg-defect/10 text-defect ring-1 ring-inset ring-defect/30 hover:bg-defect/15",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-7 gap-1.5 px-2.5 text-xs",
  md: "h-8 gap-2 px-3 text-sm",
};

/**
 * The classes that make a control look like a button, for the one element that has to be
 * something else. Prefer `Button` and `ButtonLink`; this exists so a third shape — a
 * `<label>` wrapping a file input, say — does not have to copy the variant table.
 *
 * @param options - The variant (default `secondary`), the size (default `md`) and the
 *   caller's own classes, merged last.
 * @returns The class string.
 */
export function buttonClasses({
  variant = "secondary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant | undefined;
  size?: ButtonSize | undefined;
  className?: string | undefined;
} = {}): string {
  return cn(
    "inline-flex shrink-0 items-center justify-center rounded-control font-medium transition-colors",
    "disabled:cursor-not-allowed disabled:opacity-45",
    SIZE_CLASSES[size],
    VARIANT_CLASSES[variant],
    focusRing,
    className,
  );
}

function ButtonIcon({ icon }: { icon: ReactNode }) {
  return (
    <span className="shrink-0 [&>svg]:size-3.5" aria-hidden>
      {icon}
    </span>
  );
}

/**
 * An action. `asChild` renders the button's look onto the single child element instead of a
 * `<button>` — how a router's link becomes a button-shaped navigation without this package
 * knowing about routers: `<Button asChild><Link to="/runs">Runs</Link></Button>`.
 * For a plain URL, `ButtonLink` is the shorter spelling.
 *
 * Takes every `<button>` prop, `ref` included. State is exposed as `data-variant` and, while
 * `loading`, `data-loading` (plus `aria-busy`).
 */
export function Button({
  variant = "secondary",
  size,
  type = "button",
  loading = false,
  icon,
  asChild = false,
  className,
  children,
  disabled,
  ...rest
}: ComponentProps<"button"> & {
  /** What kind of action this is. Defaults to `secondary`. */
  variant?: ButtonVariant | undefined;
  /** Defaults to the density in force — `md` comfortable, `sm` compact. */
  size?: ButtonSize | undefined;
  /** Swaps the icon for a spinner and blocks the click, without the label changing. */
  loading?: boolean | undefined;
  /** A leading icon, decorative (`aria-hidden`): the label carries the meaning. */
  icon?: ReactNode;
  /**
   * Render onto the one child element (Radix `Slot`) rather than a `<button>`. The child
   * keeps its own semantics — a link stays a link — so `type`, `disabled` and `loading` do
   * not apply.
   */
  asChild?: boolean | undefined;
}) {
  const density = useDensity();
  const resolved = size ?? byDensity(density, "md", "sm");

  if (asChild) {
    return (
      <Slot
        {...rest}
        data-variant={variant}
        className={buttonClasses({ variant, size: resolved, className })}
      >
        {icon && <ButtonIcon icon={icon} />}
        <Slottable>{children}</Slottable>
      </Slot>
    );
  }

  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      data-variant={variant}
      data-loading={loading ? "" : undefined}
      {...rest}
      className={buttonClasses({ variant, size: resolved, className })}
    >
      {loading ? (
        <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
      ) : (
        icon && <ButtonIcon icon={icon} />
      )}
      {children}
    </button>
  );
}

/**
 * A navigation that looks like a button: one `<a>`, styled by the same variants and density.
 *
 * The alternative every consumer reached for was `<Link><Button/></Link>` — a button inside
 * an anchor, which is invalid HTML, gives a keyboard two tab stops for one action, and makes
 * a screen reader announce a button that navigates. There is no `disabled` or `loading`:
 * a link that cannot be followed should not be rendered as one, and a navigation has no
 * pending state of its own.
 *
 * It renders a plain `<a href>`, and takes every `<a>` prop, `ref` included. For a router's
 * link, pass it as the only child with `asChild` —
 * `<ButtonLink asChild><Link to="/runs">Runs</Link></ButtonLink>` — so client-side
 * navigation keeps working and this package still never imports a router.
 */
export function ButtonLink({
  variant = "secondary",
  size,
  icon,
  asChild = false,
  className,
  children,
  ...rest
}: ComponentProps<"a"> & {
  /** What kind of action this is. Defaults to `secondary`. */
  variant?: ButtonVariant | undefined;
  /** Defaults to the density in force — `md` comfortable, `sm` compact. */
  size?: ButtonSize | undefined;
  /** A leading icon, decorative (`aria-hidden`): the label carries the meaning. */
  icon?: ReactNode;
  /** Render onto the one child element — a router's `<Link>` — instead of an `<a>`. */
  asChild?: boolean | undefined;
}) {
  const density = useDensity();
  const resolved = size ?? byDensity(density, "md", "sm");
  const Comp = asChild ? Slot : "a";

  return (
    <Comp
      {...rest}
      data-variant={variant}
      className={buttonClasses({ variant, size: resolved, className })}
    >
      {icon && <ButtonIcon icon={icon} />}
      <Slottable>{children}</Slottable>
    </Comp>
  );
}
