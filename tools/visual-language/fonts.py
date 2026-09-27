"""Measure the D1 candidate type families, in the builds each would ship with.

Run: uv run --with fonttools --with brotli python tools/visual-language/fonts.py
(from the repo root, after `bun install`). Prints a Markdown table.
"""

from pathlib import Path

from fontTools.ttLib import TTFont

NM = Path("apps/storybook/node_modules")
FONTS = {
    "IBM Plex Sans (fontsource, variable)": NM / "@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-wght-normal.woff2",
    "Inter (inter-ui, variable latin)": NM / "inter-ui/variable-latin/InterVariable-subset.woff2",
    "IBM Plex Mono 400 (fontsource)": NM / "@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2",
    "IBM Plex Mono 400 (IBM complete)": NM / "@ibm/plex-mono/fonts/complete/woff2/IBMPlexMono-Regular.woff2",
    "Geist Mono (fontsource, variable)": NM / "@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2",
}
# A line an inspector column actually prints: label, value, unit, count.
SAMPLE = "Reprojection error 0.184 px, 42 frames, 1736 corners"
FEATURES = ["tnum", "zero", "cv05", "cv08", "case", "frac"]


def advance(font: TTFont, text: str) -> float:
    cmap = font.getBestCmap()
    hmtx = font["hmtx"]
    return sum(hmtx[cmap[ord(c)]][0] for c in text)


def main() -> None:
    rows = []
    for name, path in FONTS.items():
        font = TTFont(path)
        upm = font["head"].unitsPerEm
        os2 = font["OS/2"]
        cmap = font.getBestCmap()
        digits = {font["hmtx"][cmap[ord(d)]][0] for d in "0123456789"}
        gsub = font["GSUB"].table.FeatureList.FeatureRecord if "GSUB" in font else []
        feats = sorted({r.FeatureTag for r in gsub})
        axes = [a.axisTag + f" {a.minValue:g}–{a.maxValue:g}" for a in font["fvar"].axes] if "fvar" in font else ["static"]
        rows.append(
            (
                name,
                f"{os2.sxHeight / upm:.3f}",
                f"{os2.sCapHeight / upm:.3f}",
                f"{advance(font, SAMPLE) / upm:.2f} em",
                "yes" if len(digits) == 1 else "no (needs tnum)",
                ", ".join(f for f in FEATURES if f in feats) or "—",
                "; ".join(axes),
                f"{path.stat().st_size / 1024:.0f} KB",
            )
        )
    print(f"Sample line: `{SAMPLE}`\n")
    print("| Font | x-height / em | cap height / em | sample width | digits tabular by default | features of interest | axes | woff2 file |")
    print("|---|---|---|---|---|---|---|---|")
    for row in rows:
        print("| " + " | ".join(row) + " |")


if __name__ == "__main__":
    main()
