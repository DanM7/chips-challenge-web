import { TILE_NAMES } from "../tile-engine/tiles.js";
import { msFrameIndexFromObjectCode } from "../tile-engine/msTileIndex.js";

/** Maps DAT tile string ids to MS spritesheet frame indices (from CHIPS.EXE). */
export function buildMsFrameIndexByTileId(): Map<string, number> {
  const map = new Map<string, number>();
  for (const [code, name] of Object.entries(TILE_NAMES)) {
    map.set(name, msFrameIndexFromObjectCode(Number(code)));
  }
  return map;
}
