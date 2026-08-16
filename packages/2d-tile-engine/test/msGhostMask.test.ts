import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { msMaskedChipFrameTriple } from "../engine/msMaskedComposite.js";

const TILES_PNG = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../apps/chips-challenge-web/vendor/chips-challenge-ms/generated/tiles.png",
);

const COLS = 13;
const SZ = 32;

function maskWhiteCount(png: PNG, frameIndex: number): number {
  const col = frameIndex % COLS;
  const row = Math.floor(frameIndex / COLS);
  let count = 0;
  for (let y = 0; y < SZ; y++) {
    for (let x = 0; x < SZ; x++) {
      const i = ((row * SZ + y) * png.width + (col * SZ + x)) * 4;
      if ((png.data[i]! + png.data[i + 1]! + png.data[i + 2]!) / 3 > 128) {
        count++;
      }
    }
  }
  return count;
}

function overlayNonWhiteCount(png: PNG, frameIndex: number): number {
  const col = frameIndex % COLS;
  const row = Math.floor(frameIndex / COLS);
  let count = 0;
  for (let y = 0; y < SZ; y++) {
    for (let x = 0; x < SZ; x++) {
      const i = ((row * SZ + y) * png.width + (col * SZ + x)) * 4;
      const r = png.data[i]!;
      const g = png.data[i + 1]!;
      const b = png.data[i + 2]!;
      if ((r + g + b) / 3 < 220) {
        count++;
      }
    }
  }
  return count;
}

describe("MS ghost mask in extracted tiles.png", () => {
  it("ghost overlay/mask columns contain art (like fireball and ball)", () => {
    const png = PNG.sync.read(readFileSync(TILES_PNG));

    for (const [name, code] of [
      ["fireball", 0x44],
      ["ball_pink", 0x48],
      ["ghost", 0x50],
    ] as const) {
      const triple = msMaskedChipFrameTriple(code);
      const maskWhite = maskWhiteCount(png, triple.mask);
      const overlayArt = overlayNonWhiteCount(png, triple.overlay);
      expect(maskWhite, `${name} mask white pixels`).toBeGreaterThan(20);
      expect(overlayArt, `${name} overlay art pixels`).toBeGreaterThan(20);
    }
  });
});
