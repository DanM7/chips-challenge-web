/**
 * MS CHIPS.EXE object code ($00–$6F) → spritesheet frame in the 13×16 masked grid.
 * Matches Tile World / cc-tileset MS layout: col = floor(code / 16), row = code % 16.
 * @see https://www.muppetlabs.com/~breadbox/software/tworld/tworldff.html
 */
export const MS_TILE_COLUMNS = 13;
export const MS_TILE_ROWS = 16;
export const MS_TILE_SIZE = 32;

/** Frame index for Phaser (left-to-right, top-to-bottom rows in the PNG). */
export function msFrameIndexFromObjectCode(objectCode: number): number {
  if (objectCode < 0 || objectCode > 0x6f) {
    return 0;
  }
  const col = Math.floor(objectCode / 16);
  const row = objectCode % 16;
  return row * MS_TILE_COLUMNS + col;
}

/** Precomputed lookup for all 112 MS object codes. */
export const MS_OBJECT_TO_FRAME: readonly number[] = Array.from(
  { length: 0x70 },
  (_, code) => msFrameIndexFromObjectCode(code),
);
