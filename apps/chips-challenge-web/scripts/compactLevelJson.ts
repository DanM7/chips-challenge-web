/**
 * Rewrite level JSON: compact layers + drop redundant hud.inventorySlots.
 * Usage: npx tsx scripts/compactLevelJson.ts [levelsDir]
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { compactLayer, expandLayer } from "@engine/levelLayers.js";
import { getGamePackDir } from "./cc1Paths.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const levelsDir = process.argv[2] ?? getGamePackDir("levels");

function compactLevelFile(filePath: string): { id: string; cells: number } {
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
  return { id: raw.id, cells: cellCount };
}

const files = fs
  .readdirSync(levelsDir)
  .filter((f) => /^level-\d+\.json$/i.test(f))
  .sort();

for (const file of files) {
  const info = compactLevelFile(path.join(levelsDir, file));
  console.log(`compacted ${info.id} (${info.cells} cells)`);
}
