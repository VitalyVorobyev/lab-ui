import { describe, expect, it } from "vitest";

import type { ValuePlane } from "../api/mapValues";
import { planeRange, rasterizePlane, type Colormap } from "./heatmapRaster";

const plane = (width: number, height: number, values: number[], channels = 1): ValuePlane => ({
  width,
  height,
  stride: 1,
  channels,
  values: Float32Array.from(values),
});

/** Black to white, so the red channel is the position on the map. */
const grey: Colormap = (t) => [Math.round(255 * t), Math.round(255 * t), Math.round(255 * t)];

describe("planeRange", () => {
  it("is the extent of the finite values of the chosen channel", () => {
    expect(planeRange(plane(2, 2, [3, -1, Number.NaN, 7]))).toEqual({ low: -1, high: 7 });
    expect(planeRange(plane(2, 1, [1, 2, 10, 20], 2), 1)).toEqual({ low: 10, high: 20 });
  });

  it("is null for a missing channel or no finite value", () => {
    expect(planeRange(plane(2, 1, [1, 2]), 1)).toBeNull();
    expect(planeRange(plane(2, 1, [1, 2]), -1)).toBeNull();
    expect(planeRange(plane(2, 1, [Number.NaN, Infinity]))).toBeNull();
  });
});

describe("rasterizePlane", () => {
  it("maps the range onto the colour map, opaque where the value is finite", () => {
    const rgba = rasterizePlane(plane(3, 1, [0, 5, 10]), grey);
    expect([...rgba]).toEqual([0, 0, 0, 255, 128, 128, 128, 255, 255, 255, 255, 255]);
  });

  it("leaves NaN and infinite pixels transparent", () => {
    const rgba = rasterizePlane(plane(3, 1, [0, Number.NaN, Infinity]), grey);
    expect([...rgba.slice(3, 4)]).toEqual([255]);
    expect(rgba[7]).toBe(0);
    expect(rgba[11]).toBe(0);
  });

  it("clamps values outside a given range to the end colours", () => {
    const rgba = rasterizePlane(plane(3, 1, [-5, 0.5, 9]), grey, { low: 0, high: 1 });
    expect([rgba[0], rgba[4], rgba[8]]).toEqual([0, 128, 255]);
  });

  it("draws a flat field, or a degenerate range, in the first colour", () => {
    const flat = rasterizePlane(plane(2, 1, [4, 4]), grey);
    expect([flat[0], flat[3], flat[4]]).toEqual([0, 255, 0]);
    const reversed = rasterizePlane(plane(2, 1, [1, 2]), grey, { low: 3, high: 3 });
    expect([reversed[0], reversed[4]]).toEqual([0, 0]);
  });

  it("reads the chosen channel and is transparent for a missing one", () => {
    const rgb = plane(1, 2, [0, 1, 100, 200], 2);
    expect([rasterizePlane(rgb, grey, undefined, 1)[0], rasterizePlane(rgb, grey, undefined, 1)[4]]).toEqual([0, 255]);
    expect([...rasterizePlane(rgb, grey, undefined, 2)]).toEqual(new Array(8).fill(0));
  });
});
