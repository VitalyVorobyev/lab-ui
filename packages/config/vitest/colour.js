/**
 * Colour checks for token tests: WCAG 2.2 contrast, alpha compositing, and OKLab distance
 * under simulated colour-vision deficiency. The same maths as
 * the lab-ui repository's `tools/visual-language/colours.py`.
 */

/**
 * The `--name: #hex;` declarations of one rule block of a stylesheet.
 *
 * @param {string} css
 * @param {string} selector - e.g. `:root` or `.dark`
 * @returns {Record<string, string>}
 */
export function cssTokens(css, selector) {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`no "${selector} {" block`);
  const body = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6});/gi)].map(([, name, hex]) => [name, hex]));
}

/** @param {string} hex @returns {[number, number, number]} sRGB channels in 0..1 */
function channels(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
}

/** @param {number} c */
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/**
 * `fg` at `alpha` over an opaque `bg`, as `bg-normal/12` lands on a panel.
 *
 * @param {string} fg @param {number} alpha @param {string} bg
 * @returns {string}
 */
export function composite(fg, alpha, bg) {
  const [a, b] = [channels(fg), channels(bg)];
  return `#${a.map((c, i) => Math.round((c * alpha + b[i] * (1 - alpha)) * 255).toString(16).padStart(2, "0")).join("")}`;
}

/** @param {string} hex */
function luminance(hex) {
  const [r, g, b] = channels(hex).map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * WCAG 2.2 contrast ratio, 1–21.
 *
 * @param {string} a @param {string} b
 * @returns {number}
 */
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Machado, Oliveira & Fernandes (2009) at full severity, applied in linear sRGB; `none` is
 * typical vision.
 */
export const SIMULATIONS = {
  none: [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ],
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritan: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

/** @param {number[]} rgb linear sRGB @returns {[number, number, number]} */
function oklab([r, g, b]) {
  const cbrt = (/** @type {number} */ x) => Math.sign(x) * Math.abs(x) ** (1 / 3);
  const l = cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/**
 * OKLab distance × 100 between two colours as a reader with `kind` sees them.
 *
 * @param {string} a @param {string} b
 * @param {keyof typeof SIMULATIONS} kind
 * @returns {number}
 */
export function deltaE(a, b, kind) {
  const matrix = SIMULATIONS[kind];
  const seen = (/** @type {string} */ hex) => {
    const rgb = channels(hex).map(toLinear);
    return oklab(matrix.map((row) => Math.min(1, Math.max(0, row[0] * rgb[0] + row[1] * rgb[1] + row[2] * rgb[2]))));
  };
  const [p, q] = [seen(a), seen(b)];
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) * 100;
}

/**
 * The smallest {@link deltaE} over typical vision and every simulation.
 *
 * @param {string} a @param {string} b
 * @returns {number}
 */
export function worstDeltaE(a, b) {
  return Math.min(...Object.keys(SIMULATIONS).map((kind) => deltaE(a, b, /** @type {keyof typeof SIMULATIONS} */ (kind))));
}
