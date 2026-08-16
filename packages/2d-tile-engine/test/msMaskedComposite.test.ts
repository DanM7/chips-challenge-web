import { describe, expect, it } from "vitest";
import {
  compositeMsMaskedChipOnlyPixels,
  compositeMsMaskedPixels,
  msMaskedChipFrameTriple,
} from "../engine/msMaskedComposite.js";

function rgba(w: number, h: number, fill: [number, number, number, number]): Uint8ClampedArray {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = fill[0];
    data[i + 1] = fill[1];
    data[i + 2] = fill[2];
    data[i + 3] = fill[3];
  }
  return data;
}

describe("msMaskedComposite", () => {
  it("maps chip_s to base, overlay, and mask frame indices", () => {
    expect(msMaskedChipFrameTriple(0x6e)).toEqual({
      base: 14 * 13 + 6,
      overlay: 14 * 13 + 9,
      mask: 14 * 13 + 12,
    });
  });

  it("uses floor where mask is off and chip color where mask is on", () => {
    const floor = rgba(1, 1, [0, 0, 255, 255]);
    const overlay = rgba(1, 1, [200, 100, 50, 255]);
    const mask = rgba(1, 1, [255, 255, 255, 255]);
    const out = compositeMsMaskedPixels(floor, overlay, mask);
    expect([out[0], out[1], out[2]]).toEqual([200, 100, 50]);
  });

  it("keeps light chip pixels where mask is on (face highlights)", () => {
    const floor = rgba(1, 1, [0, 0, 255, 255]);
    const overlay = rgba(1, 1, [255, 250, 245, 255]);
    const mask = rgba(1, 1, [255, 255, 255, 255]);
    const out = compositeMsMaskedPixels(floor, overlay, mask);
    expect([out[0], out[1], out[2]]).toEqual([255, 250, 245]);
  });

  it("uses floor where mask is off", () => {
    const floor = rgba(1, 1, [0, 0, 255, 255]);
    const overlay = rgba(1, 1, [255, 255, 255, 255]);
    const mask = rgba(1, 1, [0, 0, 0, 255]);
    const out = compositeMsMaskedPixels(floor, overlay, mask);
    expect([out[0], out[1], out[2]]).toEqual([0, 0, 255]);
  });

  it("chip-only composite is transparent outside the mask", () => {
    const overlay = rgba(1, 1, [200, 100, 50, 255]);
    const mask = rgba(1, 1, [0, 0, 0, 255]);
    const out = compositeMsMaskedChipOnlyPixels(overlay, mask);
    expect(out[3]).toBe(0);
  });
});
