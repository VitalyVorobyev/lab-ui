// @ts-check
/**
 * React rules that Oxlint has no native equivalent for, ported from `@eslint-react`
 * (MIT): the original plugin loads the TypeScript compiler API, which TypeScript 7 does not
 * have.
 *
 * - `vitavision/no-context-provider`: React 19 renders a context as its own provider, so
 *   `<ThemeContext.Provider value>` is `<ThemeContext value>`.
 * - `vitavision/jsx-no-leaked-dollar`: a `$` before `{expr}` in JSX, left over from a
 *   template literal, renders as text.
 * - `vitavision/jsx-no-leaked-semicolon`: a `;` at the start of a JSX text line, left over
 *   from a statement, renders as text.
 */

import { defineRule } from "@oxlint/plugins";

/** @typedef {import("@oxlint/plugins").ESTree.Node} Node */

/**
 * The dotted name of a JSX element (`Foo.Bar.Provider`), or `null` for a fragment or a
 * namespaced name.
 * @param {Node} name
 * @returns {string | null}
 */
function jsxName(name) {
  if (name.type === "JSXIdentifier") return name.name;
  if (name.type === "JSXMemberExpression") {
    const object = jsxName(name.object);
    return object === null ? null : `${object}.${name.property.name}`;
  }
  return null;
}

export const noContextProvider = defineRule({
  meta: {
    type: "suggestion",
    docs: { description: "Render `<Context>` instead of `<Context.Provider>` (React 19)." },
    fixable: "code",
    messages: { provider: "In React 19, render `<{{context}}>` as the provider instead of `<{{context}}.Provider>`." },
    schema: [],
  },
  create(context) {
    if (!context.sourceCode.text.includes(".Provider")) return {};
    return {
      JSXElement(node) {
        const opening = node.openingElement;
        const name = jsxName(opening.name);
        if (name === null || !name.endsWith(".Provider")) return;
        const contextName = name.slice(0, -".Provider".length);
        // Only a context: a library's `Tooltip.Provider` is a component, not a context.
        if (!/(?:^|\.)[A-Z]\w*Context$/.test(contextName)) return;
        const closing = node.closingElement;
        context.report({
          node: opening,
          messageId: "provider",
          data: { context: contextName },
          fix: (fixer) =>
            closing
              ? [fixer.replaceText(opening.name, contextName), fixer.replaceText(closing.name, contextName)]
              : fixer.replaceText(opening.name, contextName),
        });
      },
    };
  },
});

/**
 * Whether a JSX child renders nothing: padding whitespace, `{}` or a comment, or `{""}`.
 * @param {Node} child
 */
function isEmptyChild(child) {
  if (child.type === "JSXText") return child.value.trim() === "";
  if (child.type !== "JSXExpressionContainer") return false;
  const expression = child.expression;
  return expression.type === "JSXEmptyExpression" || (expression.type === "Literal" && expression.value === "");
}

export const jsxNoLeakedDollar = defineRule({
  meta: {
    type: "suggestion",
    docs: { description: "Disallow a `$` before `{expr}` in JSX, a template-literal leftover that renders as text." },
    fixable: "code",
    messages: { dollar: 'Leaked `$` in JSX: it renders as text. Remove it, or write `{"$"}` if it is meant.' },
    schema: [],
  },
  create(context) {
    if (!context.sourceCode.text.includes("$")) return {};
    /** @param {import("@oxlint/plugins").ESTree.JSXElement | import("@oxlint/plugins").ESTree.JSXFragment} node */
    function visit(node) {
      const children = node.children;
      children.forEach((child, index) => {
        if (child.type !== "JSXText" || !child.value.endsWith("$")) return;
        if (children[index + 1]?.type !== "JSXExpressionContainer") return;
        // `<>${price}</>` alone is a currency sign, not a leftover.
        const alone = children.every((sibling, i) => i === index || i === index + 1 || isEmptyChild(sibling));
        if (child.value.trim() === "$" && alone) return;
        const end = child.range[1];
        context.report({
          node: child,
          loc: { start: context.sourceCode.getLocFromIndex(end - 1), end: context.sourceCode.getLocFromIndex(end) },
          messageId: "dollar",
          fix: (fixer) => fixer.removeRange([end - 1, end]),
        });
      });
    }
    return { JSXElement: visit, JSXFragment: visit };
  },
});

export const jsxNoLeakedSemicolon = defineRule({
  meta: {
    type: "problem",
    docs: { description: "Disallow a `;` starting a JSX text line, a statement leftover that renders as text." },
    fixable: "code",
    messages: { semicolon: "Leaked `;` in JSX: it renders as text." },
    schema: [],
  },
  create(context) {
    return {
      JSXText(node) {
        const parent = node.parent;
        if (parent?.type !== "JSXElement" && parent?.type !== "JSXFragment") return;
        if (!/^;+[ \t]*(?:\r\n|\r|\n)/u.test(context.sourceCode.getText(node))) return;
        context.report({ node, messageId: "semicolon", fix: (fixer) => fixer.removeRange([node.range[0], node.range[0] + 1]) });
      },
    };
  },
});
