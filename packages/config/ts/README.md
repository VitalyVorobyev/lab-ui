# @vitavision/config-ts

Shared TypeScript compiler options and a tsdown library preset for the `@vitavision/*`
frontends.

```bash
bun add -d @vitavision/config-ts typescript@^6.0.3
```

## App

```jsonc
// tsconfig.json
{
  "extends": "@vitavision/config-ts/tsconfig.json",
  "include": ["src"]
}
```

The options:
- **Strictness:** `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals` / `noUnusedParameters`, `noFallthroughCasesInSwitch`.
- **Modules:** `verbatimModuleSyntax`, `isolatedModules`, `moduleResolution: "bundler"`, `jsx: "react-jsx"`.
- **Emit:** `noEmit`, because the bundler builds.

## Library in a monorepo

`tsconfig.lib.json` adds `declaration` and the `@vitavision/source` custom condition. With
that condition, a sibling package that maps it to its `src/` in `exports` typechecks without
a prior build.

```jsonc
{ "extends": "@vitavision/config-ts/tsconfig.lib.json", "include": ["src"] }
```

```ts
// tsdown.config.ts (needs tsdown 0.23.0)
import { library } from "@vitavision/config-ts/tsdown";

export default library(); // ESM + declarations from src/index.ts; pass overrides to change it
```

## License

MIT OR Apache-2.0.
