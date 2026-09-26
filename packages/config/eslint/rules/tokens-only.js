// @ts-check
/**
 * `vitavision/tokens-only` — gate G5.1 (PLAN §5): in a migrated directory, colour comes from
 * the design tokens and nowhere else. Flags, in any string or template literal:
 *
 *   - a raw Tailwind palette utility: `bg-gray-500`, `text-blue-600/50`, `hover:ring-red-400`;
 *   - a hex colour literal: `#1e293b`, `#fff`.
 *
 * Semantic token utilities (`bg-surface`, `text-fg-muted`, `ring-signal`) are what the rule
 * steers to, and are never flagged.
 */

const PALETTE =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const UTILITY =
  "bg|text|border|border-[trblxyse]|ring|ring-offset|outline|fill|stroke|from|via|to|decoration|divide|placeholder|shadow|accent|caret";

/** Exported for tests. */
export const RAW_PALETTE = new RegExp(`(?:^|[\\s:"'\`])(?:${UTILITY})-(?:${PALETTE})-\\d{2,3}(?:/\\d{1,3})?(?=$|[\\s"'\`])`);
export const HEX = /(?:^|[^\w&])#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/;

/** @type {import("eslint").Rule.RuleModule} */
export const tokensOnly = {
  meta: {
    type: "problem",
    docs: { description: "Colours come from design tokens: no raw Tailwind palette classes, no hex literals." },
    messages: {
      palette: "Raw Tailwind palette class `{{match}}` — use a semantic token (bg-surface, text-fg-muted, …). See docs/visual-language.md.",
      hex: "Hex colour literal `{{match}}` — use a design token (a CSS variable or its utility). See docs/visual-language.md.",
    },
    schema: [],
  },
  create(context) {
    /** @param {import("estree").Node} node @param {string} text */
    function check(node, text) {
      const palette = RAW_PALETTE.exec(text);
      if (palette) {
        context.report({ node, messageId: "palette", data: { match: palette[0].trim().replace(/^[:"'`]/, "") } });
        return;
      }
      const hex = HEX.exec(text);
      if (hex) context.report({ node, messageId: "hex", data: { match: hex[0].replace(/^[^#]/, "") } });
    }
    return {
      Literal(node) {
        if (typeof node.value === "string") check(node, node.value);
      },
      TemplateElement(node) {
        check(node, node.value.cooked ?? node.value.raw);
      },
    };
  },
};
