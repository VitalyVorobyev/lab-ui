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
import type { ReactNode } from "react";

import { cn, focusRing } from "../ui";
import { useStage } from "./ImageStage";
import { MAX_SCALE, formatScale, scaleRange, steppedScale } from "./view";

/** The presets the percentage menu offers, beside "Fit". */
const PRESETS = [0.25, 0.5, 1, 2, 4, 8];

export function StageToolbar({
  children,
  className,
}: {
  /** App-specific groups — a tool selector, a layers popover — after a divider. */
  children?: ReactNode;
  className?: string;
}) {
  const stage = useStage();
  const [menuOpen, setMenuOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const [min, max] = scaleRange(stage.box, stage.image);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => {
      if (!menu.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [menuOpen]);

  const step = (direction: 1 | -1) => stage.zoomTo(steppedScale(stage.view.scale, direction, min, max));

  return (
    <div
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

      <div className="relative" ref={menu}>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
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

/** The bar's own button shape, exported so app groups match it exactly. */
export function StageButton({
  label,
  onClick,
  disabled,
  pressed,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "grid size-7 place-items-center rounded-control text-fg-muted transition-colors",
        "hover:bg-raised hover:text-fg disabled:pointer-events-none disabled:opacity-40",
        pressed && "bg-signal/15 text-signal",
        focusRing,
      )}
    >
      {children}
    </button>
  );
}

export function StageToolbarDivider() {
  return <span className="mx-0.5 h-5 w-px bg-line" aria-hidden />;
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

/**
 * The instrument's display line for the canvas: where the cursor is, and how magnified.
 *
 * In image pixels, because that is the coordinate every number the backend returns is in —
 * a readout in screen pixels would be a second coordinate system to reconcile by hand.
 */
export function StageReadout({
  cursor,
  extra,
}: {
  cursor?: { x: number; y: number } | null;
  extra?: ReactNode;
}) {
  const stage = useStage();
  return (
    <span className="rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] text-white tabular-nums">
      {cursor ? `${cursor.x.toFixed(1)}, ${cursor.y.toFixed(1)} px` : `${stage.image.width}×${stage.image.height}`}
      {" · "}
      {stage.isFit ? "fit" : formatScale(stage.view.scale)}
      {extra && <> · {extra}</>}
    </span>
  );
}
