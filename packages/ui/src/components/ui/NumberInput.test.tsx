import { fireEvent, render } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

import { Field } from "./Field";
import { NumberInput } from "./Input";

/*
 * The markup of `NumberInput` in 0.6.0, before it took a `unit` — recorded from that release.
 * Without a unit the component must still render exactly this, and hand out the same ids to
 * what follows it.
 */
const CLASSES_0_6 =
  "rounded-control border border-line-strong bg-raised px-2.5 text-sm text-fg placeholder:text-fg-subtle transition-colors hover:border-fg-subtle disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-signal h-8 font-mono tabular-nums";
const PLAIN_0_6 = `<input aria-describedby="hint" min="0" style="color: red;" step="2" inputmode="decimal" class="${CLASSES_0_6} w-24" type="number" value="3">`;
const IN_FIELD_0_6 = `<div class="flex min-w-0 flex-col gap-1.5"><label class="flex min-w-0 flex-col gap-1.5"><span class="flex items-baseline gap-2"><span class="font-medium text-fg text-xs">L</span></span><input aria-describedby="_r_0_" inputmode="decimal" class="w-full ${CLASSES_0_6}" type="number" value="3"></label><span id="_r_0_" class="text-xs leading-snug text-fg-muted">d</span></div>`;

describe("NumberInput", () => {
  it("renders the 0.6.0 markup when there is no unit", () => {
    const plain = render(
      <NumberInput defaultValue="3" min={0} className="w-24" aria-describedby="hint" style={{ color: "red" }} step={2} />,
    );
    expect(plain.container.innerHTML).toBe(PLAIN_0_6);
    plain.unmount();

    const inField = render(
      <Field label="L" description="d">
        <NumberInput defaultValue="3" />
      </Field>,
    );
    expect(inField.container.innerHTML).toBe(IN_FIELD_0_6);
  });

  it("treats an empty unit as no unit", () => {
    const { container } = render(<NumberInput unit="" defaultValue="1" />);
    expect(container.querySelector("[data-unit]")).toBeNull();
    expect(container.firstElementChild?.tagName).toBe("INPUT");
  });

  it("forwards the ref to the input, with or without a unit", () => {
    const withUnit = createRef<HTMLInputElement>();
    const without = createRef<HTMLInputElement>();
    render(<NumberInput ref={withUnit} unit="mm" defaultValue="1" />);
    render(<NumberInput ref={without} defaultValue="1" />);
    expect(withUnit.current?.tagName).toBe("INPUT");
    expect(without.current?.tagName).toBe("INPUT");
  });

  it("puts the unit after the caller's description and before the Field's", () => {
    const { getByRole } = render(
      <Field label="Tilt" description="About x.">
        <NumberInput unit="°" aria-describedby="own" defaultValue="1" />
      </Field>,
    );
    const ids = getByRole("spinbutton").getAttribute("aria-describedby")?.split(" ") ?? [];
    expect(ids).toHaveLength(3);
    expect(ids[0]).toBe("own");
    expect(document.getElementById(ids[1]!)?.textContent).toBe("°");
    expect(document.getElementById(ids[2]!)?.textContent).toBe("About x.");
  });

  it("keeps the caller's own style, over the room made for the unit", () => {
    const { container } = render(
      <NumberInput unit="px" defaultValue="1" style={{ paddingInlineEnd: "3rem", color: "red" }} />,
    );
    const input = container.querySelector("input");
    expect(input?.style.paddingInlineEnd).toBe("3rem");
    expect(input?.style.color).toBe("red");
  });

  it("passes a null text value as an empty field", () => {
    const { container } = render(<NumberInput value={null} onChange={() => {}} />);
    expect(container.querySelector("input")?.value).toBe("");
  });

  it("shows a number without precision as JavaScript prints it, and composes the caller's handlers", () => {
    const calls: string[] = [];
    const { container } = render(
      <NumberInput
        value={0.25}
        onValueChange={() => calls.push("value")}
        onFocus={() => calls.push("focus")}
        onBlur={() => calls.push("blur")}
        onChange={() => calls.push("change")}
        onKeyDown={() => calls.push("key")}
      />,
    );
    const input = container.querySelector("input")!;
    expect(input.value).toBe("0.25");
    expect(input.getAttribute("step")).toBe("any");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "0.5" } });
    fireEvent.keyDown(input, { key: "a" });
    fireEvent.blur(input);
    expect(calls).toEqual(["focus", "value", "change", "key", "blur"]);
  });

  it("ignores a text value in number-valued mode", () => {
    const { container } = render(<NumberInput value="3" onValueChange={() => {}} />);
    expect(container.querySelector("input")?.value).toBe("");
  });
});

