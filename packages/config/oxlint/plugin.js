// @ts-check
/**
 * The `vitavision` Oxlint plugin: `tokens-only`, which keeps colour in the design tokens, and
 * three React rules Oxlint has no native equivalent for. The rules use the ESLint rule API,
 * so the plugin also loads in ESLint.
 */

import { definePlugin } from "@oxlint/plugins";

import { jsxNoLeakedDollar, jsxNoLeakedSemicolon, noContextProvider } from "./rules/react.js";
import { tokensOnly } from "./rules/tokens-only.js";

export default definePlugin({
  meta: { name: "vitavision" },
  rules: {
    "tokens-only": tokensOnly,
    "no-context-provider": noContextProvider,
    "jsx-no-leaked-dollar": jsxNoLeakedDollar,
    "jsx-no-leaked-semicolon": jsxNoLeakedSemicolon,
  },
});
