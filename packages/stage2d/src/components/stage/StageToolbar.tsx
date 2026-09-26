/**
 * The viewer's own controls, floating over the image rather than filed in a side panel.
 *
 * Zoom, fit and 1:1 are properties of *the picture*, not of the task beside it, and a
 * workbench that puts them in the inspector spends inspector width on them on every screen
 * while leaving the canvas with no visible affordance at all — which is indistinguishable
 * from a canvas that cannot zoom.
 *
 * The bar is deliberately small and quiet: `bg-overlay/85` over a blur, one row of icon
 * buttons, no labels except the percentage. It is chrome over the subject, so it recedes
 * until aimed at.
 */

import { Maximize2, Minus, Plus, Scan } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ComponentPropsWithRef, ReactNode } from "react";

import { cn, focusRing } from "@vitavision/ui";
import { useStage } from "./ImageStage";
import { MAX_SCALE, formatScale, scaleRange, steppedScale } from "./view";

/** The presets the percentage menu offers, beside "Fit". */
const PRESETS = [0.25, 0.5, 1, 2, 4, 8];

/** Props of `StageToolbar`. */
export interface StageToolbarProps {
  /** App-specific groups — a tool selector, a layers popover — after a divider. */
  children?: ReactNode;
  /** Merged onto the bar with `cn`. */
  className?: string;
}

/**
 * The stage's zoom controls — zoom out, a percentage menu (fit and presets), zoom in, fit,
 * and 100% — plus any app groups passed as children. Pass it as `ImageStage`'s `toolbar`;
 * it reads the stage through `useStage`.
 *
 * The bar carries `data-fit` while the view is fit; the percentage button carries
 * `data-state="open"` or `"closed"` for its menu.
 */
export function StageToolbar({ children, className }: StageToolbarProps) {
  const stage = useStage();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [min, max] = scaleRange(stage.box, stage.image);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [menuOpen]);

  const step = (direction: 1 | -1) => stage.zoomTo(steppedScale(stage.view.scale, direction, min, max));

  return (
    <div
      data-fit={stage.isFit ? "" : undefined}
      className={cn(
        "flex items-center gap-0.5 rounded-panel border border-line bg-overlay/85 p-1 shadow-lg backdrop-blur",
        className,
      )}
      // Every press here is a control, never the start of a pan.
      onPointerDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <StageButton label="Zoom out" onClick={() => step(-1)} disabled={stage.view.scale <= min + 1e-9}>
        <Minus className="size-4" aria-hidden />
      </StageButton>

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          data-state={menuOpen ? "open" : "closed"}
          onClick={() => setMenuOpen((open) => !open)}
          className={cn(
            "h-7 min-w-14 rounded-control px-2 font-mono text-xs text-fg tabular-nums hover:bg-raised",
            focusRing,
          )}
        >
          {stage.isFit ? "Fit" : formatScale(stage.view.scale)}
        </button>
        {menuOpen && (
          <div
            role="menu"
            className="absolute bottom-9 left-0 z-20 min-w-28 rounded-panel border border-line bg-overlay p-1 shadow-lg"
          >
            <MenuItem
              onClick={() => {
                stage.fit();
                setMenuOpen(false);
              }}
              active={stage.isFit}
            >
              Fit
            </MenuItem>
            {PRESETS.filter((scale) => scale >= min && scale <= max).map((scale) => (
              <MenuItem
                key={scale}
                onClick={() => {
                  stage.zoomTo(scale);
                  setMenuOpen(false);
                }}
                active={!stage.isFit && Math.abs(stage.view.scale - scale) < 1e-6}
              >
                {formatScale(scale)}
              </MenuItem>
            ))}
          </div>
        )}
      </div>

      <StageButton
        label="Zoom in"
        onClick={() => step(1)}
        disabled={stage.view.scale >= Math.min(max, MAX_SCALE) - 1e-9}
      >
        <Plus className="size-4" aria-hidden />
      </StageButton>

      <StageToolbarDivider />

      <StageButton label="Fit to window" onClick={stage.fit} pressed={stage.isFit}>
        <Maximize2 className="size-4" aria-hidden />
      </StageButton>
      <StageButton
        label="Actual size (100%)"
        onClick={() => stage.zoomTo(1)}
        pressed={!stage.isFit && Math.abs(stage.view.scale - 1) < 1e-6}
      >
        <Scan className="size-4" aria-hidden />
      </StageButton>

      {children && (
        <>
          <StageToolbarDivider />
          {children}
        </>
      )}
    </div>
  );
}

/** Props of `StageButton`: a `<button>`'s, less the ones it sets itself. */
export interface StageButtonProps
  extends Omit<ComponentPropsWithRef<"button">, "type" | "title" | "aria-label" | "aria-pressed" | "children"> {
  /** The accessible name, also shown as the tooltip. */
  label: string;
  /** A toggle's state; omit for a plain action button. */
  pressed?: boolean;
  /** The icon (mark it `aria-hidden`). */
  children: ReactNode;
}

/**
 * The bar's own button shape, exported so app groups match it exactly. An icon button
 * named by `label`; a toggle when `pressed` is given, exposed as `aria-pressed` and
 * `data-state="on"` or `"off"`. Other button props (and `ref`) are passed through.
 */
export function StageButton({ label, pressed, className, children, ...props }: StageButtonProps) {
  return (
    <button
      {...props}
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      data-state={pressed === undefined ? undefined : pressed ? "on" : "off"}
      className={cn(
        "grid size-7 place-items-center rounded-control text-fg-muted transition-colors",
        "hover:bg-raised hover:text-fg disabled:pointer-events-none disabled:opacity-40",
        pressed && "bg-signal/15 text-signal",
        focusRing,
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Props of `StageToolbarDivider`. */
export interface StageToolbarDividerProps {
  /** Merged onto the divider with `cn`. */
  className?: string;
}

/** A thin vertical rule between groups of `StageButton`s. Decorative (`aria-hidden`). */
export function StageToolbarDivider({ className }: StageToolbarDividerProps) {
  return <span className={cn("mx-0.5 h-5 w-px bg-line", className)} aria-hidden />;
}

function MenuItem({
  onClick,
  active,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        "block w-full rounded-control px-2 py-1 text-left font-mono text-xs tabular-nums hover:bg-raised",
        active ? "text-signal" : "text-fg",
        focusRing,
      )}
    >
      {children}
    </button>
  );
}

/** Props of `StageReadout`. */
export interface StageReadoutProps {
  /** The pointer in image pixels (from `ImageStage`'s `onHover`); the image size shows without it. */
  cursor?: { x: number; y: number } | null;
  /** Appended after a separator — a pixel value, a channel. */
  extra?: ReactNode;
  /** Merged onto the readout with `cn`. */
  className?: string;
}

/**
 * The instrument's display line for the canvas: where the cursor is, and how magnified.
 * Pass it as `ImageStage`'s `readout`; it reads the stage through `useStage`.
 *
 * In image pixels, because that is the coordinate every number the backend returns is in —
 * a readout in screen pixels would be a second coordinate system to reconcile by hand.
 */
export function StageReadout({ cursor, extra, className }: StageReadoutProps) {
  const stage = useStage();
  return (
    <span
      className={cn(
        "rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] text-white tabular-nums",
        className,
      )}
    >
      {cursor ? `${cursor.x.toFixed(1)}, ${cursor.y.toFixed(1)} px` : `${stage.image.width}×${stage.image.height}`}
      {" · "}
      {stage.isFit ? "fit" : formatScale(stage.view.scale)}
      {extra && <> · {extra}</>}
    </span>
  );
}
