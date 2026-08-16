import type { LevelData, LevelLayers, LevelLayerCompact } from "./types.js";

export type { LevelLayerCompact };

/** True when JSON uses `{ emptyPrefix, tiles }` instead of a full cell array. */
export function isCompactLayer(
  layer: string[] | LevelLayerCompact,
): layer is LevelLayerCompact {
  return !Array.isArray(layer) && typeof layer === "object" && layer !== null && "tiles" in layer;
}

/** Expand compact storage to a full row-major layer (`width` × `height` cells). */
export function expandLayer(
  layer: string[] | LevelLayerCompact,
  cellCount: number,
): string[] {
  if (Array.isArray(layer)) {
    if (layer.length === cellCount) return layer;
    if (layer.length < cellCount) {
      return [...layer, ...Array(cellCount - layer.length).fill("empty")];
    }
    return layer.slice(0, cellCount);
  }
  const prefix = Math.max(0, layer.emptyPrefix ?? 0);
  const tiles = layer.tiles ?? [];
  if (prefix + tiles.length > cellCount) {
    throw new Error(
      `Layer emptyPrefix (${prefix}) + tiles (${tiles.length}) exceeds ${cellCount} cells`,
    );
  }
  const out = Array(cellCount).fill("empty");
  for (let i = 0; i < tiles.length; i++) {
    out[prefix + i] = tiles[i]!;
  }
  return out;
}

/** Strip leading `empty` cells for JSON export. */
export function compactLayer(cells: string[]): LevelLayerCompact {
  let emptyPrefix = 0;
  while (emptyPrefix < cells.length && cells[emptyPrefix] === "empty") {
    emptyPrefix++;
  }
  return {
    emptyPrefix,
    tiles: cells.slice(emptyPrefix),
  };
}

export function compactLayers(layers: { lower: string[]; upper: string[] }): {
  lower: LevelLayerCompact;
  upper: LevelLayerCompact;
} {
  return {
    lower: compactLayer(layers.lower),
    upper: compactLayer(layers.upper),
  };
}

/** Mutates `level.layers` to full arrays for runtime (loaders, tests). */
export function normalizeLevelLayers(level: LevelData): void {
  const cellCount = level.width * level.height;
  const raw = level.layers as LevelLayers;
  level.layers = {
    lower: expandLayer(raw.lower, cellCount),
    upper: expandLayer(raw.upper, cellCount),
  };
}
