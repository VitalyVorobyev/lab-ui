---
"@vitavision/ui": patch
---

Declare `tailwindcss` (^4.3) as a peer dependency: `styles.css` is Tailwind v4 source that
`@import`s it, so a consumer always needed it; now the manifest says so.
