/**
 * The page furniture: what holds a screen together above the level of a single control.
 *
 * One heading size and one gap rule, defined once so every route in every consuming app
 * agrees with the others by construction rather than by luck.
 */

import { Slot, Slottable } from "@radix-ui/react-slot";
import { isValidElement, type ReactElement, type ReactNode } from "react";

import { byDensity, useDensity } from "./Density";
import { cn } from "./cn";

export function Panel({
  title,
  actions,
  className,
  bodyClassName,
  children,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  const density = useDensity();

  return (
    <section className={cn("rounded-panel border border-line bg-surface", className)}>
      {(title || actions) && (
        <header
          className={cn(
            "flex items-center justify-between gap-4 border-b border-line",
            byDensity(density, "min-h-11 px-4 py-2.5", "min-h-8 px-2.5 py-1"),
          )}
        >
          <h2
            className={cn(
              "truncate font-semibold text-fg",
              byDensity(
                density,
                "text-sm tracking-tight",
                "text-[11px] tracking-wider uppercase text-fg-muted",
              ),
            )}
          >
            {title}
          </h2>
          {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
        </header>
      )}
      <div className={cn(byDensity(density, "p-4", "p-2.5"), bodyClassName)}>{children}</div>
    </section>
  );
}

/**
 * A numbered step inside a form.
 *
 * The number is not decoration: it marks a genuine ordering, where each choice narrows the
 * next. Do not reach for this where the parts are merely adjacent.
 */
export function Section({
  step,
  title,
  hint,
  actions,
  children,
}: {
  step?: number;
  title: string;
  hint?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const density = useDensity();

  return (
    <section className={cn("flex flex-col", byDensity(density, "gap-3", "gap-1.5"))}>
      <div className={cn("flex items-baseline", byDensity(density, "gap-2.5", "gap-2"))}>
        {step !== undefined && (
          <span
            className="font-mono text-xs text-fg-subtle tabular-nums"
            aria-hidden
          >
            {String(step).padStart(2, "0")}
          </span>
        )}
        <h3 className="text-sm font-semibold tracking-tight text-fg">{title}</h3>
        {hint && <p className="text-xs text-fg-muted">{hint}</p>}
        {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

/** Where `PageHeader`'s back link goes: a plain URL, or the app's own link element. */
export type BackLink =
  | { href: string; label: string }
  /** A link element — typically a router's `<Link to="…">Label</Link>` — styled and prefixed with an arrow. */
  | ReactElement;

const BACK_CLASSES = "w-fit text-xs text-fg-muted transition-colors hover:text-signal";

export function PageHeader({
  title,
  meta,
  actions,
  back,
}: {
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  /**
   * The way up. `{ href, label }` renders a plain `<a>`; for client-side navigation pass the
   * router's own link — `back={<Link to="/experiments">Experiments</Link>}` — which is
   * rendered with the back-link style and arrow, so this package never imports a router.
   */
  back?: BackLink | undefined;
}) {
  return (
    <header className="flex flex-col gap-1.5">
      {back &&
        (isHrefLink(back) ? (
          <a href={back.href} className={BACK_CLASSES}>
            ← {back.label}
          </a>
        ) : (
          <Slot className={BACK_CLASSES}>
            {"← "}
            <Slottable>{back}</Slottable>
          </Slot>
        ))}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h1 className="text-xl font-semibold tracking-tight text-fg">{title}</h1>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {meta && <div className="flex flex-wrap items-center gap-2 text-xs text-fg-muted">{meta}</div>}
    </header>
  );
}

function isHrefLink(back: BackLink): back is { href: string; label: string } {
  return !isValidElement(back);
}

export type ReadoutItem = {
  /** A quiet prefix naming what the value is, where the value alone is ambiguous. */
  label?: string | undefined;
  value: ReactNode;
  /** Makes the value a plain `<a href>`. */
  href?: string | undefined;
  /**
   * Makes the value a link through the app's own element — a router's `<Link to="…" />`,
   * given without children: the value becomes its content. Takes precedence over `href`.
   */
  link?: ReactElement | undefined;
};

const READOUT_LINK = "text-fg transition-colors hover:text-signal";

/**
 * The instrument's display line: the facts about what is on screen, in one fixed slot.
 *
 * Stated in the same place on every screen, in mono, the way a piece of measuring equipment
 * has one readout rather than a label per panel. Rendered as a list because it is one.
 */
export function ReadoutStrip({
  items,
  className,
}: {
  items: ReadoutItem[];
  className?: string;
}) {
  const shown = items.filter((item) => item.value !== null && item.value !== undefined);
  if (shown.length === 0) return null;

  return (
    <ol
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-fg-muted",
        className,
      )}
    >
      {shown.map((item, index) => (
        <li key={index} className="flex items-center gap-2">
          {index > 0 && (
            <span className="text-fg-subtle" aria-hidden>
              ·
            </span>
          )}
          {item.label && <span className="text-fg-subtle">{item.label}</span>}
          {item.link ? (
            <Slot className={READOUT_LINK}>
              <Slottable>{item.link}</Slottable>
              {item.value}
            </Slot>
          ) : item.href ? (
            <a href={item.href} className={READOUT_LINK}>
              {item.value}
            </a>
          ) : (
            <span className="text-fg">{item.value}</span>
          )}
        </li>
      ))}
    </ol>
  );
}
