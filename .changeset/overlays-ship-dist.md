---
"@vitavision/overlays": patch
---

Ship the compiled `dist/`. 0.1.0 was published without it, so neither the package entry (`dist/index.js`) nor its types resolved; it also carried `workspace:^` ranges in `devDependencies`. The source is unchanged.
