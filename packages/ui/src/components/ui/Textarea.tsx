/*
 * Multi-line text entry.
 *
 * The auto-grow is measured, not CSS: `field-sizing: content` would need no script, but it
 * is not in every engine the packages run in (the desktop shells embed WebKit), and it
 * cannot stop at a row count. The textarea renders `minRows` tall on the server, so the
 * first paint already has the right floor; after mount its height follows the content
 * between the two bounds.
 */

import { type ChangeEvent, type ComponentProps, type Ref, useCallback, useLayoutEffect, useRef } from "react";

import { useFieldDescription } from "./Field";
import { controlClasses } from "./Input";
import { cn } from "./cn";

/**
 * Props of `Textarea`: every `<textarea>` prop, `ref` included, plus an invalid state, the
 * mono face, and growing with the content between `minRows` and `maxRows`.
 */
export type TextareaProps = ComponentProps<"textarea"> & {
  /** Called with the new text on every edit, alongside the native `onChange`. */
  onValueChange?: ((value: string) => void) | undefined;
  /**
   * Marks the value as wrong: `aria-invalid`, `data-invalid` and a border in the defect
   * colour. Inside a `Field` with an `error` it is on without this. Say what is wrong in
   * text too (the field's `error`): the border alone is a colour.
   */
  invalid?: boolean | undefined;
  /** Sets the text in IBM Plex Mono, for code, JSON, lists, or strings whose characters all matter. */
  mono?: boolean | undefined;
  /**
   * Grows with the content from this many lines. Set it or `maxRows` to turn growing on;
   * `rows` is then ignored.
   */
  minRows?: number | undefined;
  /** Stops growing at this many lines and scrolls beyond them. Set it or `minRows` to turn growing on. */
  maxRows?: number | undefined;
};

/** Sets a ref of either kind. */
function assign<T>(ref: Ref<T> | undefined, value: T | null): void {
  if (typeof ref === "function") ref(value);
  else if (ref) ref.current = value;
}

/**
 * Fits a textarea's height to its content between `minRows` and `maxRows` lines, and scrolls
 * only past the cap.
 */
function fit(node: HTMLTextAreaElement, minRows: number, maxRows: number | undefined): void {
  const style = getComputedStyle(node);
  // `normal` is no length: take the usual 1.2 of the font size.
  const line = Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.2 || 20;
  const border = Number.parseFloat(style.borderTopWidth) + Number.parseFloat(style.borderBottomWidth);
  const chrome = Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom) + border;
  const min = minRows * line + chrome;
  const max = maxRows === undefined ? Number.POSITIVE_INFINITY : Math.max(min, maxRows * line + chrome);
  // Measure the content at the smallest height, so the box can shrink as well as grow.
  node.style.height = `${min}px`;
  const content = node.scrollHeight + border;
  node.style.height = `${Math.min(Math.max(content, min), max)}px`;
  node.style.overflowY = content > max + 0.5 ? "auto" : "hidden";
}

/**
 * Multi-line text, on the shared control palette. Takes every `<textarea>` prop, `ref`
 * included; inside a `Field` it is described by the field's description and error, and
 * shown invalid while the field has an error.
 *
 * With `minRows` or `maxRows` it grows with its content between the two (and scrolls past
 * `maxRows`); without them it is `rows` tall and the reader can resize it. State is exposed
 * as `data-invalid`.
 */
export function Textarea({
  className,
  "aria-describedby": describedBy,
  invalid,
  mono = false,
  minRows,
  maxRows,
  rows,
  value,
  onChange,
  onValueChange,
  ref,
  ...rest
}: TextareaProps) {
  const field = useFieldDescription(describedBy);
  const isInvalid = invalid === true || field["aria-invalid"] === true;
  const grows = minRows !== undefined || maxRows !== undefined;
  const floor = Math.max(1, Math.floor(minRows ?? 1));
  const cap = maxRows === undefined ? undefined : Math.max(floor, Math.floor(maxRows));

  const node = useRef<HTMLTextAreaElement | null>(null);
  const setNode = useCallback(
    (element: HTMLTextAreaElement | null) => {
      node.current = element;
      assign(ref, element);
    },
    [ref],
  );

  // On mount, and when a controlled value changes from outside (typing refits in `change`).
  useLayoutEffect(() => {
    if (grows && node.current) fit(node.current, floor, cap);
  }, [grows, floor, cap, mono, value]);

  // A change of width rewraps the text.
  useLayoutEffect(() => {
    const element = node.current;
    if (!grows || !element || typeof ResizeObserver === "undefined") return undefined;
    let width = element.clientWidth;
    const observer = new ResizeObserver(() => {
      if (element.clientWidth === width) return;
      width = element.clientWidth;
      fit(element, floor, cap);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [grows, floor, cap]);

  const change = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange?.(event);
    onValueChange?.(event.currentTarget.value);
    if (grows) fit(event.currentTarget, floor, cap);
  };

  return (
    <textarea
      {...field}
      aria-invalid={isInvalid || undefined}
      data-invalid={isInvalid ? "" : undefined}
      {...rest}
      {...(value === undefined ? {} : { value })}
      ref={setNode}
      rows={grows ? floor : rows}
      onChange={change}
      className={cn(
        controlClasses,
        "py-1.5",
        grows && "resize-none",
        mono && "font-mono",
        "data-invalid:border-defect data-invalid:hover:border-defect",
        className,
      )}
    />
  );
}
