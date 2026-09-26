/**
 * Property tests for the scale arithmetic (PLAN §4.3): invariants that must hold for any
 * domain, not just the handful of examples in `scale.test.ts`.
 *
 * Inputs come from a seeded PRNG, so a failure reproduces exactly; the failing input is in
 * the assertion message. No property-testing library: the invariants are simple enough that
 * shrinking would not pay for a new dependency.
 */

import { describe, expect, it } from "vitest";

import {
  extent,
  formatTick,
  histogram,
  linePath,
  linearScale,
  logScale,
  niceStep,
  padDomain,
} from "./scale";

const RUNS = 500;

/** mulberry32 — small, fast, and good enough to spread test inputs. */
function prng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A magnitude spread over many decades, signed: what real losses and residuals look like. */
function anyValue(random: () => number, minExp = -3, maxExp = 5): number {
  const magnitude = 10 ** (minExp + random() * (maxExp - minExp));
  return random() < 0.5 ? -magnitude : magnitude;
}

/** A proper domain `[low, high]` with `low < high`. */
function anyDomain(random: () => number): [number, number] {
  const low = anyValue(random);
  const span = 10 ** (-2 + random() * 6);
  return [low, low + span];
}

/** A pixel range, either direction (a y axis runs bottom-up). */
function anyRange(random: () => number): [number, number] {
  const start = random() * 500;
  const length = 10 + random() * 1000;
  return random() < 0.5 ? [start, start + length] : [start + length, start];
}

function forAll(seed: number, property: (random: () => number, run: number) => void) {
  const random = prng(seed);
  for (let run = 0; run < RUNS; run += 1) property(random, run);
}

const NICE_MANTISSAS = [1, 2, 2.5, 5];

describe("niceStep (properties)", () => {
  it("is never below the rough step, and at most twice it", () => {
    forAll(1, (random) => {
      const rough = 10 ** (-8 + random() * 16);
      const step = niceStep(rough);
      expect(step, `rough ${rough}`).toBeGreaterThanOrEqual(rough * (1 - 1e-9));
      expect(step, `rough ${rough}`).toBeLessThanOrEqual(rough * 2 * (1 + 1e-9));
    });
  });

  it("is always 1, 2, 2.5 or 5 times a power of ten", () => {
    forAll(2, (random) => {
      const step = niceStep(10 ** (-8 + random() * 16));
      const mantissa = step / 10 ** Math.floor(Math.log10(step) + 1e-12);
      expect(
        NICE_MANTISSAS.some((nice) => Math.abs(mantissa - nice) < 1e-9),
        `step ${step}, mantissa ${mantissa}`,
      ).toBe(true);
    });
  });

  it("is monotone: a wider rough step never yields a narrower nice one", () => {
    forAll(3, (random) => {
      const a = 10 ** (-6 + random() * 12);
      const b = a * (1 + random() * 3);
      expect(niceStep(b), `${a} < ${b}`).toBeGreaterThanOrEqual(niceStep(a));
    });
  });
});

describe("padDomain (properties)", () => {
  it("always returns a drawable domain that contains the input", () => {
    forAll(4, (random) => {
      const a = anyValue(random);
      const b = random() < 0.3 ? a : anyValue(random);
      const [min, max] = [Math.min(a, b), Math.max(a, b)];
      const [low, high] = padDomain(min, max);
      expect(high, `[${min}, ${max}]`).toBeGreaterThan(low);
      expect(low).toBeLessThanOrEqual(min);
      expect(high).toBeGreaterThanOrEqual(max);
      if (min < max) expect([low, high]).toEqual([min, max]);
    });
  });
});

describe("extent (properties)", () => {
  it("bounds every finite value, and both ends are values from the input", () => {
    forAll(5, (random) => {
      const values = Array.from({ length: 1 + Math.floor(random() * 20) }, () =>
        random() < 0.1 ? Number.NaN : anyValue(random),
      );
      const finite = values.filter(Number.isFinite);
      const [low, high] = extent(values);
      if (finite.length === 0) {
        expect([low, high]).toEqual([0, 1]);
        return;
      }
      expect(finite).toContain(low);
      expect(finite).toContain(high);
      for (const value of finite) {
        expect(value).toBeGreaterThanOrEqual(low);
        expect(value).toBeLessThanOrEqual(high);
      }
    });
  });
});

describe("linearScale (properties)", () => {
  it("maps the domain's ends onto the range's ends", () => {
    forAll(6, (random) => {
      const domain = anyDomain(random);
      const [start, end] = anyRange(random);
      const scale = linearScale(domain, start, end);
      expect(scale.domain).toEqual(domain);
      expect(scale.project(domain[0])).toBeCloseTo(start, 6);
      expect(scale.project(domain[1])).toBeCloseTo(end, 6);
    });
  });

  it("is affine: the midpoint of the domain lands on the midpoint of the range", () => {
    forAll(7, (random) => {
      const domain = anyDomain(random);
      const [start, end] = anyRange(random);
      const scale = linearScale(domain, start, end);
      expect(scale.project((domain[0] + domain[1]) / 2)).toBeCloseTo((start + end) / 2, 6);
    });
  });

  it("preserves order in the range's direction", () => {
    forAll(8, (random) => {
      const domain = anyDomain(random);
      const [start, end] = anyRange(random);
      const scale = linearScale(domain, start, end);
      const span = domain[1] - domain[0];
      const a = domain[0] + random() * span;
      const b = a + (0.01 + random()) * span;
      const direction = Math.sign(end - start);
      expect(Math.sign(scale.project(b) - scale.project(a)), `${a} < ${b}`).toEqual(direction);
    });
  });

  it("ticks: ascending, evenly spaced, inside the domain, and about as many as asked", () => {
    forAll(9, (random) => {
      const domain = anyDomain(random);
      const count = 2 + Math.floor(random() * 9);
      const ticks = linearScale(domain, 0, 100).ticks(count);
      const [low, high] = domain;
      const span = high - low;
      const context = `domain [${low}, ${high}], count ${count}`;

      expect(ticks.length, context).toBeGreaterThanOrEqual(Math.max(1, Math.floor(count / 2)));
      expect(ticks.length, context).toBeLessThanOrEqual(count + 1);

      const step = niceStep(span / count);
      ticks.forEach((tick, index) => {
        expect(tick.value, context).toBeGreaterThanOrEqual(low - step * 1e-6);
        expect(tick.value, context).toBeLessThanOrEqual(high + step * 1e-6);
        const previous = ticks[index - 1];
        if (previous) expect(tick.value - previous.value, context).toBeCloseTo(step, 9);
        expect(tick.label, context).toEqual(formatTick(tick.value, step));
      });
    });
  });

  it("ticks: neighbouring labels never print identically in the decimal range", () => {
    forAll(10, (random) => {
      // The decimal range of `formatTick`: |value| in [1e-3, 1e6), or zero.
      const low = random() * 1e4 * (random() < 0.5 ? -1 : 1);
      const high = low + 10 ** (-1 + random() * 5);
      const ticks = linearScale([low, high], 0, 100).ticks(5);
      const decimal = ticks.filter(
        (tick) => tick.value === 0 || (Math.abs(tick.value) >= 1e-3 && Math.abs(tick.value) < 1e6),
      );
      const labels = decimal.map((tick) => tick.label);
      expect(new Set(labels).size, `[${low}, ${high}]: ${labels.join(" ")}`).toEqual(labels.length);
    });
  });
});

describe("logScale (properties)", () => {
  it("is increasing across the positive reals for an upward range", () => {
    forAll(11, (random) => {
      const low = 10 ** (-9 + random() * 12);
      const high = low * 10 ** (0.5 + random() * 6);
      const scale = logScale([low, high], 0, 300);
      const a = 10 ** (-10 + random() * 20);
      const b = a * (1.01 + random() * 10);
      expect(scale.project(b), `${a} < ${b}`).toBeGreaterThan(scale.project(a));
    });
  });

  it("gives every decade the same number of pixels", () => {
    forAll(12, (random) => {
      const low = 10 ** (-9 + random() * 12);
      const high = low * 10 ** (1 + random() * 6);
      const scale = logScale([low, high], 0, 300);
      const at = 10 ** (-6 + random() * 8);
      const decade = scale.project(at * 10) - scale.project(at);
      expect(decade).toBeCloseTo(scale.project(at * 100) - scale.project(at * 10), 6);
    });
  });

  it("projects every input, zero and negatives included, to a finite pixel", () => {
    forAll(13, (random) => {
      const scale = logScale([10 ** (-4 + random() * 4), 10 ** (1 + random() * 4)], 0, 300);
      expect(Number.isFinite(scale.project(0))).toBe(true);
      expect(Number.isFinite(scale.project(anyValue(random)))).toBe(true);
    });
  });

  it("ticks are ascending powers of ten inside the domain", () => {
    forAll(14, (random) => {
      const low = 10 ** (-9 + random() * 12);
      const high = low * 10 ** (1 + random() * 10);
      const scale = logScale([low, high], 0, 300);
      const ticks = scale.ticks(1 + Math.floor(random() * 8));
      expect(ticks.length).toBeGreaterThan(0);
      ticks.forEach((tick, index) => {
        const exponent = Math.log10(tick.value);
        expect(Math.abs(exponent - Math.round(exponent)), `${tick.value}`).toBeLessThan(1e-9);
        expect(tick.value).toBeGreaterThanOrEqual(scale.domain[0] * (1 - 1e-9));
        expect(tick.value).toBeLessThanOrEqual(scale.domain[1] * (1 + 1e-9));
        const previous = ticks[index - 1];
        if (previous) expect(tick.value).toBeGreaterThan(previous.value);
      });
    });
  });
});

describe("linePath (properties)", () => {
  it("emits one command per finite point, and starts with a move", () => {
    forAll(15, (random) => {
      const x = linearScale([0, 1], 0, 100);
      const y = linearScale([0, 1], 100, 0);
      const points = Array.from({ length: Math.floor(random() * 30) }, () => ({
        x: random(),
        y: random() < 0.15 ? Number.NaN : random(),
      }));
      const finite = points.filter((point) => Number.isFinite(point.y)).length;
      const path = linePath(points, x, y);
      const commands = path.match(/[ML]/g) ?? [];
      expect(commands).toHaveLength(finite);
      if (finite > 0) expect(path.startsWith("M")).toBe(true);
      expect(path).not.toMatch(/NaN|Infinity/);
    });
  });
});

describe("histogram (properties)", () => {
  it("has `count` bins and counts every finite value inside the domain exactly once", () => {
    forAll(16, (random) => {
      const domain = anyDomain(random);
      const count = 1 + Math.floor(random() * 40);
      const [low, high] = domain;
      const values = Array.from({ length: Math.floor(random() * 200) }, () =>
        random() < 0.05 ? Number.NaN : low + random() * (high - low),
      );
      const bins = histogram(values, domain, count);
      expect(bins).toHaveLength(count);
      expect(bins.reduce((sum, bin) => sum + bin, 0)).toEqual(
        values.filter(Number.isFinite).length,
      );
      for (const bin of bins) expect(bin).toBeGreaterThanOrEqual(0);
    });
  });
});
