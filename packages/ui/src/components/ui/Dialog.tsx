/*
 * Confirmation for the things that cannot be undone, and a shell for the things that need
 * a form.
 *
 * `Dialog` is a modal with no verdict of its own: a title, a body the caller fills, and a
 * footer it chooses. `ConfirmDialog` is one arrangement of it -- the destructive-action
 * confirmation every app in this family needs at least once (deleting a dataset, discarding
 * an in-progress measurement session) -- rather than a second copy of the overlay, the
 * centring and the width cap.
 */

import * as RadixDialog from "@radix-ui/react-dialog";
import { useCallback, useState, type ReactNode } from "react";

import { Button } from "./Button";
import { cn, focusRingInset } from "./cn";

/**
 * Whether the body overflows its height cap, kept current as the dialog or its content
 * resizes. A scrolling body has to be reachable by keyboard (so it can be scrolled without
 * a pointer); a body that fits must not add a tab stop.
 */
function useOverflowing(): [
  (node: HTMLDivElement | null) => (() => void) | undefined,
  boolean,
] {
  const [overflowing, setOverflowing] = useState(false);
  const ref = useCallback((node: HTMLDivElement | null) => {
    if (node === null) return undefined;
    const measure = () => setOverflowing(node.scrollHeight > node.clientHeight + 1);
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    // The body is capped, so once it hits the cap only the content keeps changing size.
    if (node.firstElementChild) observer.observe(node.firstElementChild);
    return () => observer.disconnect();
  }, []);
  return [ref, overflowing];
}

/**
 * A modal: a title, a body the caller fills, and a footer it chooses.
 *
 * Controlled — the caller owns `open`. The body scrolls under a height cap so the footer
 * stays on screen; while it overflows it is a keyboard tab stop (with the focus ring) and
 * carries `data-overflowing`, so it can be scrolled without a pointer.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  footer,
  className,
  children,
}: {
  /** Whether the dialog is shown. */
  open: boolean;
  /** Called with `false` on Escape, an overlay click or a `DialogClose`. */
  onOpenChange: (open: boolean) => void;
  /** Names the dialog (`aria-labelledby`). */
  title: string;
  /** Optional: what the reader needs before they can answer, not decoration. */
  description?: ReactNode;
  /** The action row, right-aligned below the body. */
  footer?: ReactNode;
  /** Merged with the dialog panel's own classes through `cn`. */
  className?: string | undefined;
  /** The body. */
  children?: ReactNode;
}) {
  const [bodyRef, overflowing] = useOverflowing();

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px]" />
        <RadixDialog.Content
          className={cn(
            "fixed top-1/2 left-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2",
            // A ceiling and a column, so a dialog that lists things keeps its footer on
            // screen and scrolls its body instead of growing past the viewport. Every
            // short dialog is far below the cap and is unaffected. This is a scroller
            // inside an overlay, not a second page scroller.
            "flex max-h-[calc(100vh-4rem)] flex-col",
            "rounded-panel border border-line bg-overlay p-5 shadow-xl shadow-black/40",
            "focus:outline-none",
            className,
          )}
        >
          <RadixDialog.Title className="text-sm font-semibold tracking-tight text-fg">
            {title}
          </RadixDialog.Title>
          {/* Radix warns when a dialog has no description; render an empty one rather than
              inventing prose for a form whose fields already carry their own labels. */}
          <RadixDialog.Description
            className={cn(
              "mt-2 text-sm leading-relaxed text-fg-muted",
              description === undefined && "sr-only",
            )}
          >
            {description ?? title}
          </RadixDialog.Description>
          <div
            ref={bodyRef}
            tabIndex={overflowing ? 0 : undefined}
            data-overflowing={overflowing ? "" : undefined}
            className={cn("min-h-0 overflow-y-auto", focusRingInset)}
          >
            <div>{children}</div>
          </div>
          {footer && <div className="mt-5 flex shrink-0 justify-end gap-2">{footer}</div>}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

/**
 * The destructive-action confirmation: a `Dialog` whose footer is Cancel and one confirm
 * button. Say in `description` what will actually happen.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  loading = false,
  disabled = false,
  destructive = false,
  className,
}: {
  /** Whether the dialog is shown. */
  open: boolean;
  /** Called with `false` on Cancel, Escape or an overlay click. */
  onOpenChange: (open: boolean) => void;
  /** The question, e.g. "Delete dataset?". */
  title: string;
  /** Say what will actually happen, naming the thing by the name the reader gave it. */
  description: ReactNode;
  /** The confirm button's label: the verb, e.g. "Delete". */
  confirmLabel: string;
  /** Called on confirm. The dialog stays open; close it (or set `loading`) yourself. */
  onConfirm: () => void;
  /** Shows the confirm button's spinner and blocks it while the action runs. */
  loading?: boolean;
  /** Blocks the confirm button. */
  disabled?: boolean;
  /** Renders the confirm button as `danger` rather than `primary`. */
  destructive?: boolean;
  /** Merged with the dialog panel's own classes through `cn`. */
  className?: string | undefined;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      className={className}
      footer={
        <>
          <RadixDialog.Close asChild>
            <Button variant="ghost">Cancel</Button>
          </RadixDialog.Close>
          <Button
            variant={destructive ? "danger" : "primary"}
            loading={loading}
            disabled={disabled}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}

/**
 * The dialog's own dismiss, for a footer the caller builds: wrap a button in it with
 * `asChild` — `<DialogClose asChild><Button>Done</Button></DialogClose>`.
 */
export const DialogClose = RadixDialog.Close;
