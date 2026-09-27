/** A colour-vision simulation: typical vision, or a full-severity dichromacy. */
export type Simulation = "none" | "protan" | "deutan" | "tritan";

/** The `--name: #hex;` declarations of one rule block (`:root`, `.dark`) of a stylesheet. */
export declare function cssTokens(css: string, selector: string): Record<string, string>;

/** `fg` at `alpha` over an opaque `bg`, as `bg-normal/12` lands on a panel. */
export declare function composite(fg: string, alpha: number, bg: string): string;

/** The WCAG 2.2 contrast ratio of two opaque colours, 1–21. */
export declare function contrast(a: string, b: string): number;

/** Machado, Oliveira & Fernandes (2009) matrices at full severity, in linear sRGB. */
export declare const SIMULATIONS: Record<Simulation, number[][]>;

/** OKLab distance × 100 between two colours as a reader with `kind` sees them. */
export declare function deltaE(a: string, b: string, kind: Simulation): number;

/** The smallest `deltaE` over typical vision and every simulation. */
export declare function worstDeltaE(a: string, b: string): number;
