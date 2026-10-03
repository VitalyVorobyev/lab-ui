---
"@vitavision/ui": minor
"@vitavision/workbench": patch
---

`Toaster` and `toast()` move from `@vitavision/workbench` to `@vitavision/ui`: notifications are a generic primitive, and vitavision (which renders on the server) is the second app that needs them. Moved with their stories and tests; the API is unchanged.

- `@vitavision/ui` exports `Toaster`, `ToasterProps`, `toast`, `createToastStore`, `defaultToastStore` and the types `ToastTone`, `ToastOptions`, `ToastRecord`, `ToastStore`. No new dependency and no new styles: the stack uses the existing tokens, and `styles.css` already scans the component sources.
- `@vitavision/workbench` re-exports the same names from `@vitavision/ui` (the same bindings, so there is still exactly one default store), and `import { toast } from "@vitavision/workbench"` keeps working. **Deprecated:** import them from `@vitavision/ui`; the re-exports are kept for compatibility.
