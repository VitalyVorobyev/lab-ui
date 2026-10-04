import { describe, expect, it } from "vitest";

import {
  MAX_SCALE,
  MIN_SCALE_VS_FIT,
  PIXEL_CENTRE,
  clampView,
  fitScale,
  fitView,
  formatScale,
  frameRect,
  imageViewBox,
  initialView,
  insideImage,
  isFit,
  preserveCenter,
  scaleRange,
  steppedScale,
  toImage,
  toScreen,
  zoomAbout,
  type StageView,
} from "./view";

/** 1280×1024, the lab's own frames — 5:4, which no panel is ever exactly. */
const IMAGE = { width: 1280, height: 1024 };
const WIDE = { width: 1200, height: 500 };
const TALL = { width: 400, height: 900 };

describe("fitScale", () => {
  it("uses the constrained axis, whichever it is", () => {
    // Wide box: height runs out first.
    expect(fitScale(WIDE, IMAGE)).toBeCloseTo(500 / 1024, 12);
    // Tall box: width runs out first.
    expect(fitScale(TALL, IMAGE)).toBeCloseTo(400 / 1280, 12);
  });

  it("degrades to 1 rather than to NaN on a zero-sized box", () => {
    expect(fitScale({ width: 0, height: 0 }, IMAGE)).toBe(1);
    expect(fitScale(WIDE, { width: 0, height: 0 })).toBe(1);
  });
});

describe("fit options", () => {
  it("leaves the margin out by default: edge to edge, exactly today's numbers", () => {
    expect(fitScale(WIDE, IMAGE, {})).toBe(fitScale(WIDE, IMAGE));
    expect(fitView(TALL, IMAGE, { padding: 0, upscale: true })).toEqual(fitView(TALL, IMAGE));
  });

  it("takes the padding off each side of the box before it fits", () => {
    // 1200x500 minus 2 x 25 px: the height has 450 px for 1024 image px.
    expect(fitScale(WIDE, IMAGE, { padding: 25 })).toBeCloseTo(450 / 1024, 12);
    const view = fitView(WIDE, IMAGE, { padding: 25 });
    expect(view.ty).toBeCloseTo(25, 9);
    expect(WIDE.width - (view.tx + IMAGE.width * view.scale)).toBeCloseTo(view.tx, 9);
  });

  it("ignores a padding that leaves no room", () => {
    expect(fitScale(WIDE, IMAGE, { padding: 250 })).toBe(fitScale(WIDE, IMAGE));
    expect(fitScale(WIDE, IMAGE, { padding: -10 })).toBe(fitScale(WIDE, IMAGE));
  });

  it("caps the scale at 1 with upscale off, and centres the small image", () => {
    const small = { width: 100, height: 80 };
    expect(fitScale(WIDE, small)).toBeGreaterThan(1);
    expect(fitScale(WIDE, small, { upscale: false })).toBe(1);
    expect(fitView(WIDE, small, { upscale: false })).toEqual({ scale: 1, tx: 550, ty: 210 });
    // A large image is still shrunk to fit.
    expect(fitScale(WIDE, IMAGE, { upscale: false })).toBe(fitScale(WIDE, IMAGE));
  });

  it("opens at 1:1 only when the image fits inside the margin, else at the padded fit", () => {
    expect(initialView(WIDE, { width: 300, height: 400 }, { padding: 24 })).toEqual({ scale: 1, tx: 450, ty: 50 });
    expect(initialView(WIDE, { width: 300, height: 480 }, { padding: 24 }).scale).toBeCloseTo(452 / 480, 12);
    expect(initialView(WIDE, IMAGE)).toEqual(initialView(WIDE, IMAGE, {}));
  });

  it("recognises a view fitted with the options, and only with them", () => {
    const options = { padding: 24, upscale: false };
    const view = fitView(WIDE, IMAGE, options);
    expect(isFit(view, WIDE, IMAGE, options)).toBe(true);
    expect(isFit(view, WIDE, IMAGE)).toBe(false);
  });

  it("re-fits with the options when the box changes", () => {
    const options = { padding: 24 };
    const moved = preserveCenter(fitView(WIDE, IMAGE, options), WIDE, TALL, IMAGE, {}, options);
    expect(moved).toEqual(fitView(TALL, IMAGE, options));
  });
});

describe("toScreen / toImage", () => {
  const views: StageView[] = [
    fitView(WIDE, IMAGE),
    fitView(TALL, IMAGE),
    { scale: 1, tx: 0, ty: 0 },
    { scale: 3.5, tx: -412.25, ty: 88.5 },
    { scale: 0.137, tx: 17, ty: -3.25 },
  ];

  it("round-trips every view", () => {
    for (const view of views) {
      for (const p of [
        { x: 0, y: 0 },
        { x: 1279, y: 1023 },
        { x: 522.9, y: 357.0 },
        { x: 640, y: 512 },
      ]) {
        const back = toImage(view, toScreen(view, p));
        expect(back.x).toBeCloseTo(p.x, 9);
        expect(back.y).toBeCloseTo(p.y, 9);
      }
    }
  });

  it("puts the whole image inside the box at fit, touching on the constrained axis", () => {
    const view = fitView(WIDE, IMAGE);
    // The image's *edges*, which in the pixel-centre convention are half a pixel outside
    // the first and last pixel centres.
    const topLeft = toScreen(view, { x: -PIXEL_CENTRE, y: -PIXEL_CENTRE });
    const bottomRight = toScreen(view, {
      x: IMAGE.width - PIXEL_CENTRE,
      y: IMAGE.height - PIXEL_CENTRE,
    });
    expect(topLeft.y).toBeCloseTo(0, 9);
    expect(bottomRight.y).toBeCloseTo(WIDE.height, 9);
    expect(topLeft.x).toBeGreaterThan(0);
    expect(bottomRight.x).toBeLessThan(WIDE.width);
    // Centred: equal margins.
    expect(topLeft.x).toBeCloseTo(WIDE.width - bottomRight.x, 9);
  });
});

/*
 * The half-pixel that is invisible at fit and four screen pixels of error at 8x. Image
 * results name pixel *centres*; CSS and SVG name the pixel's leading edge.
 */
describe("the pixel-centre convention", () => {
  it("puts pixel 0's centre half a pixel in from the image's left edge", () => {
    const view = { scale: 1, tx: 0, ty: 0 };
    expect(toScreen(view, { x: 0, y: 0 })).toEqual({ x: 0.5, y: 0.5 });
    expect(toScreen(view, { x: 7, y: 3 })).toEqual({ x: 7.5, y: 3.5 });
  });

  it("scales that offset with the zoom, which is why it is not cosmetic", () => {
    const view = { scale: 8, tx: 0, ty: 0 };
    // Four screen pixels between "the centre of pixel 0" and "the image's left edge".
    expect(toScreen(view, { x: 0, y: 0 }).x).toBeCloseTo(4, 9);
    expect(toScreen(view, { x: -PIXEL_CENTRE, y: 0 }).x).toBeCloseTo(0, 9);
  });

  it("reads a pointer at a pixel's exact centre as that pixel", () => {
    const view = { scale: 4, tx: -100, ty: 20 };
    const centre = toScreen(view, { x: 42, y: 17 });
    const back = toImage(view, centre);
    expect(back.x).toBeCloseTo(42, 9);
    expect(back.y).toBeCloseTo(17, 9);
  });

  it("hands an SVG layer a viewBox that agrees with all of the above", () => {
    expect(imageViewBox(IMAGE)).toBe("-0.5 -0.5 1280 1024");
  });

  it("bounds the image by its edges, not by its first and last centres", () => {
    expect(insideImage({ x: -PIXEL_CENTRE, y: -PIXEL_CENTRE }, IMAGE)).toBe(true);
    expect(insideImage({ x: -0.51, y: 0 }, IMAGE)).toBe(false);
    expect(insideImage({ x: IMAGE.width - 0.51, y: 0 }, IMAGE)).toBe(true);
    expect(insideImage({ x: IMAGE.width - PIXEL_CENTRE, y: 0 }, IMAGE)).toBe(false);
  });

  it("frames a rect on its centre in the same convention", () => {
    const box = { width: 900, height: 700 };
    const rect = { x: 100, y: 200, width: 40, height: 30 };
    const view = frameRect(box, IMAGE, rect);
    const centre = toScreen(view, { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
    expect(centre.x).toBeCloseTo(box.width / 2, 6);
    expect(centre.y).toBeCloseTo(box.height / 2, 6);
  });
});

describe("zoomAbout", () => {
  it("holds the anchored image point still", () => {
    const box = { width: 900, height: 700 };
    const view = fitView(box, IMAGE);
    const anchor = { x: 120, y: 640 }; // a corner, where a centre-anchored zoom goes wrong
    const before = toImage(view, anchor);

    let next = view;
    for (const factor of [1.5, 1.5, 1.5, 1 / 1.5]) {
      next = zoomAbout(next, next.scale * factor, anchor);
    }

    const after = toImage(next, anchor);
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
  });
});

describe("clampView", () => {
  const box = { width: 900, height: 700 };

  it("centres an axis the content does not fill, however far it was dragged", () => {
    const view = clampView({ scale: fitScale(box, IMAGE), tx: 9999, ty: -9999 }, box, IMAGE);
    const fit = fitView(box, IMAGE);
    expect(view.tx).toBeCloseTo(fit.tx, 9);
    expect(view.ty).toBeCloseTo(fit.ty, 9);
  });

  it("keeps the viewport covered on an axis the content overflows", () => {
    const view = clampView({ scale: 4, tx: 500, ty: 500 }, box, IMAGE);
    expect(view.tx).toBeCloseTo(0, 9);
    expect(view.ty).toBeCloseTo(0, 9);

    const far = clampView({ scale: 4, tx: -99999, ty: -99999 }, box, IMAGE);
    expect(far.tx).toBeCloseTo(box.width - IMAGE.width * 4, 9);
    expect(far.ty).toBeCloseTo(box.height - IMAGE.height * 4, 9);
  });

  it("with centre bounds, leaves a narrow axis where it is and stops each edge at the centre", () => {
    const centre = { panBounds: "center" } as const;
    const fit = fitScale(box, IMAGE);
    const kept = clampView({ scale: fit, tx: 40, ty: 30 }, box, IMAGE, centre);
    expect(kept.tx).toBe(40);
    expect(kept.ty).toBe(30);

    const left = clampView({ scale: 4, tx: 99999, ty: 99999 }, box, IMAGE, centre);
    expect(left.tx).toBeCloseTo(box.width / 2, 9);
    expect(left.ty).toBeCloseTo(box.height / 2, 9);
    const right = clampView({ scale: 4, tx: -99999, ty: -99999 }, box, IMAGE, centre);
    expect(right.tx).toBeCloseTo(box.width / 2 - IMAGE.width * 4, 9);
    expect(right.ty).toBeCloseTo(box.height / 2 - IMAGE.height * 4, 9);
  });

  it("with centre bounds, a zoom about the pointer keeps its pixel while the image is narrower than the viewport", () => {
    const centre = { panBounds: "center" } as const;
    const start = fitView(box, IMAGE);
    const anchor = { x: start.tx + 20 * start.scale, y: start.ty + 30 * start.scale };
    const zoomed = clampView(zoomAbout(start, start.scale * 1.02, anchor), box, IMAGE, centre);
    expect(IMAGE.width * zoomed.scale).toBeLessThan(box.width);
    expect(toImage(zoomed, anchor).x).toBeCloseTo(toImage(start, anchor).x, 9);
    expect(toImage(zoomed, anchor).y).toBeCloseTo(toImage(start, anchor).y, 9);
  });

  it("allows zooming out below fit, but not indefinitely", () => {
    const [min, max] = scaleRange(box, IMAGE);
    expect(min).toBeCloseTo(fitScale(box, IMAGE) * MIN_SCALE_VS_FIT, 12);
    expect(min).toBeLessThan(fitScale(box, IMAGE));
    expect(max).toBe(MAX_SCALE);
    expect(clampView({ scale: 1e-6, tx: 0, ty: 0 }, box, IMAGE).scale).toBeCloseTo(min, 12);
    expect(clampView({ scale: 1e6, tx: 0, ty: 0 }, box, IMAGE).scale).toBe(MAX_SCALE);
  });
});

describe("preserveCenter — the window-resize regression", () => {
  it("keeps the centred image point centred when the viewport changes shape", () => {
    const from = { width: 1200, height: 900 };
    const to = { width: 700, height: 1300 };
    const view = clampView({ scale: 2, tx: -700, ty: -400 }, from, IMAGE);
    const before = toImage(view, { x: from.width / 2, y: from.height / 2 });

    const next = preserveCenter(view, from, to, IMAGE);
    const after = toImage(next, { x: to.width / 2, y: to.height / 2 });

    expect(next.scale).toBeCloseTo(view.scale, 12);
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
  });

  it("re-fits a fit view rather than preserving its numbers", () => {
    const from = { width: 1200, height: 900 };
    const to = { width: 700, height: 1300 };
    const next = preserveCenter(fitView(from, IMAGE), from, to, IMAGE);
    expect(isFit(next, to, IMAGE)).toBe(true);
    expect(next.scale).toBeCloseTo(fitScale(to, IMAGE), 12);
  });

  it("survives a viewport that has not been measured yet", () => {
    const to = { width: 800, height: 600 };
    const next = preserveCenter(fitView(to, IMAGE), { width: 0, height: 0 }, to, IMAGE);
    expect(isFit(next, to, IMAGE)).toBe(true);
  });
});

describe("isFit", () => {
  const box = { width: 900, height: 700 };

  it("is true for the fit view and false a pixel away from it", () => {
    const fit = fitView(box, IMAGE);
    expect(isFit(fit, box, IMAGE)).toBe(true);
    expect(isFit({ ...fit, tx: fit.tx + 4 }, box, IMAGE)).toBe(false);
    expect(isFit({ ...fit, scale: fit.scale * 1.05 }, box, IMAGE)).toBe(false);
  });
});

describe("frameRect", () => {
  const box = { width: 900, height: 700 };

  it("centres the rect and leaves a proportionate margin", () => {
    const rect = { x: 522.9, y: 357, width: 339.8, height: 274.5 };
    const view = frameRect(box, IMAGE, rect, 0.15);
    const centre = toScreen(view, { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
    expect(centre.x).toBeCloseTo(box.width / 2, 6);
    expect(centre.y).toBeCloseTo(box.height / 2, 6);

    const onScreen = rect.width * view.scale;
    expect(onScreen).toBeLessThan(box.width);
    expect(onScreen).toBeGreaterThan(box.width * 0.6);
  });

  it("does not magnify a single point past the ceiling", () => {
    const view = frameRect(box, IMAGE, { x: 640, y: 512, width: 0, height: 0 });
    expect(view.scale).toBeLessThanOrEqual(MAX_SCALE);
  });
});

describe("steppedScale", () => {
  it("lands on round percentages in both directions", () => {
    expect(steppedScale(1, 1, 0.05, MAX_SCALE)).toBeCloseTo(1.5, 9);
    expect(steppedScale(1, -1, 0.05, MAX_SCALE)).toBeCloseTo(0.6667, 4);
    expect(steppedScale(0.43, 1, 0.05, MAX_SCALE)).toBeCloseTo(0.5, 9);
    expect(steppedScale(0.43, -1, 0.05, MAX_SCALE)).toBeCloseTo(0.3333, 4);
  });

  it("saturates at the ends instead of leaving the range", () => {
    expect(steppedScale(MAX_SCALE, 1, 0.05, MAX_SCALE)).toBe(MAX_SCALE);
    expect(steppedScale(0.05, -1, 0.05, MAX_SCALE)).toBeCloseTo(0.05, 9);
  });

  it("steps onto the floor or the ceiling when they lie between ladder steps", () => {
    // Floor 0.1: below the 0.125 step there is no ladder entry, but the floor is still a
    // step — otherwise "zoom out" stays enabled and does nothing.
    expect(steppedScale(0.125, -1, 0.1, MAX_SCALE)).toBeCloseTo(0.1, 12);
    expect(steppedScale(0.1, -1, 0.1, MAX_SCALE)).toBeCloseTo(0.1, 12);
    // Ceiling 40, above the last 32 step.
    expect(steppedScale(32, 1, 0.05, 40)).toBe(40);
    expect(steppedScale(40, 1, 0.05, 40)).toBe(40);
  });

  it("reaches the floor and the ceiling in finitely many steps from anywhere", () => {
    for (const [min, max] of [
      [0.01, 48],
      [0.1, 40],
      [0.0123, 0.9],
    ] as const) {
      let down = 7;
      for (let i = 0; i < 64 && down > min; i += 1) down = steppedScale(down, -1, min, max);
      expect(down).toBeCloseTo(min, 12);
      let up = 0.2;
      for (let i = 0; i < 64 && up < max; i += 1) up = steppedScale(up, 1, min, max);
      expect(up).toBeCloseTo(max, 12);
    }
  });

  it("still returns something usable when the range admits no ladder entry", () => {
    const value = steppedScale(0.07, 1, 0.071, 0.072);
    expect(value).toBeGreaterThanOrEqual(0.071);
    expect(value).toBeLessThanOrEqual(0.072);
  });
});

describe("formatScale", () => {
  it("reads as a percentage a person would say out loud", () => {
    expect(formatScale(1)).toBe("100%");
    expect(formatScale(0.5)).toBe("50%");
    expect(formatScale(4)).toBe("400%");
    expect(formatScale(0.0833)).toBe("8.3%");
  });
});
