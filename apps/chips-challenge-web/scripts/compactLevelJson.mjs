/**
 * Rewrite level JSON: compact layers + drop redundant hud.inventorySlots.
 * Usage: node scripts/compactLevelJson.mjs [levelsDir]
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const levelsDir =
  process.argv[2] ??
  path.join(__dirname, "../public/games/chips-challenge-1/levels");

function compactLayer(cells) {
  let emptyPrefix = 0;
  while (emptyPrefix < cells.length && cells[emptyPrefix] === "empty") {
    emptyPrefix++;
  }
  return { emptyPrefix, tiles: cells.slice(emptyPrefix) };
}

function expandLayer(layer, cellCount) {
  if (Array.isArray(layer)) {
    return layer.length === cellCount
      ? layer
      : [...layer, ...Array(Math.max(0, cellCount - layer.length)).fill("empty")].slice(
          0,
          cellCount,
        );
  }
  const prefix = layer.emptyPrefix ?? 0;
  const tiles = layer.tiles ?? [];
  const out = Array(cellCount).fill("empty");
  for (let i = 0; i < tiles.length; i++) {
    out[prefix + i] = tiles[i];
  }
  return out;
}

function compactLevelFile(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const cellCount = raw.width * raw.height;
  const lower = expandLayer(raw.layers.lower, cellCount);
  const upper = expandLayer(raw.layers.upper, cellCount);
  raw.layers = {
    lower: compactLayer(lower),
    upper: compactLayer(upper),
  };
  if (raw.hud?.inventorySlots) {
    delete raw.hud.inventorySlots;
  }
  fs.writeFileSync(filePath, `${JSON.stringify(raw, null, 2)}\n`, "utf8");
  const before =
    (Array.isArray(raw.layers.lower) ? raw.layers.lower.length : 0) +
    (Array.isArray(raw.layers.upper) ? raw.layers.upper.length : 0);
  const after =
    2 +
    (raw.layers.lower.tiles?.length ?? 0) +
    (raw.layers.upper.tiles?.length ?? 0);
  return { id: raw.id, cells: cellCount, storedTiles: after };
}

const files = fs
  .readdirSync(levelsDir)
  .filter((f) => /^level-\d+\.json$/i.test(f))
  .sort();

for (const file of files) {
  const info = compactLevelFile(path.join(levelsDir, file));
  console.log(`compacted ${info.id} (${info.cells} cells)`);
}
