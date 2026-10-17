import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, waitFor } from "storybook/test";

import { Button } from "./Button";
import { Field } from "./Field";
import { Textarea } from "./Textarea";

const meta = {
  title: "ui/Textarea",
  component: Textarea,
  parameters: {
    docs: {
      description: {
        component: `Multi-line text on the shared control palette and focus treatment: a translated string,
a note, a list, a block of JSON.

**Use** it inside a \`Field\`, which supplies the label and, with an \`error\`, the invalid state.
\`minRows\` / \`maxRows\` make it grow with its content between the two and scroll past \`maxRows\`;
without them it is \`rows\` tall and the reader can resize it. \`mono\` sets the text in IBM Plex Mono,
for code, JSON, or strings whose every character matters. \`onValueChange\` hands over the text
on each edit, alongside the native \`onChange\`.

**Don't** use it for one line of text — that is \`Input\` — or to show text the reader cannot edit.

**Accessibility**: a native \`<textarea>\` with every native attribute passed through. It carries no
label of its own: wrap it in a \`Field\` or give it an \`aria-label\`. \`invalid\`, or a \`Field\`
error, sets \`aria-invalid\` and a border in the defect colour; the field's error text says what
is wrong, so the state is never the colour alone.`,
      },
    },
  },
  args: { "aria-label": "Translation", onChange: fn(), onValueChange: fn() },
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { rows: 3, placeholder: "Übersetzung eingeben" },
  play: async ({ canvas, args }) => {
    const textarea = canvas.getByRole("textbox", { name: "Translation" });
    await userEvent.type(textarea, "Datei öffnen");
    await expect(textarea).toHaveValue("Datei öffnen");
    await expect(args.onValueChange).toHaveBeenLastCalledWith("Datei öffnen");
    await expect(args.onChange).toHaveBeenCalled();
    await expect(textarea).toHaveAttribute("rows", "3");
  },
};

/** Code, JSON and strings with placeholders read better when every character has its own width. */
export const Mono: Story = {
  args: { mono: true, rows: 3, defaultValue: '{ "threshold": 0.5,\n  "kernel": 5 }' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("textbox")).toHaveClass("font-mono");
  },
};

/** Grows from two lines with what is typed, and scrolls once it reaches five. */
export const AutoGrow: Story = {
  args: { minRows: 2, maxRows: 5, defaultValue: "Eine Zeile" },
  play: async ({ canvas }) => {
    const textarea = canvas.getByRole<HTMLTextAreaElement>("textbox");
    const start = textarea.getBoundingClientRect().height;
    await expect(textarea).toHaveAttribute("rows", "2");
    await expect(textarea.style.overflowY).toBe("hidden");

    await userEvent.type(textarea, "{enter}zwei{enter}drei");
    await waitFor(() => expect(textarea.getBoundingClientRect().height).toBeGreaterThan(start));
    const grown = textarea.getBoundingClientRect().height;

    // Past the cap it stops growing and scrolls instead.
    await userEvent.type(textarea, "{enter}vier{enter}fünf{enter}sechs{enter}sieben");
    await waitFor(() => expect(textarea.style.overflowY).toBe("auto"));
    const capped = textarea.getBoundingClientRect().height;
    await expect(capped).toBeGreaterThan(grown);
    await userEvent.type(textarea, "{enter}acht");
    await expect(textarea.getBoundingClientRect().height).toBe(capped);

    // And shrinks back as the text goes.
    await userEvent.clear(textarea);
    await waitFor(() => expect(textarea.getBoundingClientRect().height).toBe(start));
  },
};

/** A controlled value set from outside — a reset — fits the height too. */
export const Controlled: Story = {
  render: function Render(args) {
    const [text, setText] = useState("Zeile 1\nZeile 2\nZeile 3\nZeile 4");
    return (
      <div className="flex flex-col items-start gap-2">
        <Textarea {...args} minRows={1} maxRows={8} value={text} onValueChange={setText} />
        <Button size="sm" onClick={() => setText("")}>
          Reset
        </Button>
      </div>
    );
  },
  play: async ({ canvas }) => {
    const textarea = canvas.getByRole<HTMLTextAreaElement>("textbox");
    const tall = textarea.getBoundingClientRect().height;
    await userEvent.click(canvas.getByRole("button", { name: "Reset" }));
    await expect(textarea).toHaveValue("");
    await waitFor(() => expect(textarea.getBoundingClientRect().height).toBeLessThan(tall));
  },
};

export const Invalid: Story = {
  args: { invalid: true, rows: 2, defaultValue: "Datei %2 öffnen" },
  play: async ({ canvas }) => {
    const textarea = canvas.getByRole("textbox");
    await expect(textarea).toHaveAttribute("aria-invalid", "true");
    await expect(textarea).toHaveAttribute("data-invalid");
  },
};

/** Editing a translated string: the field's error makes the textarea invalid and describes it. */
export const InField: Story = {
  render: (args) => (
    <Field label="German" description="Source: Open %1 in a new window" error="The translation has %2; the source has %1.">
      <Textarea {...args} aria-label={undefined} mono minRows={2} maxRows={6} defaultValue="%2 in einem neuen Fenster öffnen" />
    </Field>
  ),
  play: async ({ canvas }) => {
    const textarea = canvas.getByRole("textbox", { name: "German" });
    await expect(textarea).toHaveAttribute("aria-invalid", "true");
    await expect(textarea).toHaveAccessibleDescription("Source: Open %1 in a new window The translation has %2; the source has %1.");
  },
};

export const Disabled: Story = {
  args: { disabled: true, rows: 2, defaultValue: "Gesperrt" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("textbox")).toBeDisabled();
  },
};
