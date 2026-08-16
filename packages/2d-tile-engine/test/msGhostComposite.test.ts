import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import {
  compositeMsMaskedPixels,
  msMaskedChipFrameTriple,
} from "../engine/msMaskedComposite.js";
import { msFrameIndexFromObjectCode } from "../tile-engine/msObjectToFrame.js";

const TILES_PNG = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../apps/chips-challenge-web/vendor/chips-challenge-ms/generated/tiles.png",
);

const COLS = 13;
const SZ = 32;

function copyPngFrame(png: PNG, frameIndex: number): Uint8ClampedArray {
  const col = frameIndex % COLS;
  const row = Math.floor(frameIndex / COLS);
  const out = new Uint8ClampedArray(SZ * SZ * 4);
  for (let y = 0; y < SZ; y++) {
    for (let x = 0; x < SZ; x++) {
      const si = ((row * SZ + y) * png.width + (col * SZ + x)) * 4;
      const di = (y * SZ + x) * 4;
      out[di] = png.data[si]!;
      out[di + 1] = png.data[si + 1]!;
      out[di + 2] = png.data[si + 2]!;
      out[di + 3] = 255;
    }
  }
  return out;
}

function figurePixels(pixels: Uint8ClampedArray): number {
  let count = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if ((pixels[i]! + pixels[i + 1]! + pixels[i + 2]!) / 3 > 48) {
      count++;
    }
  }
  return count;
}

describe("MS ghost composite on brown button", () => {
  it("produces visible glider pixels over button_brown floor", () => {
    const png = PNG.sync.read(readFileSync(TILES_PNG));
    const ghost = msMaskedChipFrameTriple(0x50);
    const floorFrame = msFrameIndexFromObjectCode(0x27);
    const floor = copyPngFrame(png, floorFrame);
    const overlay = copyPngFrame(png, ghost.overlay);
    const mask = copyPngFrame(png, ghost.mask);
    const out = compositeMsMaskedPixels(floor, overlay, mask);
    expect(figurePixels(out)).toBeGreaterThan(40);
  });
});
