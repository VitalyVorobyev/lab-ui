import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState, type ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import dataset from "../api/__fixtures__/dataset_spec.json";
import detector from "../api/__fixtures__/detector_config.json";
import handeye from "../api/__fixtures__/rig_handeye_config.json";
import planar from "../api/__fixtures__/planar_intrinsics_config.json";
import targetSpec from "../api/__fixtures__/target_spec.json";
import rigExtrinsics from "../api/__fixtures__/rig_extrinsics_config.json";
import type { JsonSchema } from "../api/schemaNode";
import { defaultValueForSchema } from "../api/schemaValue";
import { SchemaValueForm } from "./SchemaValueForm";

afterEach(cleanup);

const DETECTOR = detector as unknown as JsonSchema;
const PLANAR = planar as unknown as JsonSchema;
const RIG = rigExtrinsics as unknown as JsonSchema;

const PLANAR_VALUE = {
  init: { init_iterations: 2, fix_k3: true, fix_tangential: false, zero_skew: true },
  solver: { max_iters: 50, verbosity: 0, robust_loss: "None" },
  distortion_model: "brown_conrady5",
  fix_camera: {
    intrinsics: { fx: false, fy: false, cx: false, cy: false },
    distortion: { k1: false, k2: false, k3: true, p1: false, p2: false },
  },
  fix_poses: [],
};

/** Every leaf of a JSON value, by dot path. */
function leaves(value: unknown, path = "", out = new Map<string, string>()): Map<string, string> {
  if (typeof value === "object" && value !== null) {
    for (const [key, child] of Object.entries(value)) leaves(child, path === "" ? key : `${path}.${key}`, out);
    if (Object.keys(value).length === 0) out.set(path, JSON.stringify(value));
  } else {
    out.set(path, JSON.stringify(value));
  }
  return out;
}

type Props = Omit<ComponentProps<typeof SchemaValueForm>, "value" | "defaultValue" | "onValueChange">;

/** A parent that owns the value, the way an app does, and reports every change. */
function Harness({ initial, spy, ...props }: Props & { initial: unknown; spy: (next: unknown) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <SchemaValueForm
      {...props}
      value={value}
      onValueChange={(next) => {
        spy(next);
        setValue(next);
      }}
    />
  );
}

function setup(schema: JsonSchema, initial: unknown, props: Partial<Props> = {}) {
  const spy = vi.fn<(next: unknown) => void>();
  const view = render(<Harness schema={schema} initial={initial} spy={spy} {...props} />);
  const last = () => spy.mock.calls.at(-1)?.[0];
  return { spy, last, ...view };
}

function typeNumber(name: string, text: string) {
  const input = screen.getByRole("spinbutton", { name });
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: text } });
  return input;
}

describe("editing", () => {
  it("edits a nested number and changes only that leaf", () => {
    const { last, spy } = setup(PLANAR, PLANAR_VALUE);
    typeNumber("Max iters", "77");

    expect(spy).toHaveBeenCalledTimes(1);
    expect(last()).toEqual({ ...PLANAR_VALUE, solver: { ...PLANAR_VALUE.solver, max_iters: 77 } });
    expect((last() as typeof PLANAR_VALUE).fix_camera).toBe(PLANAR_VALUE.fix_camera);
    expect(PLANAR_VALUE.solver.max_iters).toBe(50);
  });

  it("toggles a boolean two levels deep", () => {
    const { last } = setup(PLANAR, PLANAR_VALUE);
    const fixCamera = screen.getByRole("group", { name: "Fix camera" });
    const distortion = within(fixCamera).getByRole("group", { name: "Distortion" });
    const k3 = within(distortion).getByRole("switch", { name: /K3/ });
    expect(k3.getAttribute("aria-checked")).toBe("true");

    fireEvent.click(k3);

    const next = last() as typeof PLANAR_VALUE;
    expect(next.fix_camera.distortion).toEqual({ ...PLANAR_VALUE.fix_camera.distortion, k3: false });
    expect(next.fix_camera.intrinsics).toBe(PLANAR_VALUE.fix_camera.intrinsics);
  });

  it("keeps keys the schema does not know", () => {
    const { last } = setup(PLANAR, { ...PLANAR_VALUE, mystery: { a: 1 } });
    typeNumber("Max iters", "60");
    expect(last()).toMatchObject({ mystery: { a: 1 } });
  });

  it("is a no-op, not an edit, to type the value that is already there", () => {
    const { spy } = setup(PLANAR, PLANAR_VALUE);
    typeNumber("Max iters", "50");
    expect(spy).not.toHaveBeenCalled();
  });

  it("works uncontrolled, from a defaultValue, and from the schema's defaults without one", () => {
    const onValueChange = vi.fn();
    const { unmount } = render(<SchemaValueForm schema={PLANAR} defaultValue={PLANAR_VALUE} onValueChange={onValueChange} />);
    typeNumber("Max iters", "12");
    expect(screen.getByRole<HTMLInputElement>("spinbutton", { name: "Max iters" }).value).toBe("12");
    expect(onValueChange).toHaveBeenCalledTimes(1);
    unmount();

    render(<SchemaValueForm schema={DETECTOR} onValueChange={onValueChange} />);
    expect(screen.getByRole<HTMLInputElement>("spinbutton", { name: "Nms radius" }).value).toBe("2.5");
  });
});

describe("numbers", () => {
  it("never accepts a fraction in an integer field, and says why", () => {
    const { spy } = setup(PLANAR, PLANAR_VALUE);
    typeNumber("Max iters", "2.5");
    expect(spy).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe("Must be a whole number");

    typeNumber("Max iters", "3");
    expect((spy.mock.calls.at(-1)?.[0] as typeof PLANAR_VALUE).solver.max_iters).toBe(3);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("emits a float as a number, an integer-valued one as the same JSON number", () => {
    const { last } = setup(DETECTOR, defaultValueForSchema(DETECTOR));
    typeNumber("Nms radius", "4.25");
    expect((last() as { nms_radius: number }).nms_radius).toBe(4.25);
    typeNumber("Nms radius", "3.0");
    expect(JSON.stringify((last() as { nms_radius: number }).nms_radius)).toBe("3");
  });

  it("holds back a value outside an exclusive bound", () => {
    const { spy } = setup(DETECTOR, defaultValueForSchema(DETECTOR));
    typeNumber("Nms radius", "0");
    expect(spy).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe("Must be > 0");
  });

  it("shows the unit and the range beside the field", () => {
    setup(DETECTOR, defaultValueForSchema(DETECTOR));
    const radius = screen.getByRole("spinbutton", { name: "Nms radius" });
    expect(radius.closest("[data-unit]")?.getAttribute("data-unit")).toBe("px");
    expect(screen.getByText("> 0")).toBeTruthy();
  });

  it("restores the default when a number is cleared", () => {
    const { last } = setup(DETECTOR, { ...(defaultValueForSchema(DETECTOR) as object), nms_radius: 4 });
    const input = typeNumber("Nms radius", "");
    fireEvent.blur(input);
    expect((last() as { nms_radius: number }).nms_radius).toBe(2.5);
  });

  it("leaves a cleared number alone when the app turns restoring off", () => {
    const { spy } = setup(DETECTOR, { ...(defaultValueForSchema(DETECTOR) as object), nms_radius: 4 }, {
      ui: { fields: { nms_radius: { restoreDefaultOnClear: false } } },
    });
    const input = typeNumber("Nms radius", "");
    fireEvent.blur(input);
    expect(spy).not.toHaveBeenCalled();
    expect(screen.getByRole<HTMLInputElement>("spinbutton", { name: "Nms radius" }).value).toBe("4");
  });

  it("clears an optional number with no default by removing the key, and seeds a required one", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: { a: { type: "integer", minimum: 2 }, b: { type: "integer", minimum: 5 } },
      required: ["b"],
    };
    const { last } = setup(schema, { a: 3, b: 9 });
    fireEvent.blur(typeNumber("A", ""));
    expect(last()).toEqual({ b: 9 });
    fireEvent.blur(typeNumber("B", ""));
    expect(last()).toEqual({ b: 5 });
  });

  it("clears a required number to nothing when restoring is off and there is no default", () => {
    const schema: JsonSchema = { type: "object", properties: { b: { type: "integer" } }, required: ["b"] };
    const { spy } = setup(schema, { b: 9 }, { ui: { fields: { b: { restoreDefaultOnClear: false } } } });
    fireEvent.blur(typeNumber("B", ""));
    expect(spy).not.toHaveBeenCalled();
  });

  it("reads an optional nullable number: empty removes the key, never writes null", () => {
    const { last } = setup(DETECTOR, defaultValueForSchema(DETECTOR));
    const strength = screen.getByRole<HTMLInputElement>("spinbutton", { name: "Min strength" });
    expect(strength.value).toBe("");
    expect(strength.placeholder).toBe("none");

    typeNumber("Min strength", "0.4");
    expect((last() as { min_strength: unknown }).min_strength).toBe(0.4);
    fireEvent.blur(typeNumber("Min strength", ""));
    expect(last()).not.toHaveProperty("min_strength");
  });

  describe("clearing a nullable number", () => {
    const OPT: JsonSchema = {
      type: "object",
      properties: {
        with_default: { type: ["number", "null"], default: 0.25 },
        null_default: { type: ["number", "null"], default: null },
        must_have: { type: ["number", "null"], default: 1 },
        none: { type: ["number", "null"], default: 0.25 },
      },
      required: ["must_have"],
    };
    const ui = { fields: { with_default: { restoreDefaultOnClear: false }, none: { clearTo: "null" as const } } };

    it("writes the default for an optional field with a non-null default when restoring", () => {
      const { last } = setup(OPT, { with_default: 0.5, must_have: 2 });
      fireEvent.blur(typeNumber("With default", ""));
      expect(last()).toEqual({ with_default: 0.25, must_have: 2 });
    });

    it("removes the key when restoring is off, or when the default is null", () => {
      const { last } = setup(OPT, { with_default: 0.5, null_default: 3, must_have: 2 }, { ui });
      fireEvent.blur(typeNumber("With default", ""));
      expect(last()).toEqual({ null_default: 3, must_have: 2 });
      fireEvent.blur(typeNumber("Null default", ""));
      expect(last()).toEqual({ must_have: 2 });
    });

    it("writes null for a required nullable field", () => {
      const { last } = setup(OPT, { must_have: 2 });
      fireEvent.blur(typeNumber("Must have", ""));
      expect(last()).toEqual({ must_have: null });
    });

    it("writes null for an optional nullable field under clearTo: null", () => {
      const { last } = setup(OPT, { none: 0.5, must_have: 2 }, { ui });
      fireEvent.blur(typeNumber("None", ""));
      expect(last()).toEqual({ none: null, must_have: 2 });
    });

    it("shows the default of an absent key as the placeholder, and none for null or a null default", () => {
      setup(OPT, { null_default: null, none: null, must_have: 2 });
      expect(screen.getByRole<HTMLInputElement>("spinbutton", { name: "With default" }).placeholder).toBe("0.25");
      expect(screen.getByRole<HTMLInputElement>("spinbutton", { name: "Null default" }).placeholder).toBe("none");
      expect(screen.getByRole<HTMLInputElement>("spinbutton", { name: "None" }).placeholder).toBe("none");
    });
  });

  it("applies the app's bounds and unit over the schema's", () => {
    const { spy } = setup(DETECTOR, defaultValueForSchema(DETECTOR), {
      ui: { fields: { blur_sigma: { max: 3, unit: "mm" } } },
    });
    const sigma = screen.getByRole("spinbutton", { name: "Blur sigma" });
    expect(sigma.closest("[data-unit]")?.getAttribute("data-unit")).toBe("mm");
    expect(sigma.getAttribute("max")).toBe("3");
    typeNumber("Blur sigma", "5");
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("closed sets", () => {
  const MODE: JsonSchema = {
    type: "object",
    properties: {
      mode: {
        oneOf: [
          { const: "fast", type: "string", description: "Fewer passes." },
          { const: "exact", type: "string", description: "All passes." },
        ],
        default: "fast",
      },
      level: { enum: [1, 2, 3, 4], type: "integer", default: 2 },
      flag: { anyOf: [{ type: "boolean" }, { type: "null" }], default: null },
      kind: { enum: ["a", "b", null], type: ["string", "null"], default: null },
    },
    required: ["mode", "level"],
  };

  it("shows a few values as a strip, sets the chosen one, and explains the chosen one", () => {
    const { last } = setup(MODE, { mode: "fast", level: 2 });
    expect(screen.getByRole("radio", { name: "fast" })).toBeTruthy();
    expect(screen.getByText("Fewer passes.")).toBeTruthy();

    fireEvent.click(screen.getByRole("radio", { name: "exact" }));

    expect(last()).toEqual({ mode: "exact", level: 2 });
    expect(screen.getByText("All passes.")).toBeTruthy();
  });

  it("labels values with the app's labels", () => {
    setup(MODE, { mode: "fast", level: 2 }, { ui: { fields: { mode: { enumLabels: { fast: "Quick" } } } } });
    expect(screen.getByRole("radio", { name: "Quick" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "exact" })).toBeTruthy();
  });

  it("puts many values in a picker showing the chosen one", () => {
    setup(MODE, { mode: "fast", level: 2 });
    expect(screen.getByRole("combobox", { name: "Level" }).textContent).toBe("2");
  });

  it("can be forced into either control", () => {
    setup(MODE, { mode: "fast", level: 2 }, { ui: { fields: { mode: { widget: "select" }, level: { widget: "segmented" } } } });
    expect(screen.getByRole("combobox", { name: "Mode" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "4" })).toBeTruthy();
  });

  it("offers a nullable set an unset entry, and shows a null as unset", () => {
    setup(MODE, { mode: "fast", level: 2, flag: null, kind: null });
    expect(screen.getByRole("combobox", { name: "Flag" }).textContent).toBe("None");
    expect(screen.getByRole("combobox", { name: "Kind" }).textContent).toBe("None");
  });

  it("shows the schema default of an absent nullable set, and writes null for the unset entry", async () => {
    const schema: JsonSchema = {
      type: "object",
      properties: { method: { type: ["string", "null"], enum: ["ring_fit", "gradient", null], default: "ring_fit" } },
    };
    const { last } = setup(schema, {});
    const picker = screen.getByRole("combobox", { name: "Method" });
    expect(picker.textContent).toBe("ring_fit");
    fireEvent.click(picker);
    fireEvent.click(await screen.findByRole("option", { name: "None" }));
    expect(last()).toEqual({ method: null });
  });

  it("does not claim a value outside the set", () => {
    const { spy } = setup(MODE, { mode: "weird", level: 2 });
    expect(spy).not.toHaveBeenCalled();
    expect(screen.getAllByRole("radio").every((radio) => !(radio as HTMLInputElement).checked)).toBe(true);
  });
});

describe("serde enums", () => {
  it("switches an externally tagged enum, seeding the variant, and edits its data", () => {
    const { last } = setup(PLANAR, PLANAR_VALUE, { ui: { fields: { "solver.robust_loss": { widget: "segmented" } } } });
    expect(screen.queryByRole("spinbutton", { name: "Scale" })).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: "Huber" }));
    expect((last() as typeof PLANAR_VALUE).solver.robust_loss).toEqual({ Huber: { scale: 0 } });

    typeNumber("Scale", "1.5");
    expect((last() as typeof PLANAR_VALUE).solver.robust_loss).toEqual({ Huber: { scale: 1.5 } });

    fireEvent.click(screen.getByRole("radio", { name: "None" }));
    expect((last() as typeof PLANAR_VALUE).solver.robust_loss).toBe("None");
    expect(screen.queryByRole("spinbutton", { name: "Scale" })).toBeNull();
  });

  it("edits a newtype variant as one value labelled by its tag", () => {
    const { last } = setup(DETECTOR, defaultValueForSchema(DETECTOR));
    expect(screen.getByText("Pick the threshold from the response histogram.")).toBeTruthy();

    fireEvent.click(screen.getByRole("radio", { name: "Fixed" }));
    expect((last() as { threshold: unknown }).threshold).toEqual({ Fixed: 0 });

    typeNumber("Fixed", "128");
    expect(JSON.stringify((last() as { threshold: unknown }).threshold)).toBe('{"Fixed":128}');

    fireEvent.click(screen.getByRole("radio", { name: "Relative" }));
    expect((last() as { threshold: unknown }).threshold).toEqual({ Relative: { fraction: 0, floor: 0 } });
    typeNumber("Fraction", "0.3");
    expect((last() as { threshold: unknown }).threshold).toEqual({ Relative: { fraction: 0.3, floor: 0 } });
  });

  it("switches an internally tagged enum, resetting to the variant's defaults", () => {
    const { last } = setup(DETECTOR, defaultValueForSchema(DETECTOR));
    typeNumber("Radius", "9");
    expect((last() as { refiner: unknown }).refiner).toEqual({ kind: "CenterOfMass", radius: 9 });

    fireEvent.click(screen.getByRole("radio", { name: "Forstner" }));
    expect((last() as { refiner: unknown }).refiner).toEqual({ kind: "Forstner", radius: 4, min_eigenvalue: null });
    expect(screen.getByRole("spinbutton", { name: "Min eigenvalue" })).toBeTruthy();

    fireEvent.click(screen.getByRole("radio", { name: "SaddlePoint" }));
    expect((last() as { refiner: unknown }).refiner).toEqual({ kind: "SaddlePoint", max_iters: 10 });
    expect(screen.queryByRole("spinbutton", { name: "Radius" })).toBeNull();
  });

  it("does not show the discriminator as a field", () => {
    setup(RIG, defaultValueForSchema(RIG));
    expect(screen.queryByRole("textbox", { name: "Kind" })).toBeNull();
    expect(screen.getByRole("radio", { name: "Pinhole" })).toBeTruthy();
  });

  it("shows no variant's fields for a value that names none, and seeds on choosing one", () => {
    const { last } = setup(DETECTOR, { ...(defaultValueForSchema(DETECTOR) as object), refiner: { kind: "Mystery" } });
    expect(screen.queryByRole("spinbutton", { name: "Radius" })).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "CenterOfMass" }));
    expect((last() as { refiner: unknown }).refiner).toEqual({ kind: "CenterOfMass", radius: 3 });
  });
});

describe("nullable blocks", () => {
  it("sets and unsets an object with a switch, seeding it from the schema's defaults", () => {
    const { last } = setup(DETECTOR, defaultValueForSchema(DETECTOR));
    const toggle = screen.getByRole("switch", { name: "Pyramid" });
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    expect(screen.queryByRole("spinbutton", { name: "Levels" })).toBeNull();

    fireEvent.click(toggle);
    expect((last() as { pyramid: unknown }).pyramid).toEqual({ levels: 3, scale: 0.5 });
    expect(screen.getByRole<HTMLInputElement>("spinbutton", { name: "Levels" }).value).toBe("3");

    typeNumber("Levels", "5");
    expect((last() as { pyramid: unknown }).pyramid).toEqual({ levels: 5, scale: 0.5 });

    fireEvent.click(screen.getByRole("switch", { name: "Pyramid" }));
    expect((last() as { pyramid: unknown }).pyramid).toBeNull();
  });

  it("can use a checkbox instead of a switch", () => {
    setup(DETECTOR, defaultValueForSchema(DETECTOR), { ui: { fields: { pyramid: { widget: "checkbox" } } } });
    expect(screen.getByRole("checkbox", { name: "Pyramid" })).toBeTruthy();
  });

  it("treats a nullable tuple the same way", () => {
    const { last } = setup(DETECTOR, defaultValueForSchema(DETECTOR));
    fireEvent.click(screen.getByRole("switch", { name: "Roi" }));
    expect((last() as { roi: unknown }).roi).toEqual([0, 0, 0, 0]);
    typeNumber("2", "640");
    expect((last() as { roi: unknown }).roi).toEqual([0, 0, 640, 0]);
  });

  it("shows a set block already open", () => {
    setup(DETECTOR, { ...(defaultValueForSchema(DETECTOR) as object), pyramid: { levels: 4, scale: 0.25 } });
    expect(screen.getByRole("switch", { name: "Pyramid" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole<HTMLInputElement>("spinbutton", { name: "Scale" }).value).toBe("0.25");
  });

  it("reads an optional nullable string: empty removes the key", () => {
    const { last } = setup(DETECTOR, defaultValueForSchema(DETECTOR));
    const label = screen.getByRole("textbox", { name: "Label" });
    fireEvent.change(label, { target: { value: "run 4" } });
    expect((last() as { label: unknown }).label).toBe("run 4");
    fireEvent.change(label, { target: { value: "" } });
    expect(last()).not.toHaveProperty("label");
  });

  it("writes null when a required or clearTo: null nullable string is emptied, and keeps \"\" for a plain one", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        req: { type: ["string", "null"] },
        opt: { type: ["string", "null"], default: "dflt" },
        plain: { type: "string" },
      },
      required: ["req"],
    };
    const { last } = setup(schema, { req: "a", opt: "b", plain: "c" }, { ui: { fields: { opt: { clearTo: "null" } } } });
    expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Opt" }).value).toBe("b");
    fireEvent.change(screen.getByRole("textbox", { name: "Req" }), { target: { value: "" } });
    expect(last()).toMatchObject({ req: null });
    fireEvent.change(screen.getByRole("textbox", { name: "Opt" }), { target: { value: "" } });
    expect(last()).toMatchObject({ opt: null });
    fireEvent.change(screen.getByRole("textbox", { name: "Plain" }), { target: { value: "" } });
    expect(last()).toMatchObject({ plain: "" });
  });

  it("shows the default of an absent optional nullable string as the placeholder", () => {
    const schema: JsonSchema = { type: "object", properties: { opt: { type: ["string", "null"], default: "dflt" } } };
    setup(schema, {});
    expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Opt" }).placeholder).toBe("dflt");
  });
});

describe("lists and tuples", () => {
  it("adds, edits and removes the entries of a string list, keeping the other rows", () => {
    const { last } = setup(DETECTOR, { ...(defaultValueForSchema(DETECTOR) as object), debug_dirs: ["a", "b", "c"] });
    const rows = () => screen.getAllByRole("textbox", { name: /^Debug dirs \d$/ });
    const [first, second, third] = rows();
    expect(rows().map((row) => (row as HTMLInputElement).value)).toEqual(["a", "b", "c"]);

    fireEvent.click(screen.getByRole("button", { name: "Remove Debug dirs 2" }));
    expect((last() as { debug_dirs: unknown }).debug_dirs).toEqual(["a", "c"]);
    expect(rows()[0]).toBe(first);
    expect(rows()[1]).toBe(third);
    expect(second?.isConnected).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Add Debug dirs" }));
    expect((last() as { debug_dirs: unknown }).debug_dirs).toEqual(["a", "c", ""]);
    fireEvent.change(rows()[2] as HTMLElement, { target: { value: "d" } });
    expect((last() as { debug_dirs: unknown }).debug_dirs).toEqual(["a", "c", "d"]);
    expect(rows()[0]).toBe(first);
  });

  it("starts a list that is not there yet", () => {
    const { last } = setup(DETECTOR, {});
    fireEvent.click(screen.getByRole("button", { name: "Add Debug dirs" }));
    expect((last() as { debug_dirs: unknown }).debug_dirs).toEqual([""]);
  });

  it("holds a list to its minItems and maxItems", () => {
    const schema: JsonSchema = { type: "object", properties: { xs: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 2 } } };
    setup(schema, { xs: ["a", "b"] });
    expect(screen.getByRole<HTMLInputElement>("button", { name: "Add Xs" }).disabled).toBe(true);
    cleanup();
    setup(schema, { xs: ["a"] });
    expect(screen.getByRole<HTMLInputElement>("button", { name: "Remove Xs 1" }).disabled).toBe(true);
  });

  it("edits a tuple of objects row by row", () => {
    const { last } = setup(DETECTOR, defaultValueForSchema(DETECTOR));
    const second = screen.getByRole("group", { name: "Anchors 1" });
    fireEvent.change(within(second).getByRole("spinbutton", { name: "X" }), { target: { value: "12" } });
    expect((last() as { anchors: unknown }).anchors).toEqual([
      { x: 0, y: 0 },
      { x: 12, y: 0 },
      { x: 0, y: 10 },
    ]);
  });

  it("falls back to JSON for a list it cannot lay out, and keeps the last good value while showing the error", () => {
    const { last, spy } = setup(DETECTOR, defaultValueForSchema(DETECTOR));
    const weights = screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Channel weights" });
    expect(JSON.parse(weights.value)).toEqual([0.299, 0.587, 0.114]);

    fireEvent.change(weights, { target: { value: "[0.1, 0.2" } });
    expect(spy).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/^Invalid JSON/);
    expect(weights.value).toBe("[0.1, 0.2");

    fireEvent.change(weights, { target: { value: "[0.1, 0.2, 0.7]" } });
    expect((last() as { channel_weights: unknown }).channel_weights).toEqual([0.1, 0.2, 0.7]);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("resets the JSON text when the value changes from outside", () => {
    const schema: JsonSchema = { type: "object", properties: { xs: { type: "array", items: { type: "number" } } } };
    const { rerender } = render(<SchemaValueForm schema={schema} value={{ xs: [1] }} />);
    const box = screen.getByRole("textbox", { name: "Xs" });
    fireEvent.change(box, { target: { value: "[1" } });
    rerender(<SchemaValueForm schema={schema} value={{ xs: [1, 2] }} />);
    expect(JSON.parse(screen.getByRole<HTMLInputElement>("textbox", { name: "Xs" }).value)).toEqual([1, 2]);
  });

  it("removes an optional JSON field that is emptied and refuses to empty a required one", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: { a: { type: "array", items: { type: "number" } }, b: { type: "array", items: { type: "number" } } },
      required: ["b"],
    };
    const { last, spy } = setup(schema, { a: [1], b: [2] });
    fireEvent.change(screen.getByRole("textbox", { name: "A" }), { target: { value: "  " } });
    expect(last()).toEqual({ b: [2] });
    spy.mockClear();
    fireEvent.change(screen.getByRole("textbox", { name: "B" }), { target: { value: "" } });
    expect(spy).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe("Enter a JSON value");
  });

  it("forces a widget on an array: JSON, a list or a row", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        strings: { type: "array", items: { type: "string" } },
        nums: { type: "array", items: { type: "number" } },
        loose: { type: "array", items: { type: "number" } },
      },
    };
    setup(schema, { strings: ["a"], nums: [1, 2], loose: [3] }, {
      ui: { fields: { strings: { widget: "json" }, nums: { widget: "tuple-row" }, loose: { widget: "string-list" } } },
    });
    expect(screen.getByRole("textbox", { name: "Strings" }).tagName).toBe("TEXTAREA");
    expect(screen.getByRole("group", { name: "Nums" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add Loose" })).toBeTruthy();
  });
});

describe("layout", () => {
  it("blocks every control when disabled, and says so", () => {
    const { container } = setup(DETECTOR, defaultValueForSchema(DETECTOR), { disabled: true });
    expect((container.firstElementChild as HTMLElement).dataset["disabled"]).toBe("");
    const controls = container.querySelectorAll<HTMLInputElement>(
      "input:not([type=radio]), textarea, button[role=switch], button[aria-label^=Add], button[aria-label^=Remove]",
    );
    expect(controls.length).toBeGreaterThan(5);
    for (const control of controls) expect(control.hasAttribute("disabled") || control.dataset["disabled"] !== undefined).toBe(true);
    for (const radio of container.querySelectorAll<HTMLInputElement>("input[type=radio]")) expect(radio.disabled).toBe(true);
  });

  it("is two columns by default", () => {
    const { container } = setup(DETECTOR, defaultValueForSchema(DETECTOR));
    expect((container.firstElementChild as HTMLElement).dataset["columns"]).toBe("2");
    expect(container.querySelector(".sm\\:grid-cols-2")).toBeTruthy();
    expect(container.querySelector(".sm\\:col-span-2")).toBeTruthy();
  });

  it("is one column on request", () => {
    const { container } = setup(DETECTOR, defaultValueForSchema(DETECTOR), { columns: 1 });
    expect((container.firstElementChild as HTMLElement).dataset["columns"]).toBe("1");
    expect(container.querySelector(".sm\\:grid-cols-2")).toBeNull();
    expect(container.querySelector(".sm\\:col-span-2")).toBeNull();
  });

  it("hands the root element to a ref", () => {
    let root: HTMLDivElement | null = null;
    const { container } = render(
      <SchemaValueForm
        schema={DETECTOR}
        ref={(element) => {
          root = element;
        }}
      />,
    );
    expect(root).toBe(container.firstElementChild);
  });

  it("merges className onto the root", () => {
    const { container } = setup(DETECTOR, {}, { className: "custom" });
    expect((container.firstElementChild as HTMLElement).classList.contains("custom")).toBe(true);
  });

  it("renders groups as sections or disclosures, then the ungrouped rest, each field once", () => {
    const { container } = setup(DETECTOR, defaultValueForSchema(DETECTOR), {
      ui: {
        groups: [
          { id: "detect", title: "Detection", fields: ["nms_radius", "blur_sigma"], hint: "What is found." },
          { id: "more", title: "More", fields: ["refiner", "threshold.Fixed", "nope"], collapsible: true, defaultOpen: true, hint: "Extra." },
        ],
      },
    });
    expect(screen.getByRole("heading", { name: "Detection" })).toBeTruthy();
    expect(screen.getByText("What is found.")).toBeTruthy();
    const more = container.querySelector("details") as HTMLElement;
    expect(more.hasAttribute("open")).toBe(true);
    expect(more.textContent).toContain("More");
    expect(within(more).getByText("Extra.")).toBeTruthy();
    expect(within(more).getByRole("radio", { name: "CenterOfMass" })).toBeTruthy();

    for (const name of ["Nms radius", "Blur sigma", "Radius"]) expect(screen.getAllByRole("spinbutton", { name })).toHaveLength(1);
    const detection = screen.getByRole("heading", { name: "Detection" }).closest("section") as HTMLElement;
    expect(within(detection).getByRole("spinbutton", { name: "Nms radius" })).toBeTruthy();
    expect(within(detection).queryByRole("spinbutton", { name: "Min strength" })).toBeNull();

    // The rest follows the groups, in schema order.
    const names = Array.from(container.querySelectorAll("input[aria-label]")).map((el) => el.getAttribute("aria-label"));
    expect(names.indexOf("Nms radius")).toBeLessThan(names.indexOf("Min strength"));
    expect(names.indexOf("Min strength")).toBeLessThan(names.indexOf("Max corners"));
  });

  it("leaves a collapsible group closed by default and drops a group with nothing in it", () => {
    const { container } = setup(DETECTOR, defaultValueForSchema(DETECTOR), {
      ui: {
        groups: [
          { id: "g", title: "Folded", fields: ["nms_radius"], collapsible: true },
          { id: "empty", title: "Empty", fields: ["nowhere"] },
          { id: "hidden", title: "Hidden group", fields: ["label"] },
        ],
        fields: { label: { hidden: true } },
      },
    });
    expect(container.querySelector("details")?.hasAttribute("open")).toBe(false);
    expect(screen.queryByText("Empty")).toBeNull();
    expect(screen.queryByText("Hidden group")).toBeNull();
  });

  it("claims one leaf of an object and leaves the rest of the object in place", () => {
    setup(PLANAR, PLANAR_VALUE, { ui: { groups: [{ id: "g", title: "Key", fields: ["solver.max_iters"] }] } });
    const key = screen.getByRole("heading", { name: "Key" }).closest("section") as HTMLElement;
    expect(within(key).getByRole("spinbutton", { name: "Max iters" })).toBeTruthy();
    const solver = screen.getByRole("group", { name: "Solver" });
    expect(within(solver).queryByRole("spinbutton", { name: "Max iters" })).toBeNull();
    expect(within(solver).getByRole("spinbutton", { name: "Verbosity" })).toBeTruthy();
  });

  it("drops an object whose every field a group has claimed", () => {
    setup(PLANAR, PLANAR_VALUE, {
      ui: { groups: [{ id: "g", title: "Key", fields: ["init.init_iterations", "init.fix_k3", "init.fix_tangential", "init.zero_skew"] }] },
    });
    expect(screen.queryByRole("group", { name: "Init" })).toBeNull();
  });

  it("hides, relabels and rehints fields", () => {
    setup(PLANAR, PLANAR_VALUE, {
      ui: {
        fields: {
          "solver.max_iters": { label: "Iterations", hint: "How many." },
          "solver.verbosity": { hidden: true },
          "fix_camera.distortion.k1": { label: "Radial 1" },
        },
      },
    });
    expect(screen.getByRole("spinbutton", { name: "Iterations" })).toBeTruthy();
    expect(screen.queryByRole("spinbutton", { name: "Verbosity" })).toBeNull();
    expect(screen.getByRole("switch", { name: "Radial 1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "About Iterations" })).toBeTruthy();
  });

  it("places a description as a hint, inline, or not at all", () => {
    const text = "Number of iterations for iterative intrinsics estimation.";
    const hint = setup(PLANAR, PLANAR_VALUE);
    expect(screen.getByRole("button", { name: "About Init iterations" })).toBeTruthy();
    expect(screen.queryByText(text)).toBeNull();
    hint.unmount();

    const inline = setup(PLANAR, PLANAR_VALUE, { ui: { fields: { "init.init_iterations": { descriptionAs: "inline" } } } });
    expect(screen.getByText(text)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "About Init iterations" })).toBeNull();
    inline.unmount();

    setup(PLANAR, PLANAR_VALUE, { ui: { fields: { "init.init_iterations": { descriptionAs: "none" } } } });
    expect(screen.queryByText(text)).toBeNull();
    expect(screen.queryByRole("button", { name: "About Init iterations" })).toBeNull();
  });

  it("labels array elements through a wildcard path", () => {
    setup(DETECTOR, defaultValueForSchema(DETECTOR), { ui: { fields: { "anchors.*.x": { label: "East" } } } });
    expect(screen.getAllByRole("spinbutton", { name: "East" })).toHaveLength(3);
  });

  it("renders a root that is not an object", () => {
    const number = setup({ type: "integer", minimum: 1, title: "Count" }, 3);
    expect(screen.getByRole<HTMLInputElement>("spinbutton", { name: "Count" }).value).toBe("3");
    typeNumber("Count", "4");
    expect(number.last()).toBe(4);
    number.unmount();

    const refiner = DETECTOR.properties?.["refiner"] as JsonSchema;
    setup({ ...refiner, $defs: DETECTOR.$defs }, { kind: "Forstner", radius: 4 });
    expect(screen.getByRole("radio", { name: "Forstner" })).toBeTruthy();
  });

  it("renders nothing for an object with no fields", () => {
    const { container } = setup({ type: "object", properties: {}, additionalProperties: false }, {});
    expect(container.querySelectorAll("input")).toHaveLength(0);
  });
});

describe("renderField", () => {
  it("replaces a field with the app's own control, and falls back where it returns undefined", () => {
    const renderField = vi.fn((context: { path: string; value: unknown; onChange: (next: unknown) => void }) =>
      context.path === "solver.max_iters" ? (
        <button type="button" onClick={() => context.onChange(Number(context.value) + 1)}>
          bump {String(context.value)}
        </button>
      ) : undefined,
    );
    const { last } = setup(PLANAR, PLANAR_VALUE, { renderField });

    expect(screen.queryByRole("spinbutton", { name: "Max iters" })).toBeNull();
    expect(screen.getByRole("spinbutton", { name: "Verbosity" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "bump 50" }));
    expect((last() as typeof PLANAR_VALUE).solver.max_iters).toBe(51);
    expect(renderField).toHaveBeenCalledWith(expect.objectContaining({ path: "solver", disabled: false }));
  });

  it("can take over a whole container, with the resolved schema", () => {
    const seen: unknown[] = [];
    setup(DETECTOR, defaultValueForSchema(DETECTOR), {
      renderField: ({ path, schema }) => {
        if (path !== "refiner") return undefined;
        seen.push(schema);
        return <p>custom refiner</p>;
      },
    });
    expect(screen.getByText("custom refiner")).toBeTruthy();
    expect(screen.queryByRole("radio", { name: "Forstner" })).toBeNull();
    expect(Array.isArray((seen[0] as JsonSchema).oneOf)).toBe(true);
  });
});

describe("round trip", () => {
  const fixtures: [string, JsonSchema][] = [
    ["planar_intrinsics_config", PLANAR],
    ["rig_extrinsics_config", RIG],
    ["rig_handeye_config", handeye],
    ["dataset_spec", dataset],
    ["detector_config", DETECTOR],
  ];

  it.each(fixtures)("renders the default value of %s and reports nothing until it is edited", (_name, schema) => {
    const value = defaultValueForSchema(schema);
    const before = JSON.stringify(value);
    const spy = vi.fn();
    const { container } = render(<SchemaValueForm schema={schema} value={value} onValueChange={spy} />);

    // Touching every control without changing it must not change the value either.
    for (const input of container.querySelectorAll<HTMLInputElement>("input[type=number], input[type=text], input:not([type])")) {
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: input.value } });
      fireEvent.blur(input);
    }
    for (const area of container.querySelectorAll<HTMLTextAreaElement>("textarea")) {
      fireEvent.change(area, { target: { value: area.value } });
    }
    expect(spy).not.toHaveBeenCalled();
    expect(JSON.stringify(value)).toBe(before);
    expect(container.querySelectorAll("input, button, textarea").length).toBeGreaterThan(3);
  });

  it.each(fixtures)("changes only the touched leaf of %s", (_name, schema) => {
    const value = defaultValueForSchema(schema);
    const spy = vi.fn<(next: unknown) => void>();
    const { container } = render(<SchemaValueForm schema={schema} value={value} onValueChange={spy} />);
    const target = container.querySelector<HTMLInputElement>("input[type=text], input:not([type]):not([type=radio])");
    if (target === null) return;
    fireEvent.change(target, { target: { value: `${target.value}!` } });

    expect(spy).toHaveBeenCalledTimes(1);
    const before = leaves(value);
    const after = leaves(spy.mock.calls[0]?.[0]);
    const touched = [...after.keys()].filter((path) => before.get(path) !== after.get(path));
    expect(touched).toHaveLength(1);
    expect([...before.keys()].filter((path) => !after.has(path))).toEqual([]);
  });

  it("renders a hand-edited value with unknown keys untouched", () => {
    const spy = vi.fn();
    render(
      <SchemaValueForm
        schema={DETECTOR}
        value={{ nms_radius: 3, refiner: { kind: "CenterOfMass", radius: 3, future: 1 }, extra: [1] }}
        onValueChange={spy}
      />,
    );
    expect(screen.getByRole<HTMLInputElement>("spinbutton", { name: "Nms radius" }).value).toBe("3");
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("ringgrid target_spec", () => {
  it("shows a $ref-with-siblings variant's struct fields and edits them", () => {
    const schema = targetSpec as unknown as JsonSchema;
    const { last } = setup(schema, defaultValueForSchema(schema));
    expect(screen.getByRole("spinbutton", { name: "Rows" })).toBeTruthy();
    expect(screen.getByRole("spinbutton", { name: "Pitch mm" })).toBeTruthy();
    typeNumber("Rows", "7");
    expect((last() as { lattice: { kind: string; rows: number } }).lattice).toMatchObject({ kind: "hex", rows: 7 });
  });
});
