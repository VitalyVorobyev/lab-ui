import type { Meta, StoryObj } from "@storybook/react-vite";
import { DensityProvider, Field, NumberInput } from "@vitavision/ui";
import { useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import dataset from "../api/__fixtures__/dataset_spec.json";
import detector from "../api/__fixtures__/detector_config.json";
import planar from "../api/__fixtures__/planar_intrinsics_config.json";
import rigExtrinsics from "../api/__fixtures__/rig_extrinsics_config.json";
import type { JsonSchema } from "../api/schemaNode";
import { defaultValueForSchema } from "../api/schemaValue";
import type { UiSchema } from "../api/uiSchema";
import { SchemaValueForm, type SchemaValueFormProps } from "./SchemaValueForm";

/*
 * The schemas are the real thing: the four calibration ones are what `cargo xtask
 * emit-schemas` writes (schemars 1.x), and the detector one is hand-written in the same shape
 * for what they lack (newtype variants, `x-unit`, a tuple of objects). `JsonSchema` is the
 * form's own loose type, so a JSON import needs the one cast.
 */
const PLANAR = planar as unknown as JsonSchema;
const DETECTOR = detector as unknown as JsonSchema;
const RIG = rigExtrinsics as unknown as JsonSchema;
const DATASET = dataset as unknown as JsonSchema;

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

const DETECTOR_VALUE = defaultValueForSchema(DETECTOR);

/** The layout a detector panel would want, which the schema cannot say. */
const DETECTOR_UI: UiSchema = {
  groups: [
    {
      id: "detection",
      title: "Detection",
      hint: "What counts as a corner.",
      fields: ["threshold", "nms_radius", "min_strength", "max_corners"],
    },
    { id: "refinement", title: "Refinement", fields: ["refiner", "upscale", "blur_sigma"] },
    { id: "search", title: "Search area", fields: ["roi", "pyramid"], collapsible: true, defaultOpen: true },
    { id: "diagnostics", title: "Diagnostics", fields: ["debug_dirs", "debug_overlay", "label"], collapsible: true },
  ],
  fields: {
    upscale: { enumLabels: { None: "Off", Double: "2×", Quadruple: "4×", Octuple: "8×" } },
    "roi.0": { label: "x" },
    "roi.1": { label: "y" },
    "roi.2": { label: "width" },
    "roi.3": { label: "height" },
    "anchors.*.x": { label: "x" },
    "anchors.*.y": { label: "y" },
    label: { descriptionAs: "inline" },
  },
};

/**
 * The form owns no value — the caller does. This is that caller: it keeps the value, reports
 * every change to the story's `onValueChange` spy, and prints what the page around the form
 * would hold.
 */
function Controlled({ value: initial, onValueChange, ...props }: SchemaValueFormProps) {
  const [value, setValue] = useState(initial);
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <SchemaValueForm
        {...props}
        value={value}
        onValueChange={(next) => {
          setValue(next);
          onValueChange?.(next);
        }}
      />
      <pre
        data-testid="value"
        tabIndex={0}
        aria-label="Current value"
        className="max-h-48 overflow-auto rounded-control border border-line bg-surface p-2 font-mono text-xs text-fg"
      >
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

const meta = {
  title: "forms/SchemaValueForm",
  component: SchemaValueForm,
  parameters: {
    docs: {
      description: {
        component: `A form that edits a **whole JSON value** through its JSON Schema (draft 2020-12, as schemars emits
it). \`SchemaForm\` is for *options* — every field starts unset and only what is touched is sent. This is for
*configs*: the value is complete, the form edits it in place and hands back the whole next value
(\`value\` / \`defaultValue\` / \`onValueChange\`). Untouched subtrees are shared with the previous value, keys
the schema does not know are kept, and a value in with no edits is the same value out.

What it renders, by the schema's shape: a number is a \`NumberInput\` with the schema's bounds, \`x-unit\` and
an integer-only rule (a fraction in an integer field is refused with a message, never rounded); a string an
\`Input\`; a boolean a \`Switch\`; a closed set (\`enum\`, or \`oneOf\` of \`const\`) a segmented strip up to three
values and a \`Select\` beyond; a struct a nested fieldset; a **serde enum** a variant selector plus the variant's
fields (externally tagged \`{"Huber": {…}}\` and newtype \`{"Fixed": 2}\` as well as internally tagged \`kind\`
enums — switching seeds the new variant from the schema's defaults); a \`null\`-able block a switch that sets and
unsets it, and a \`null\`-able number or string an empty control; a list of strings an editable list; a
fixed-length array a compact row; anything else a JSON textarea that keeps the last valid value while showing
the parse error. The first paragraph of a field's description is its \`InfoHint\`.

What the schema cannot say — grouping, labels, units, a different control — goes in a \`UiSchema\`:
\`groups\` (a \`Section\`, or a \`Disclosure\` when collapsible) and per-path \`fields\` (\`label\`, \`hint\`,
\`hidden\`, \`widget\`, \`unit\`, \`min\`/\`max\`/\`step\`, \`enumLabels\`, \`span\`, \`descriptionAs\`,
\`restoreDefaultOnClear\`). Paths are dot paths of the value; \`*\` stands for any array index. \`renderField\`
takes over any one field.

**Don't** use it for a form whose layout is the product (a wizard, a settings page with sections of unrelated
controls) — hand-build that from \`Field\` and the \`@vitavision/ui\` controls — or for *options* where "unset"
must mean "use the server's default" (that is \`SchemaForm\`).

**Accessibility**: every control is named by its label (\`aria-label\`), a switch or a strip by its own label,
a nested struct is a \`fieldset\` with a \`legend\`, a variant strip or select is named by the field, the hint
button is "About <label>", and an invalid number or JSON value is announced as an alert on its field.`,
      },
    },
  },
  args: { schema: PLANAR, value: PLANAR_VALUE, onValueChange: fn() },
  render: (args) => <Controlled {...args} />,
} satisfies Meta<typeof SchemaValueForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Nested structs, `$ref` into `$defs`, a plain enum, booleans and a serde enum — a calibration config as it comes. */
export const NestedObjects: Story = {
  play: async ({ canvas, args }) => {
    const iterations = canvas.getByRole("spinbutton", { name: "Max iters" });
    await expect(iterations).toHaveValue(50);
    await userEvent.clear(iterations);
    await userEvent.type(iterations, "80");
    await expect(args.onValueChange).toHaveBeenCalled();
    await expect(canvas.getByTestId("value")).toHaveTextContent('"max_iters": 80');
    await expect(canvas.getByTestId("value")).toHaveTextContent('"verbosity": 0');

    const k3 = within(canvas.getByRole("group", { name: "Distortion" })).getByRole("switch", { name: /K3/ });
    await expect(k3).toBeChecked();
    await userEvent.click(k3);
    await expect(k3).not.toBeChecked();
    await expect(canvas.getByTestId("value")).toHaveTextContent('"k3": false');
  },
};

/** More than three values: a `Select`, labelled with the schema's own words. The chosen value's description sits under it. */
export const PlainEnum: Story = {
  play: async ({ canvas, args }) => {
    const model = canvas.getByRole("combobox", { name: "Distortion model" });
    await expect(model).toHaveTextContent("brown_conrady5");
    await expect(canvas.getByText("Brown-Conrady [k1, k2, k3, p1, p2].")).toBeVisible();

    await userEvent.click(model);
    await userEvent.click(await within(document.body).findByRole("option", { name: "rational8" }));
    await waitFor(() =>
      expect(args.onValueChange).toHaveBeenLastCalledWith(expect.objectContaining({ distortion_model: "rational8" })),
    );
    await expect(canvas.getByText(/Rational polynomial/)).toBeVisible();
  },
};

/** An externally tagged serde enum: `"None"` is a unit variant, `{"Huber": {"scale": …}}` carries data. Shown as a strip here with `widget: "segmented"`. */
export const SerdeEnum: Story = {
  args: { ui: { fields: { "solver.robust_loss": { widget: "segmented" } } } },
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole("radio", { name: "Huber" }));
    await expect(args.onValueChange).toHaveBeenCalled();
    await expect(canvas.getByTestId("value")).toHaveTextContent(/"robust_loss": \{\s*"Huber": \{\s*"scale": 0/);
    const scale = canvas.getByRole("spinbutton", { name: "Scale" });
    await userEvent.type(scale, "1.5");
    await expect(canvas.getByTestId("value")).toHaveTextContent('"Huber": {');
    await expect(canvas.getByTestId("value")).toHaveTextContent('"scale": 1.5');

    await userEvent.click(canvas.getByRole("radio", { name: "None" }));
    await expect(canvas.queryByRole("spinbutton", { name: "Scale" })).toBeNull();
    await expect(canvas.getByTestId("value")).toHaveTextContent('"robust_loss": "None"');
  },
};

/** The same union with a detector's shapes: a newtype variant (`{"Fixed": 128}`) and a `kind`-tagged enum that resets to the variant's defaults. */
export const VariantsOfADetector: Story = {
  args: { schema: DETECTOR, value: DETECTOR_VALUE, ui: DETECTOR_UI },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("radio", { name: "Fixed" }));
    const fixed = canvas.getByRole("spinbutton", { name: "Fixed" });
    await userEvent.type(fixed, "128");
    await expect(canvas.getByTestId("value")).toHaveTextContent('"Fixed": 128');

    await userEvent.click(canvas.getByRole("radio", { name: "Forstner" }));
    await expect(canvas.getByTestId("value")).toHaveTextContent('"kind": "Forstner"');
    await expect(canvas.getByRole("spinbutton", { name: "Min eigenvalue" })).toHaveValue(null);
    await expect(canvas.queryByRole("textbox", { name: "Kind" })).toBeNull();
  },
};

/** Everything the schema cannot say, said once: groups (a `Section`, a `Disclosure`), labels for tuple cells and enum values, and the rest of the fields after them. */
export const GroupedByTheApp: Story = {
  args: { schema: DETECTOR, value: DETECTOR_VALUE, ui: DETECTOR_UI },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole("heading", { name: "Detection" })).toBeVisible();
    await expect(canvas.getByText("What counts as a corner.")).toBeVisible();
    // Four values, so a picker; the app's label for the chosen one is on it.
    await expect(canvas.getByRole("combobox", { name: "Upscale" })).toHaveTextContent("Off");

    const folded = canvasElement.querySelectorAll("details");
    await expect(folded).toHaveLength(2);
    await expect(folded[0]).toHaveAttribute("open");
    await expect(folded[1]).not.toHaveAttribute("open");
    await userEvent.click(canvas.getByText("Diagnostics"));
    await waitFor(() => expect(folded[1]).toHaveAttribute("open"));
  },
};

/** A `null`-able struct is a switch that sets and unsets it; a `null`-able number or string is just an empty control (clearing removes the key, so the schema default applies). */
export const NullableBlocks: Story = {
  args: { schema: DETECTOR, value: DETECTOR_VALUE, ui: DETECTOR_UI },
  play: async ({ canvas, args }) => {
    const strength = canvas.getByRole("spinbutton", { name: "Min strength" });
    await expect(strength).toHaveValue(null);
    await userEvent.type(strength, "0.4");
    await expect(canvas.getByTestId("value")).toHaveTextContent('"min_strength": 0.4');
    await userEvent.clear(strength);
    await userEvent.tab();
    await expect(canvas.getByTestId("value")).not.toHaveTextContent("min_strength");

    const pyramid = canvas.getByRole("switch", { name: "Pyramid" });
    await expect(pyramid).not.toBeChecked();
    await userEvent.click(pyramid);
    await expect(canvas.getByRole("spinbutton", { name: "Levels" })).toHaveValue(3);
    await userEvent.click(pyramid);
    await expect(canvas.queryByRole("spinbutton", { name: "Levels" })).toBeNull();
    await expect(args.onValueChange).toHaveBeenLastCalledWith(expect.objectContaining({ pyramid: null }));
  },
};

/** A list of strings with stable rows, a tuple of objects as compact rows, a nullable tuple as a row of cells — and a JSON textarea for what has no better control. */
export const ListsAndTuples: Story = {
  args: {
    schema: DETECTOR,
    value: { ...(DETECTOR_VALUE as object), debug_dirs: ["out/a", "out/b"], roi: [0, 0, 640, 480] },
    ui: DETECTOR_UI,
  },
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByText("Diagnostics"));
    await userEvent.click(canvas.getByRole("button", { name: "Add Debug dirs" }));
    const added = canvas.getByRole("textbox", { name: "Debug dirs 3" });
    await userEvent.type(added, "out/c");
    await userEvent.click(canvas.getByRole("button", { name: "Remove Debug dirs 1" }));
    await expect(args.onValueChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ debug_dirs: ["out/b", "out/c"] }),
    );

    const second = canvas.getByRole("group", { name: "Anchors 1" });
    const x = within(second).getByRole("spinbutton", { name: "x" });
    await userEvent.clear(x);
    await userEvent.type(x, "12");
    await expect(canvas.getByTestId("value")).toHaveTextContent('"x": 12');

    const weights = canvas.getByRole("textbox", { name: "Channel weights" });
    // Delete the closing bracket: not JSON any more, and the last good value stays.
    await userEvent.type(weights, "{Backspace}");
    await expect(canvas.getByRole("alert")).toHaveTextContent(/Invalid JSON/);
    await expect(canvas.getByTestId("value")).toHaveTextContent("0.299");
  },
};

/** An integer field refuses a fraction (and says so); a bound the control cannot express — `exclusiveMinimum` — is enforced by the form. */
export const Validation: Story = {
  args: { schema: DETECTOR, value: DETECTOR_VALUE, ui: DETECTOR_UI },
  play: async ({ canvas }) => {
    const radius = canvas.getByRole("spinbutton", { name: "Radius" });
    await userEvent.clear(radius);
    await userEvent.type(radius, "2.5");
    await expect(canvas.getByRole("alert")).toHaveTextContent("Must be a whole number");
    await expect(canvas.getByTestId("value")).not.toHaveTextContent('"radius": 2.5');
    await userEvent.clear(radius);
    await userEvent.type(radius, "5");
    await expect(canvas.queryByRole("alert")).toBeNull();

    const nms = canvas.getByRole("spinbutton", { name: "Nms radius" });
    await userEvent.clear(nms);
    await userEvent.type(nms, "0");
    await expect(canvas.getByRole("alert")).toHaveTextContent("Must be > 0");
  },
};

/** Clearing a number puts the default back; with `restoreDefaultOnClear: false` an optional field is left empty (its key is removed). */
export const ClearRestoresDefault: Story = {
  args: {
    schema: DETECTOR,
    value: { ...(DETECTOR_VALUE as object), nms_radius: 4, blur_sigma: 3 },
    ui: { fields: { blur_sigma: { restoreDefaultOnClear: false } } },
  },
  play: async ({ canvas }) => {
    const nms = canvas.getByRole("spinbutton", { name: "Nms radius" });
    await userEvent.clear(nms);
    await userEvent.tab();
    await expect(nms).toHaveValue(2.5);

    const sigma = canvas.getByRole("spinbutton", { name: "Blur sigma" });
    await userEvent.clear(sigma);
    await userEvent.tab();
    await expect(sigma).toHaveValue(null);
    await expect(canvas.getByTestId("value")).not.toHaveTextContent("blur_sigma");
  },
};

/** An `Option<f64>` whose default is `Some(0.25)`: clearing it removes the key, and `clearTo: "null"` lets the user choose `None`. */
const OPTION_WITH_DEFAULT: JsonSchema = {
  type: "object",
  properties: {
    residual: { type: ["number", "null"], default: 0.25 },
    seeds: { type: ["integer", "null"], default: 512 },
  },
};

export const OptionWithDefault: Story = {
  args: {
    schema: OPTION_WITH_DEFAULT,
    value: { residual: 0.5, seeds: 100 },
    ui: { fields: { residual: { restoreDefaultOnClear: false }, seeds: { clearTo: "null" } } },
  },
  play: async ({ canvas }) => {
    const residual = canvas.getByRole("spinbutton", { name: "Residual" });
    await userEvent.clear(residual);
    await userEvent.tab();
    await expect(residual).toHaveAttribute("placeholder", "0.25");
    await expect(canvas.getByTestId("value")).not.toHaveTextContent("residual");

    const seeds = canvas.getByRole("spinbutton", { name: "Seeds" });
    await userEvent.clear(seeds);
    await userEvent.tab();
    await expect(canvas.getByTestId("value")).toHaveTextContent('"seeds": null');
  },
};

/** A calibration rig config: a `kind`-tagged `SensorMode` whose Scheimpflug variant brings its own fields. */
export const KindTagged: Story = {
  args: { schema: RIG, value: defaultValueForSchema(RIG) },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("radio", { name: "Scheimpflug" }));
    await expect(canvas.getByRole("spinbutton", { name: "Init tilt x" })).toBeVisible();
    await expect(canvas.getByTestId("value")).toHaveTextContent('"kind": "Scheimpflug"');
    await userEvent.click(canvas.getByRole("radio", { name: "Pinhole" }));
    await expect(canvas.queryByRole("spinbutton", { name: "Init tilt x" })).toBeNull();
  },
};

/** A dataset manifest: unions that carry data, `null`-able structs, arrays of objects as JSON. */
export const DatasetManifest: Story = {
  args: {
    schema: DATASET,
    value: {
      version: 1,
      topology: "mono",
      target: { kind: "chessboard", rows: 6, cols: 9, square_size_m: 0.025 },
      cameras: [{ id: "cam0", images: { kind: "glob", pattern: "cam0/*.png" } }],
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("spinbutton", { name: "Rows" })).toHaveValue(6);
    await userEvent.click(canvas.getByRole("switch", { name: "Detector" }));
    await expect(canvas.getByTestId("value")).toHaveTextContent('"detector": {');
  },
};

/** One column, compact density — a form in a narrow inspector rail. */
export const NarrowRail: Story = {
  args: { schema: DETECTOR, value: DETECTOR_VALUE, ui: DETECTOR_UI, columns: 1 },
  render: (args) => (
    <DensityProvider value="compact">
      <div className="max-w-xs">
        <Controlled {...args} />
      </div>
    </DensityProvider>
  ),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("[data-columns='1']")).not.toBeNull();
  },
};

/** Disabled: the value is shown, nothing can be edited. */
export const Disabled: Story = {
  args: { schema: DETECTOR, value: DETECTOR_VALUE, ui: DETECTOR_UI, disabled: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("spinbutton", { name: "Nms radius" })).toBeDisabled();
    await expect(canvas.getByRole("radio", { name: "Fixed" })).toBeDisabled();
    await expect(canvas.getByRole("switch", { name: "Pyramid" })).toBeDisabled();
  },
};

/** The escape hatch: the app takes over `nms_radius` with its own control; every other field is still the form's. */
export const CustomField: Story = {
  args: {
    schema: DETECTOR,
    value: DETECTOR_VALUE,
    ui: DETECTOR_UI,
    renderField: ({ path, value, onChange }) =>
      path === "nms_radius" ? (
        <Field label="Suppression radius (custom)" annotation="app-owned">
          <NumberInput
            aria-label="Suppression radius (custom)"
            value={typeof value === "number" ? value : null}
            min={0.5}
            max={8}
            step={0.5}
            unit="px"
            onValueChange={onChange}
          />
        </Field>
      ) : undefined,
  },
  play: async ({ canvas, args }) => {
    const custom = canvas.getByRole("spinbutton", { name: "Suppression radius (custom)" });
    await userEvent.clear(custom);
    await userEvent.type(custom, "4");
    await expect(args.onValueChange).toHaveBeenLastCalledWith(expect.objectContaining({ nms_radius: 4 }));
    await expect(canvas.queryByRole("spinbutton", { name: "Nms radius" })).toBeNull();
    await expect(canvas.getByRole("spinbutton", { name: "Blur sigma" })).toBeVisible();
  },
};
