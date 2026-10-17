import { describe, it } from "node:test";
import { RuleTester } from "oxlint/plugins-dev";

import { jsxNoLeakedDollar, jsxNoLeakedSemicolon, noContextProvider } from "./react.js";

RuleTester.describe = describe;
RuleTester.it = it;
const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "tsx" } } });

tester.run("no-context-provider", noContextProvider, {
  valid: [
    "<ThemeContext value={1}><a /></ThemeContext>",
    // A library component called Provider is not a context.
    "<Tooltip.Provider><a /></Tooltip.Provider>",
    "<TooltipPrimitive.Provider delayDuration={0} />",
  ],
  invalid: [
    {
      code: "<ThemeContext.Provider value={1}><a /></ThemeContext.Provider>",
      output: "<ThemeContext value={1}><a /></ThemeContext>",
      errors: [{ messageId: "provider", data: { context: "ThemeContext" } }],
    },
    { code: "<ui.StageContext.Provider value={s} />", output: "<ui.StageContext value={s} />", errors: 1 },
  ],
});

tester.run("jsx-no-leaked-dollar", jsxNoLeakedDollar, {
  valid: ["<p>{price}</p>", "<p>${price}</p>", "<p>$ {price}</p>", "<p>costs ${'$'}{price}</p>".replace("${'$'}", '{"$"}')],
  invalid: [
    { code: "<p>Total ${count} items</p>", output: "<p>Total {count} items</p>", errors: [{ messageId: "dollar" }] },
    { code: "<>a ${b}</>", output: "<>a {b}</>", errors: 1 },
  ],
});

tester.run("jsx-no-leaked-semicolon", jsxNoLeakedSemicolon, {
  valid: ["<p>a; b</p>", "<div>{a}\n  ; not at the start\n</div>"],
  invalid: [{ code: "<div>\n  {value};\n</div>", output: "<div>\n  {value}\n</div>", errors: [{ messageId: "semicolon" }] }],
});
