import type { Direction } from "./types.js";
import { MS_TILE_COLUMNS, MS_TILE_SIZE } from "../tile-engine/msTileIndex.js";

/** MS object codes for Chip walk frames (columns 4–6, floor background). */
export const MS_CHIP_WALK_OBJECT_CODE: Record<Direction, number> = {
  up: 0x6c,
  left: 0x6d,
  down: 0x6e,
  right: 0x6f,
};

/** MS creatures in columns 4–6 ship with mask columns for compositing over terrain. */
export function msCreatureUsesMaskedSprite(objectCode: number): boolean {
  const col = Math.floor(objectCode / 16);
  return col >= 4 && col <= 6;
}

/** Frame indices for base (floor bg), white-bg overlay, and mask columns. */
export function msMaskedChipFrameTriple(walkObjectCode: number): {
  base: number;
  overlay: number;
  mask: number;
} {
  const col = Math.floor(walkObjectCode / 16);
  const row = walkObjectCode % 16;
  if (col < 4 || col > 6) {
    throw new Error(
      `MS masked Chip frames use object codes in columns 4–6, got 0x${walkObjectCode.toString(16)}`,
    );
  }
  const base = row * MS_TILE_COLUMNS + col;
  return { base, overlay: base + 3, mask: base + 6 };
}

function isMaskFigurePixel(r: number, g: number, b: number): boolean {
  return (r + g + b) / 3 > 128;
}

/**
 * MS masked tile compositing (CHIPS.EXE BitBlt + mask columns 10–12).
 * Mask white = Chip figure; mask black = terrain. Overlay whiteness is not used
 * for transparency (Chip's face has light pixels that must stay opaque).
 * @see Tile World masked format — overlay col +3, mask col +6 from floor-bg creature.
 */
export function compositeMsMaskedPixels(
  floor: Uint8ClampedArray,
  overlay: Uint8ClampedArray,
  mask: Uint8ClampedArray,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(floor.length);
  for (let i = 0; i < floor.length; i += 4) {
    if (isMaskFigurePixel(mask[i]!, mask[i + 1]!, mask[i + 2]!)) {
      out[i] = overlay[i]!;
      out[i + 1] = overlay[i + 1]!;
      out[i + 2] = overlay[i + 2]!;
      out[i + 3] = 255;
    } else {
      out[i] = floor[i]!;
      out[i + 1] = floor[i + 1]!;
      out[i + 2] = floor[i + 2]!;
      out[i + 3] = 255;
    }
  }
  return out;
}

export function copyMsSheetFrame(
  source: CanvasImageSource,
  frameIndex: number,
  sheetWidth = MS_TILE_COLUMNS * MS_TILE_SIZE,
): Uint8ClampedArray {
  const col = frameIndex % MS_TILE_COLUMNS;
  const row = Math.floor(frameIndex / MS_TILE_COLUMNS);
  const sx = col * MS_TILE_SIZE;
  const sy = row * MS_TILE_SIZE;

  const canvas = document.createElement("canvas");
  canvas.width = MS_TILE_SIZE;
  canvas.height = MS_TILE_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("2D canvas not available for MS tile compositing");
  }
  ctx.drawImage(source, sx, sy, MS_TILE_SIZE, MS_TILE_SIZE, 0, 0, MS_TILE_SIZE, MS_TILE_SIZE);
  return ctx.getImageData(0, 0, MS_TILE_SIZE, MS_TILE_SIZE).data;
}

export function compositeMsMaskedFromSheet(
  source: CanvasImageSource,
  floorFrameIndex: number,
  walkObjectCode: number,
): Uint8ClampedArray {
  const { overlay, mask } = msMaskedChipFrameTriple(walkObjectCode);
  const floor = copyMsSheetFrame(source, floorFrameIndex);
  const over = copyMsSheetFrame(source, overlay);
  const m = copyMsSheetFrame(source, mask);
  return compositeMsMaskedPixels(floor, over, m);
}

/** Chip figure only (alpha 0 outside mask) for movement over terrain tiles. */
export function compositeMsMaskedChipOnlyPixels(
  overlay: Uint8ClampedArray,
  mask: Uint8ClampedArray,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(overlay.length);
  for (let i = 0; i < overlay.length; i += 4) {
    if (isMaskFigurePixel(mask[i]!, mask[i + 1]!, mask[i + 2]!)) {
      out[i] = overlay[i]!;
      out[i + 1] = overlay[i + 1]!;
      out[i + 2] = overlay[i + 2]!;
      out[i + 3] = 255;
    } else {
      out[i + 3] = 0;
    }
  }
  return out;
}

export function compositeMsMaskedChipOnlyFromSheet(
  source: CanvasImageSource,
  walkObjectCode: number,
): Uint8ClampedArray {
  const { overlay, mask } = msMaskedChipFrameTriple(walkObjectCode);
  const over = copyMsSheetFrame(source, overlay);
  const m = copyMsSheetFrame(source, mask);
  return compositeMsMaskedChipOnlyPixels(over, m);
}
