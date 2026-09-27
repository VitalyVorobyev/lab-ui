---
"@vitavision/charts": patch
---

Dark `--series-3` `#8ba3ff` → `#7ba8ff`, so every pair of series stays ≥ 9.4 OKLab ΔE×100 apart under protanopia too (it was 9.1), now held by a unit test. `BarChart` tracks and legend swatches use the radius tokens.
