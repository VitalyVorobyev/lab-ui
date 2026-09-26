import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import type { ComponentProps } from "react";
import { expect, fn, userEvent, waitFor } from "storybook/test";

import { SchemaForm } from "./SchemaForm";
import {
  describeFields,
  initialValues,
  jsonErrors,
  missingRequired,
  outOfRange,
  toOptions,
  type RawValues,
} from "../api/schemaForm";

/**
 * A chessboard corner detector's options, as schemars emits them for a Rust config struct
 * (`#[derive(JsonSchema)]`, draft 2020-12): an enum lands in `$defs` behind a `$ref`, an
 * `Option<T>` is an `anyOf` with `null`, a nested struct is its own `$defs` entry, and the
 * struct's doc comments become `description`s. Not annotated as `OptionsSchema` on purpose —
 * the real thing carries `$schema`, `title` and `format`, which the form ignores.
 */
const DETECTOR_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "ChessboardParams",
  type: "object",
  properties: {
    rows: {
      type: "integer",
      format: "uint32",
      minimum: 2,
      maximum: 64,
      title: "Inner rows",
      description: "Inner corners along the board's short side.",
    },
    cols: {
      type: "integer",
      format: "uint32",
      minimum: 2,
      maximum: 64,
      title: "Inner columns",
      description: "Inner corners along the board's long side.",
    },
    square_mm: {
      type: "number",
      format: "double",
      exclusiveMinimum: 0,
      title: "Square size (mm)",
      description: "Edge length of one printed square.",
    },
    refinement: {
      $ref: "#/$defs/Refinement",
      default: "subpixel",
      description: "How a detected corner is refined.",
      "x-primary": true,
    },
    publish_overlay: {
      type: "boolean",
      default: true,
      description: "Draw the detected grid over the image in the result.",
      "x-primary": true,
    },
    roi: {
      anyOf: [{ $ref: "#/$defs/Roi" }, { type: "null" }],
      default: null,
      title: "Region of interest",
      description: "Search only inside this rectangle, in pixels. Empty searches the whole image.",
    },
    threshold: {
      type: "number",
      format: "double",
      minimum: 0,
      maximum: 1,
      default: 0.2,
      description: "Corner response, relative to the strongest one in the image.",
    },
    sigma: {
      type: "number",
      format: "double",
      exclusiveMinimum: 0,
      default: 1.5,
      description: "Gaussian blur before the response, in pixels.",
    },
    max_corners: {
      type: "integer",
      format: "uint32",
      minimum: 1,
      maximum: 10000,
      default: 500,
      description: "Stop after this many candidates.",
    },
    interpolation: {
      $ref: "#/$defs/Interpolation",
      default: "bilinear",
      description: "Resampling used by the refinement window.",
    },
    channel_weights: {
      type: "array",
      items: { type: "number", format: "double" },
      default: [0.299, 0.587, 0.114],
      description: "Weights for converting a colour image to grey.",
    },
    invert: {
      type: "boolean",
      default: false,
      description: "Treat the board as white-on-black.",
    },
    debug_dir: {
      anyOf: [{ type: "string" }, { type: "null" }],
      default: null,
      description: "Write intermediate images here.",
      "x-primary": false,
    },
  },
  required: ["rows", "cols", "square_mm"],
  $defs: {
    Refinement: {
      type: "string",
      enum: ["none", "subpixel", "saddle"],
      description: "Corner refinement strategy.",
    },
    Interpolation: {
      type: "string",
      enum: ["nearest", "bilinear", "bicubic", "lanczos", "area"],
    },
    Roi: {
      type: "object",
      properties: {
        x: { type: "integer", format: "uint32", minimum: 0 },
        y: { type: "integer", format: "uint32", minimum: 0 },
        width: { type: "integer", format: "uint32", minimum: 1 },
        height: { type: "integer", format: "uint32", minimum: 1 },
      },
      required: ["x", "y", "width", "height"],
    },
  },
};

/** A model's hyperparameters: every field has a working default and nothing is required. */
const MODEL_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "EfficientAdParams",
  type: "object",
  properties: {
    smoothing_sigma: {
      type: "number",
      format: "double",
      minimum: 0,
      default: 4.0,
      description: "Blur applied to the anomaly map, in pixels.",
    },
    score_percentile: {
      type: "number",
      format: "double",
      minimum: 0,
      maximum: 100,
      default: 99.5,
      description: "Which percentile of the map is the image's score.",
    },
    image_size: {
      type: "integer",
      enum: [256, 512],
      default: 256,
      description: "Side length the input is resized to.",
    },
  },
};

const detectorFields = describeFields(DETECTOR_SCHEMA);
const modelFields = describeFields(MODEL_SCHEMA);

/**
 * The form owns no state — the caller does, and decides what to send. This is that caller:
 * it keeps the raw values, reports every change to the story's `onChange` spy, and shows what
 * the page around the form would compute from them (the options sent, the blocking problems).
 */
function StatefulSchemaForm({ fields, values: initial, onChange }: ComponentProps<typeof SchemaForm>) {
  const [values, setValues] = useState<RawValues>(initial);
  const missing = missingRequired(fields, values);
  const range = outOfRange(fields, values);
  const invalidJson = jsonErrors(fields, values);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <SchemaForm
        fields={fields}
        values={values}
        onChange={(next) => {
          setValues(next);
          onChange(next);
        }}
      />
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs text-fg">
        <dt className="font-medium">Missing</dt>
        <dd data-testid="missing">{missing.join(", ") || "—"}</dd>
        <dt className="font-medium">Out of range</dt>
        <dd data-testid="out-of-range">{range.join(", ") || "—"}</dd>
        <dt className="font-medium">Invalid JSON</dt>
        <dd data-testid="invalid-json">{invalidJson.join(", ") || "—"}</dd>
        <dt className="font-medium">Sends</dt>
        <dd>
          <pre data-testid="options" className="font-mono whitespace-pre-wrap">
            {JSON.stringify(toOptions(fields, values))}
          </pre>
        </dd>
      </dl>
    </div>
  );
}

const meta = {
  title: "forms/SchemaForm",
  component: SchemaForm,
  parameters: {
    docs: {
      description: {
        component: `An options form generated from a JSON Schema (draft 2020-12, as schemars or pydantic emit it).
Every decision about which control a field gets lives in \`describeFields\`: an \`enum\` of up to three
values is a segmented control and a longer one a select (a \`$ref\` into \`$defs\` is followed first),
numbers carry the schema's \`minimum\`/\`maximum\` as native bounds and as a visible range, a boolean is a
switch, a list of strings is comma-separated text, and anything else (a nested object, a list of
numbers) is a JSON textarea rather than disappearing.

An empty control means **unset**: the default is shown as a placeholder (or the pre-selected segment)
and is not sent, so the receiving side's default stays the single definition of it. A field with a
working default folds under "Advanced"; \`"x-primary": true\` keeps one visible, \`false\` folds one
whatever its default, and a required field is always visible and marked.

**Don't** use it for a form whose layout is part of the product (a wizard, a settings page with
sections) — hand-build that from \`Field\` and the \`@vitavision/ui\` controls. The form does not own its
values; the caller keeps them and blocks the run on \`missingRequired\`, \`outOfRange\` and \`jsonErrors\`.

**Accessibility**: every control is named by its field label; a segmented control or a select sits in
a labelled \`role="group"\`; a field's description is wired as its description; the required marker is a
separate element; the switch carries its own label; "Advanced" is a native \`<details>\`.`,
      },
    },
  },
  args: { fields: detectorFields, values: initialValues(detectorFields), onChange: fn() },
  render: (args) => <StatefulSchemaForm {...args} />,
} satisfies Meta<typeof SchemaForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/** What an operator sees first: the three required questions empty, the rest folded. */
export const Defaults: Story = {
  play: async ({ canvas, args }) => {
    const square = canvas.getByRole("spinbutton", { name: "Square size (mm)" });
    await expect(square).toHaveValue(null);
    await userEvent.type(square, "24.5");
    await expect(args.onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ square_mm: "24.5" }),
    );
    await expect(canvas.getByTestId("options")).toHaveTextContent('"square_mm":24.5');

    const overlay = canvas.getByRole("switch", { name: /Publish overlay/ });
    await expect(overlay).toBeChecked();
    await userEvent.click(overlay);
    await expect(overlay).not.toBeChecked();
    await expect(args.onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ publish_overlay: false }),
    );
  },
};

/** Required fields and a few folded options changed from their defaults. */
export const WithOverrides: Story = {
  args: {
    values: {
      ...initialValues(detectorFields),
      rows: "6",
      cols: "9",
      square_mm: "25",
      refinement: "saddle",
      roi: '{"x": 40, "y": 32, "width": 1200, "height": 900}',
      threshold: "0.35",
      interpolation: "bicubic",
      channel_weights: "[0.33, 0.33, 0.34]",
      invert: true,
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByTestId("missing")).toHaveTextContent("—");
    await expect(canvas.getByTestId("options")).toHaveTextContent('"refinement":"saddle"');
  },
};

/** One of three required fields filled: the caller blocks the run on the other two. */
export const RequiredMissing: Story = {
  args: { values: { ...initialValues(detectorFields), rows: "6" } },
  play: async ({ canvas }) => {
    await expect(canvas.getByTestId("missing")).toHaveTextContent("Inner columns, Square size (mm)");
    await userEvent.type(canvas.getByRole("spinbutton", { name: "Inner columns" }), "9");
    await expect(canvas.getByTestId("missing")).toHaveTextContent("Square size (mm)");
  },
};

/** Values outside the schema's bounds — pasted, say — and a JSON field that does not parse. */
export const OutOfRange: Story = {
  args: {
    values: {
      ...initialValues(detectorFields),
      rows: "1",
      cols: "9",
      square_mm: "25",
      threshold: "1.5",
      roi: "{x: 40",
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByTestId("out-of-range")).toHaveTextContent("Inner rows, Threshold");
    await expect(canvas.getByTestId("invalid-json")).toHaveTextContent("Region of interest");
    await expect(canvas.getByRole("spinbutton", { name: "Inner rows" })).toBeInvalid();

    const rows = canvas.getByRole("spinbutton", { name: "Inner rows" });
    await userEvent.clear(rows);
    await userEvent.type(rows, "6");
    await expect(canvas.getByTestId("out-of-range")).toHaveTextContent("Threshold");
  },
};

/** The fields with working defaults, behind "Advanced" — opened, and one of them changed. */
export const AdvancedFolded: Story = {
  play: async ({ canvas, canvasElement, args }) => {
    const details = canvasElement.querySelector("details");
    await expect(details).not.toBeNull();
    await expect(details).not.toHaveAttribute("open");

    await userEvent.click(canvas.getByText("Advanced"));
    await waitFor(() => expect(details).toHaveAttribute("open"));

    const invert = canvas.getByRole("switch", { name: /Invert/ });
    await expect(invert).not.toBeChecked();
    await userEvent.click(invert);
    await expect(args.onChange).toHaveBeenLastCalledWith(expect.objectContaining({ invert: true }));
    await expect(canvas.getByTestId("options")).toHaveTextContent('"invert":true');
  },
};

/** A model whose every field has a default: nothing to fold away from, so nothing is folded. */
export const AllDefaulted: Story = {
  args: { fields: modelFields, values: initialValues(modelFields) },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvasElement.querySelector("details")).toBeNull();
    await expect(canvas.getByRole("spinbutton", { name: "Smoothing sigma" })).toHaveAttribute(
      "placeholder",
      "4",
    );
  },
};

/** A plugin with no options at all. */
export const NoOptions: Story = {
  args: { fields: [], values: {} },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/takes no options/)).toBeInTheDocument();
  },
};
