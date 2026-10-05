---
"@vitavision/workbench": minor
---

New `Stepper`: the steps of a gated sequence, such as Teach, then Find, then Verify, where a step can be entered only once what it depends on is in place.

```tsx
<Stepper
  aria-label="Inspection steps"
  value={step}
  onValueChange={setStep}
  steps={[
    { id: "teach", label: "Teach", complete: model !== null },
    { id: "find", label: "Find", blockedBy: model ? undefined : "Teach a model first." },
    { id: "verify", label: "Verify", blockedBy: finds ? undefined : "Run Find first." },
  ]}
/>
```

- **Steps:** `{ id, label, blockedBy?, complete? }`, drawn as an ordered list of numbered buttons. A complete step shows a check, a blocked one a lock. `orientation` is `"horizontal"` (the default) or `"vertical"`.
- **Current step:** controlled with `value` / `onValueChange`, or kept by the stepper from `defaultValue`, which defaults to the first step. The current step has `aria-current="step"`. Choosing the current step again does not call `onValueChange`.
- **Blocked steps:** a step with a `blockedBy` reason keeps its Tab stop but has `aria-disabled="true"`. Its reason is its accessible description and its tooltip (a `TooltipProvider` must be above it, as for every tooltip). Choosing it, by click or by key, does nothing. The current step is shown as current even if it has a reason.
- **State:** each step carries `data-state` (`current`, `complete`, `blocked` or `upcoming`), and the list `data-orientation`.
- **`stepStates(steps, current)`**, the rule on its own: each step's state, and whether choosing it would make it current.
