import { describe, it } from "node:test";
import { RuleTester } from "oxlint/plugins-dev";

import { tokensOnly } from "./tokens-only.js";

RuleTester.describe = describe;
RuleTester.it = it;
const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "tsx" } } });

tester.run("tokens-only", tokensOnly, {
  valid: [
    { filename: "Panel.tsx", code: '<div className="bg-surface text-fg-muted ring-signal" />' },
    { filename: "Panel.tsx", code: "const id = '#section';" },
    // Fixtures in tests and stories draw literal colours on purpose.
    { filename: "Panel.test.tsx", code: "const c = '#ff0000';" },
    { filename: "Panel.stories.tsx", code: '<div className="bg-gray-500" />' },
  ],
  invalid: [
    {
      filename: "Panel.tsx",
      code: '<div className="p-2 bg-gray-500" />',
      errors: [{ messageId: "palette", data: { match: "bg-gray-500" } }],
    },
    { filename: "Panel.tsx", code: "const c = `fill: #abcdef`;", errors: [{ messageId: "hex", data: { match: "#abcdef" } }] },
    {
      filename: "Panel.tsx",
      code: "const c = cn('hover:ring-red-400/50');",
      errors: [{ messageId: "palette", data: { match: "ring-red-400/50" } }],
    },
  ],
});
