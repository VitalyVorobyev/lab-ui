"""Colour-vision checks behind docs/visual-language.md §1, §4 and §5.

Run: python3 tools/visual-language/colours.py   (standard library only)

Distances are OKLab ΔE × 100 after simulating each dichromacy with the Machado, Oliveira &
Fernandes (2009) matrices at full severity, applied in linear sRGB — the same test the charts
palette was chosen against (packages/charts/src/styles.css). "none" is typical vision.
"""

import itertools
import math
import re
from pathlib import Path

SIMULATIONS = {
    "none": [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
    "protan": [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
    "deutan": [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
    "tritan": [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
}

ROOT = Path(__file__).resolve().parents[2]


def css_tokens(path: str, selector: str) -> dict[str, str]:
    """The `--name: #hex;` declarations of one rule block, read from the source stylesheet."""
    css = (ROOT / path).read_text()
    start = css.index(f"{selector} {{")
    body = css[start : css.index("}", start)]
    return dict(re.findall(r"--([\w-]+):\s*(#[0-9a-fA-F]{6});", body))


UI, CHARTS = "packages/ui/src/styles.css", "packages/charts/src/styles.css"
CHROME = {"light": css_tokens(UI, ":root"), "dark": css_tokens(UI, ".dark")}
SERIES = {
    theme: [tokens[f"series-{n}"] for n in range(1, 7)]
    for theme, tokens in (("light", css_tokens(CHARTS, ":root")), ("dark", css_tokens(CHARTS, ".dark")))
}
# Overlays sit on the (dark) canvas in both themes: selection is the dark `signal`.
OVERLAY_FIXED = {
    "selection": CHROME["dark"]["signal"],
    "label": "#e8ebed",
    **{k: CHROME["dark"][k] for k in ("normal", "defect", "warn")},
}


def to_linear(channel: float) -> float:
    return channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4


def to_srgb(channel: float) -> float:
    return 12.92 * channel if channel <= 0.0031308 else 1.055 * channel ** (1 / 2.4) - 0.055


def hex_to_linear(value: str) -> list[float]:
    return [to_linear(int(value[i : i + 2], 16) / 255) for i in (1, 3, 5)]


def linear_to_hex(rgb: list[float]) -> str:
    return "#" + "".join(f"{round(to_srgb(c) * 255):02x}" for c in rgb)


def oklab(rgb: list[float]) -> tuple[float, float, float]:
    r, g, b = rgb
    l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
    m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
    s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
    l, m, s = (math.copysign(abs(x) ** (1 / 3), x) for x in (l, m, s))
    return (
        0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
        1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
        0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
    )


def oklch_to_linear(lightness: float, chroma: float, hue: float) -> list[float]:
    a, b = chroma * math.cos(math.radians(hue)), chroma * math.sin(math.radians(hue))
    l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3
    m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3
    s = (lightness - 0.0894841775 * a - 1.2914855480 * b) ** 3
    return [
        4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
    ]


def simulate(rgb: list[float], kind: str) -> tuple[float, float, float]:
    matrix = SIMULATIONS[kind]
    return oklab([min(1.0, max(0.0, sum(matrix[i][j] * rgb[j] for j in range(3)))) for i in range(3)])


def delta(a: list[float], b: list[float], kind: str) -> float:
    return math.dist(simulate(a, kind), simulate(b, kind)) * 100


def worst(a: list[float], b: list[float]) -> float:
    """The smallest distance between two colours over typical vision and every simulation."""
    return min(delta(a, b, kind) for kind in SIMULATIONS)


def series_report() -> None:
    print("## Categorical series: closest pair per simulation\n")
    print("| theme | simulation | min ΔE | pair |\n|---|---|---|---|")
    for theme, palette in SERIES.items():
        colours = [hex_to_linear(c) for c in palette]
        for kind in SIMULATIONS:
            d, i, j = min((delta(a, b, kind), i + 1, j + 1) for (i, a), (j, b) in itertools.combinations(enumerate(colours), 2))
            print(f"| {theme} | {kind} | {d:.1f} | {i} / {j} |")


def chrome_report() -> None:
    print("\n## Chrome: signal against each verdict\n")
    print("| theme | pair | worst ΔE | under |\n|---|---|---|---|")
    for theme, tokens in CHROME.items():
        signal = hex_to_linear(tokens["signal"])
        for verdict in ("normal", "defect", "warn"):
            other = hex_to_linear(tokens[verdict])
            d, kind = min((delta(signal, other, kind), kind) for kind in SIMULATIONS)
            print(f"| {theme} | signal / {verdict} | {d:.1f} | {kind} |")


def overlay_search() -> None:
    """Two role colours, light enough for a dark image, as far as possible from everything else."""
    fixed = [hex_to_linear(c) for c in OVERLAY_FIXED.values()]
    candidates = []
    for lightness in (0.72, 0.76, 0.80):
        for chroma in (0.10, 0.14, 0.18, 0.22):
            for hue in range(0, 360, 6):
                rgb = oklch_to_linear(lightness, chroma, hue)
                if all(-1e-4 <= c <= 1 + 1e-4 for c in rgb):
                    rgb = [min(1.0, max(0.0, c)) for c in rgb]
                    candidates.append((min(worst(rgb, f) for f in fixed), (lightness, chroma, hue), rgb))
    candidates.sort(reverse=True)
    # Maximise the worst case; among ties (at 0.1), keep the two roles furthest apart.
    best = max(
        (round(min(s1, s2, worst(c1, c2)), 1), round(worst(c1, c2), 1), p1, c1, p2, c2)
        for (s1, p1, c1), (s2, p2, c2) in itertools.combinations(candidates[:200], 2)
    )
    score, apart, p1, c1, p2, c2 = best
    print("\n## Overlay roles: OKLCH search\n")
    print(f"Fixed: {OVERLAY_FIXED}\n")
    for name, (lightness, chroma, hue), rgb in (("a", p1, c1), ("b", p2, c2)):
        print(f"- {name}: {linear_to_hex(rgb)}  (oklch {lightness} {chroma} {hue})")
    print(f"\nWorst-case ΔE between any two overlay colours, or an overlay colour and a verdict: {score:.1f}")
    print(f"Worst-case ΔE between a and b: {apart:.1f}")


if __name__ == "__main__":
    series_report()
    chrome_report()
    overlay_search()
