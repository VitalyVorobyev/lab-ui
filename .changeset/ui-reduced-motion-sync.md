---
"@vitavision/ui": patch
---

Fix: under `prefers-reduced-motion: reduce`, style changes are applied synchronously again (#48). `styles.css` collapsed motion to `0.01ms`, which is still a transition: an element with `transition-property: all` kept its old computed value until the next frame, so code that sets a style and measures in the same tick read stale numbers (mermaid laid a 1508×201 diagram out as 2146×2079). Transitions and animations are now `0s` (delays too). `animationend` still fires at once, so a Radix `Presence` exit animation added by a consumer still unmounts. Apps that scoped `transition-duration: 0s` to work around this can drop it.
