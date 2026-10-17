// @ts-check
/**
 * The rules of `eslint-plugin-storybook`'s recommended set, ported (MIT) so that linting
 * stories needs neither ESLint nor typescript-eslint. The rule names are the same, so an
 * existing `eslint-disable storybook/…` comment keeps working (Oxlint honours them).
 *
 * The original `await-interactions` only fired when the file's last import happened to be
 * `@storybook/test`; this port checks every file that imports from `storybook/test`.
 */

import { defineRule } from "@oxlint/plugins";

/** @typedef {import("@oxlint/plugins").ESTree.Node} Node */
/** @typedef {import("@oxlint/plugins").ESTree.Program} Program */
/** @typedef {import("@oxlint/plugins").ESTree.ObjectExpression} ObjectExpression */
/** @typedef {{ includeStories?: string[] | RegExp | string | undefined; excludeStories?: string[] | RegExp | string | undefined }} StoryFilter */

const TEST_MODULES = new Set(["storybook/test", "@storybook/test", "@storybook/jest", "@storybook/testing-library"]);

/**
 * Storybook's own export-name to story-name conversion (`toStartCaseStr`).
 * @param {string} key
 */
export function storyNameFromExport(key) {
  return key
    .replace(/[_.-]/g, " ")
    .replace(/([^\n])([A-Z])([a-z])/g, (_, a, b, c) => `${a} ${b}${c}`)
    .replace(/([a-z])([A-Z])/g, (_, a, b) => `${a} ${b}`)
    .replace(/([a-z])([0-9])/gi, (_, a, b) => `${a} ${b}`)
    .replace(/([0-9])([a-z])/gi, (_, a, b) => `${a} ${b}`)
    .replace(/(\s|^)(\w)/g, (_, a, b) => `${a}${b.toUpperCase()}`)
    .replace(/ +/g, " ")
    .trim();
}

/**
 * The meta object of `export default meta` / `export default { … } satisfies Meta`.
 * @param {import("@oxlint/plugins").ESTree.ExportDefaultDeclaration} node
 * @param {import("@oxlint/plugins").Context} context
 * @returns {ObjectExpression | null}
 */
function metaObject(node, context) {
  /** @type {Node | null | undefined} */
  let meta = node.declaration;
  if (meta?.type === "Identifier") {
    const name = meta.name;
    const variable = context.sourceCode.getScope(node).variables.find((v) => v.name === name);
    const def = variable?.defs.find((d) => d.node.type === "VariableDeclarator");
    meta = def?.node.type === "VariableDeclarator" ? def.node.init : null;
  }
  if (meta?.type === "TSAsExpression" || meta?.type === "TSSatisfiesExpression") meta = meta.expression;
  return meta?.type === "ObjectExpression" ? meta : null;
}

/**
 * A property of an object literal by its (identifier) key.
 * @param {ObjectExpression} object
 * @param {string} key
 */
function property(object, key) {
  for (const p of object.properties) if (p.type === "Property" && p.key.type === "Identifier" && p.key.name === key) return p;
  return undefined;
}

/**
 * `includeStories` / `excludeStories` of the meta, when they are literal.
 * @param {ObjectExpression} meta
 * @returns {StoryFilter}
 */
function storyFilter(meta) {
  /** @param {string} key */
  const read = (key) => {
    const value = property(meta, key)?.value;
    if (!value) return undefined;
    if (value.type === "ArrayExpression")
      return value.elements.flatMap((e) => (e?.type === "Literal" && typeof e.value === "string" ? [e.value] : []));
    if (value.type === "Literal" && (typeof value.value === "string" || value.value instanceof RegExp)) return value.value;
    return undefined;
  };
  return { includeStories: read("includeStories"), excludeStories: read("excludeStories") };
}

/**
 * Whether a named export is a story under the meta's filter (Storybook's `isExportStory`).
 * @param {string} name
 * @param {StoryFilter} filter
 */
export function isStoryExport(name, { includeStories, excludeStories }) {
  /** @param {string[] | RegExp | string} pattern */
  const matches = (pattern) => (Array.isArray(pattern) ? pattern.includes(name) : new RegExp(pattern).test(name));
  if (name === "__esModule" || name === "__namedExportsOrder") return false;
  return (!includeStories || matches(includeStories)) && (!excludeStories || !matches(excludeStories));
}

/**
 * The identifiers a named export declares: `export const A`, `export function B`, `export { C }`.
 * @param {import("@oxlint/plugins").ESTree.ExportNamedDeclaration} node
 * @returns {import("@oxlint/plugins").ESTree.Node[]}
 */
function exportedIds(node) {
  const decl = node.declaration;
  if (!decl) return node.specifiers.flatMap((s) => (s.exported.type === "Identifier" ? [s.exported] : []));
  if (decl.type === "VariableDeclaration") return decl.declarations.flatMap((d) => (d.id.type === "Identifier" ? [d.id] : []));
  if (decl.type === "FunctionDeclaration" && decl.id) return [decl.id];
  return [];
}

/** @param {Program} program */
function firstStatement(program) {
  return program.body.find((n) => n.type !== "ImportDeclaration") ?? program.body[0] ?? program;
}

export const defaultExports = defineRule({
  meta: {
    type: "problem",
    docs: { description: "Story files should have a default export." },
    messages: { shouldHaveDefaultExport: "The file should have a default export." },
    schema: [],
  },
  create(context) {
    let found = false;
    return {
      ExportDefaultDeclaration() {
        found = true;
      },
      ExportNamedDeclaration(node) {
        // `export { meta as default }`
        if (node.specifiers.some((s) => s.exported.type === "Identifier" && s.exported.name === "default")) found = true;
      },
      ImportSpecifier(node) {
        if (node.imported.type === "Identifier" && node.imported.name === "storiesOf") found = true;
      },
      VariableDeclaration(node) {
        // CSF 4: `const meta = preview.meta({ … })`.
        if (node.parent?.type !== "Program") return;
        for (const d of node.declarations) {
          const callee = d.init?.type === "CallExpression" ? d.init.callee : null;
          if (callee?.type === "MemberExpression" && callee.property.type === "Identifier" && callee.property.name === "meta") found = true;
        }
      },
      "Program:exit"(program) {
        if (!found) context.report({ node: firstStatement(program), messageId: "shouldHaveDefaultExport" });
      },
    };
  },
});

export const storyExports = defineRule({
  meta: {
    type: "problem",
    docs: { description: "A story file must contain at least one story export." },
    messages: {
      shouldHaveStoryExport: "The file should have at least one story export.",
      shouldHaveStoryExportWithFilters:
        "The file should have at least one story export. Check includeStories / excludeStories: as they are, Storybook uses no story from this file.",
    },
    schema: [],
  },
  create(context) {
    /** @type {ObjectExpression | null} */
    let meta = null;
    /** @type {string[]} */
    const names = [];
    return {
      ExportDefaultDeclaration(node) {
        meta = metaObject(node, context);
      },
      ExportNamedDeclaration(node) {
        for (const id of exportedIds(node)) if (id.type === "Identifier") names.push(id.name);
      },
      "Program:exit"(program) {
        if (!meta) return;
        const filter = storyFilter(meta);
        if (names.some((n) => isStoryExport(n, filter))) return;
        const filtered = filter.includeStories !== undefined || filter.excludeStories !== undefined;
        context.report({
          node: firstStatement(program),
          messageId: filtered ? "shouldHaveStoryExportWithFilters" : "shouldHaveStoryExport",
        });
      },
    };
  },
});

export const preferPascalCase = defineRule({
  meta: {
    type: "suggestion",
    docs: { description: "Stories should use PascalCase." },
    messages: { usePascalCase: "The story should use PascalCase notation: {{name}}" },
    schema: [],
  },
  create(context) {
    /** @type {StoryFilter} */
    let filter = {};
    /** @type {import("@oxlint/plugins").ESTree.BindingIdentifier[]} */
    const ids = [];
    return {
      ExportDefaultDeclaration(node) {
        const meta = metaObject(node, context);
        if (meta) filter = storyFilter(meta);
      },
      ExportNamedDeclaration(node) {
        if (node.declaration?.type !== "VariableDeclaration") return;
        const id = node.declaration.declarations[0]?.id;
        if (id?.type === "Identifier") ids.push(id);
      },
      "Program:exit"() {
        for (const id of ids) {
          if (!isStoryExport(id.name, filter) || id.name.startsWith("_") || /^[A-Z]/.test(id.name)) continue;
          context.report({ node: id, messageId: "usePascalCase", data: { name: id.name } });
        }
      },
    };
  },
});

export const noRedundantStoryName = defineRule({
  meta: {
    type: "suggestion",
    docs: { description: "A story should not have a redundant name property." },
    fixable: "code",
    messages: {
      storyNameIsRedundant:
        "Named exports should not use the name annotation if it is redundant to the name that would be generated by the export name",
    },
    schema: [],
  },
  create(context) {
    return {
      ExportNamedDeclaration(node) {
        const decl = node.declaration;
        if (decl?.type !== "VariableDeclaration") return;
        const declarator = decl.declarations[0];
        if (declarator?.id.type !== "Identifier" || declarator.init?.type !== "ObjectExpression") return;
        const name = property(declarator.init, "name") ?? property(declarator.init, "storyName");
        if (name?.value.type === "Literal" && name.value.value === storyNameFromExport(declarator.id.name))
          context.report({ node: name, messageId: "storyNameIsRedundant" });
      },
    };
  },
});

export const hierarchySeparator = defineRule({
  meta: {
    type: "problem",
    docs: { description: "Deprecated hierarchy separator in title property." },
    fixable: "code",
    messages: { deprecatedHierarchySeparator: "Deprecated hierarchy separator in title property: {{title}}." },
    schema: [],
  },
  create(context) {
    return {
      ExportDefaultDeclaration(node) {
        const meta = metaObject(node, context);
        const title = meta ? property(meta, "title") : undefined;
        if (title?.value.type !== "Literal" || typeof title.value.value !== "string" || !title.value.value.includes("|")) return;
        const value = title.value;
        context.report({
          node: title,
          messageId: "deprecatedHierarchySeparator",
          data: { title: value.value },
          fix: (fixer) => fixer.replaceText(value, context.sourceCode.getText(value).replace(/\|/g, "/")),
        });
      },
    };
  },
});

const RENDERERS = {
  "@storybook/html": "@storybook/html-vite",
  "@storybook/preact": "@storybook/preact-vite",
  "@storybook/react": "@storybook/react-vite",
  "@storybook/server": "@storybook/server-webpack5",
  "@storybook/svelte": "@storybook/svelte-vite",
  "@storybook/vue3": "@storybook/vue3-vite",
  "@storybook/web-components": "@storybook/web-components-vite",
};

export const noRendererPackages = defineRule({
  meta: {
    type: "problem",
    docs: { description: "Do not import renderer packages directly in stories." },
    messages: {
      noRendererPackages: 'Do not import renderer package "{{renderer}}" directly. Use a framework package instead (e.g. {{framework}}).',
    },
    schema: [],
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        if (Object.hasOwn(RENDERERS, source))
          context.report({
            node,
            messageId: "noRendererPackages",
            data: { renderer: source, framework: RENDERERS[/** @type {keyof typeof RENDERERS} */ (source)] },
          });
      },
    };
  },
});

export const useStorybookExpect = defineRule({
  meta: {
    type: "suggestion",
    docs: { description: "Use `expect` from `storybook/test`." },
    messages: { useExpectFromStorybook: "Do not use global expect directly in the story. Import it from `storybook/test` instead." },
    schema: [],
  },
  create(context) {
    let imported = false;
    /** @type {Node[]} */
    const calls = [];
    return {
      ImportDeclaration(node) {
        if (!TEST_MODULES.has(node.source.value)) return;
        if (node.specifiers.some((s) => s.type === "ImportSpecifier" && s.imported.type === "Identifier" && s.imported.name === "expect"))
          imported = true;
      },
      CallExpression(node) {
        if (node.callee.type === "Identifier" && node.callee.name === "expect") calls.push(node.callee);
      },
      "Program:exit"() {
        if (!imported) for (const node of calls) context.report({ node, messageId: "useExpectFromStorybook" });
      },
    };
  },
});

export const useStorybookTestingLibrary = defineRule({
  meta: {
    type: "suggestion",
    docs: { description: "Do not use testing-library directly in stories." },
    messages: {
      dontUseTestingLibraryDirectly: "Do not use `{{library}}` directly in the story. Import the functions from `storybook/test` instead.",
    },
    schema: [],
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        if (node.source.value.includes("@testing-library"))
          context.report({ node, messageId: "dontUseTestingLibraryDirectly", data: { library: node.source.value } });
      },
    };
  },
});

const AWAITED = new Set(["waitFor", "waitForElementToBeRemoved", "wait", "waitForElement", "waitForDomChange", "userEvent", "play"]);

/**
 * The name to report when `call` is an interaction that returns a promise: `userEvent.click()`,
 * `waitFor()`, `findByRole()`, `canvas.findByText()`, `Other.play()`, `expect(x).toX()`.
 * @param {import("@oxlint/plugins").ESTree.CallExpression} call
 * @returns {string | null}
 */
function interaction(call) {
  /** @param {string} name */
  const awaited = (name) => AWAITED.has(name) || name.startsWith("findBy");
  let callee = call.callee;
  if (callee.type === "TSNonNullExpression") callee = callee.expression;
  if (callee.type === "Identifier") return awaited(callee.name) ? callee.name : null;
  if (callee.type !== "MemberExpression") return null;
  const { object, property: prop } = callee;
  if (object.type === "Identifier" && awaited(object.name)) return object.name;
  if (prop.type !== "Identifier") return null;
  if (awaited(prop.name)) return prop.name;
  if (object.type === "CallExpression" && object.callee.type === "Identifier" && object.callee.name === "expect") return prop.name;
  return null;
}

/** @param {Node} node */
function enclosingFunction(node) {
  for (let n = node.parent; n && n.type !== "Program"; n = n.parent)
    if (n.type === "ArrowFunctionExpression" || n.type === "FunctionExpression" || n.type === "FunctionDeclaration") return n;
  return null;
}

/**
 * Whether `fn` is the callback of `waitFor(…)`: an expectation in there is retried, not awaited.
 * @param {Node | null} fn
 */
function isWaitForCallback(fn) {
  const call = fn?.parent;
  return call?.type === "CallExpression" && call.callee.type === "Identifier" && call.callee.name === "waitFor";
}

export const awaitInteractions = defineRule({
  meta: {
    type: "problem",
    docs: { description: "Interactions should be awaited." },
    fixable: "code",
    messages: { interactionShouldBeAwaited: "Interaction should be awaited: {{method}}" },
    schema: [],
  },
  create(context) {
    let fromStorybook = false;
    /** @type {{ node: import("@oxlint/plugins").ESTree.CallExpression, method: string }[]} */
    const pending = [];
    return {
      ImportDeclaration(node) {
        if (TEST_MODULES.has(node.source.value)) fromStorybook = true;
      },
      CallExpression(node) {
        const method = interaction(node);
        if (!method) return;
        const parent = node.parent;
        // Awaited, or handed on to a caller that can await it.
        if (parent.type === "AwaitExpression" || parent.parent?.type === "AwaitExpression") return;
        if (parent.type === "ArrowFunctionExpression" || parent.type === "ReturnStatement") return;
        if (isWaitForCallback(enclosingFunction(node))) return;
        pending.push({ node, method });
      },
      "Program:exit"() {
        if (!fromStorybook) return;
        for (const { node, method } of pending) {
          const fn = enclosingFunction(node);
          context.report({
            node,
            messageId: "interactionShouldBeAwaited",
            data: { method },
            fix: (fixer) =>
              fn && !fn.async
                ? [fixer.insertTextBefore(node, "await "), fixer.insertTextBefore(fn, "async ")]
                : fixer.insertTextBefore(node, "await "),
          });
        }
      },
    };
  },
});

export const contextInPlayFunction = defineRule({
  meta: {
    type: "problem",
    docs: { description: "Pass a context when invoking the play function of another story." },
    messages: { passContextToPlayFunction: "Pass a context when invoking play function of another story" },
    schema: [],
  },
  create(context) {
    /** @param {import("@oxlint/plugins").ESTree.CallExpression} call */
    function isPlay(call) {
      let callee = call.callee;
      if (callee.type === "TSNonNullExpression") callee = callee.expression;
      return callee.type === "MemberExpression" && callee.property.type === "Identifier" && callee.property.name === "play";
    }
    /**
     * The name the enclosing arrow function gives its context: `(ctx) =>`, `({ context }) =>`, `({ ...ctx }) =>`.
     * @param {Node} node
     * @returns {string | undefined}
     */
    function contextName(node) {
      let n = /** @type {Node | null | undefined} */ (node);
      while (n && n.type !== "ArrowFunctionExpression") n = n.parent;
      const param = n?.params[0];
      if (!param) return undefined;
      if (param.type === "Identifier") return param.name;
      if (param.type !== "ObjectPattern") return undefined;
      if (param.properties.some((p) => p.type === "Property" && p.key.type === "Identifier" && p.key.name === "context")) return "context";
      const rest = param.properties.find((p) => p.type === "RestElement");
      return rest?.argument.type === "Identifier" ? rest.argument.name : undefined;
    }
    return {
      CallExpression(node) {
        if (!isPlay(node)) return;
        const arg = node.arguments[0];
        const name = contextName(node);
        const passed =
          name !== undefined &&
          arg !== undefined &&
          ((node.arguments.length === 1 && arg.type === "Identifier" && arg.name === name) ||
            (arg.type === "ObjectExpression" &&
              arg.properties.some((p) => p.type === "SpreadElement" && p.argument.type === "Identifier" && p.argument.name === name)));
        if (!passed) context.report({ node, messageId: "passContextToPlayFunction" });
      },
    };
  },
});
