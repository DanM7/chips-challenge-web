import type { TilesetCatalog } from "./types";

/** First occurrence of each tile id wins (stable for authoring). */
export function buildFirstFrameIndexByTileId(catalog: TilesetCatalog): Map<string, number> {
  const map = new Map<string, number>();
  for (let r = 0; r < catalog.tileIds.length; r++) {
    const row = catalog.tileIds[r];
    for (let c = 0; c < row.length; c++) {
      const id = row[c];
      if (id === "" || id == null) continue;
      if (!map.has(id)) {
        map.set(id, r * catalog.columns + c);
      }
    }
  }
  return map;
}
