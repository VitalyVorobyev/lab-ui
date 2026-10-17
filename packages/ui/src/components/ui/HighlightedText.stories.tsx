import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import { HighlightedText } from "./HighlightedText";
import { findSpans, type HighlightRule } from "./highlightSpans";

/** Patterns for a UI string: Qt and printf placeholders, ICU arguments, markup tags, and a glossary term. */
const RULES: HighlightRule[] = [
  { pattern: /%(?:\d+|n|[sd])/, kind: "placeholder" },
  { pattern: /\{\w+(?:,[^{}]*)?\}/, kind: "placeholder" },
  { pattern: /<\/?[a-z][^<>]*>/i, kind: "tag" },
  { pattern: /\bParamsManager\b/, kind: "protected-term" },
];

const SOURCE = "Open %1 in <b>ParamsManager</b> ({count} files)";

const meta = {
  title: "ui/HighlightedText",
  component: HighlightedText,
  parameters: {
    docs: {
      description: {
        component: `A string with marked spans: the placeholders, markup tags and protected terms of a UI string,
and where a translation does not match its source.

**Use** it to show a string whose parts matter — next to a translation, in a review list, in a
diff. Pass \`spans\` (\`{ start, end, kind, label? }\`, UTF-16 offsets, overlaps allowed), or build
them with \`findSpans(text, rules)\` from regular expressions. The kinds are \`placeholder\`,
\`tag\`, \`protected-term\` and \`mismatch\`; each has its own shape (an outlined mono box, a mono
face on a quiet box, a dotted underline, a wavy underline with a tint), so none is told by
colour alone. Whitespace and line breaks are kept.

**Don't** use it for rich text: the string is always shown as text, so \`<b>\` reads as the
characters \`<b>\` and is never parsed. Don't use \`mismatch\` unless the app compared the
string with something and found a difference.

**Accessibility**: each span is a \`<mark>\` followed by its kind for screen readers ("%1,
placeholder"); \`labels\` renames or silences a kind, and a span's own \`label\` says why it is
marked ("missing from the translation"). That spoken label is left out when the text is
copied.`,
      },
    },
  },
  args: { text: SOURCE, spans: findSpans(SOURCE, RULES) },
} satisfies Meta<typeof HighlightedText>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const marks = Array.from(canvasElement.querySelectorAll("mark"));
    await expect(marks.map((mark) => mark.dataset["kind"])).toEqual(["placeholder", "tag", "protected-term", "tag", "placeholder"]);
    await expect(marks[0]).toHaveTextContent("%1, placeholder");
    await expect(marks[2]).toHaveTextContent("ParamsManager, protected term");
  },
};

/** Markup in the string is text: there is no `<b>` element, only the characters. */
export const MarkupStaysText: Story = {
  args: { text: '<b>Bold</b> <img src=x onerror="alert(1)"> &amp;', spans: [] },
  render: (args) => <HighlightedText {...args} data-testid="string" />,
  play: async ({ canvas }) => {
    const root = canvas.getByTestId("string");
    await expect(root.querySelector("b, img")).toBeNull();
    await expect(root).toHaveTextContent('<b>Bold</b> <img src=x onerror="alert(1)"> &amp;');
  },
};

/** A translation checked against its source: `%2` is not in the source, and `%1` went missing. */
export const Mismatch: Story = {
  args: {
    text: "%2 in einem neuen Fenster öffnen",
    spans: [
      { start: 0, end: 2, kind: "placeholder" },
      { start: 0, end: 2, kind: "mismatch", label: "not in the source" },
    ],
  },
  play: async ({ canvasElement }) => {
    const mark = canvasElement.querySelector("mark")!;
    await expect(mark).toHaveAttribute("data-kind", "placeholder mismatch");
    await expect(mark).toHaveTextContent("%2, placeholder, not in the source");
  },
};

/** Spans may overlap: the overlap carries both kinds. */
export const Overlapping: Story = {
  args: {
    text: "Delete {count, plural, one {# file} other {# files}}?",
    spans: [
      { start: 7, end: 52, kind: "placeholder" },
      { start: 23, end: 35, kind: "mismatch", label: "plural form missing in the translation" },
    ],
  },
  play: async ({ canvasElement }) => {
    const kinds = Array.from(canvasElement.querySelectorAll("mark"), (mark) => mark.dataset["kind"]);
    await expect(kinds).toEqual(["placeholder", "placeholder mismatch", "placeholder"]);
  },
};

/** `labels` renames or silences what a screen reader hears per kind. */
export const CustomLabels: Story = {
  args: { labels: { tag: null, placeholder: "variable" } },
  play: async ({ canvasElement }) => {
    const marks = Array.from(canvasElement.querySelectorAll("mark"));
    await expect(marks[0]).toHaveTextContent("%1, variable");
    await expect(marks[1]).toHaveTextContent(/^<b>$/);
  },
};

/** Leading spaces and line breaks are part of a UI string, so they are shown as they are. */
export const Whitespace: Story = {
  args: { text: "  Line one\nLine two with %1 ", spans: findSpans("  Line one\nLine two with %1 ", RULES), className: "font-mono" },
  render: (args) => <HighlightedText {...args} data-testid="string" />,
  play: async ({ canvas }) => {
    const root = canvas.getByTestId("string");
    await expect(root).toHaveClass("whitespace-pre-wrap");
    await expect(root.firstChild?.textContent).toBe("  Line one\nLine two with ");
  },
};

/** No spans: just the text. */
export const Plain: Story = {
  args: { text: "Nothing to mark here.", spans: undefined },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("mark")).toBeNull();
  },
};
