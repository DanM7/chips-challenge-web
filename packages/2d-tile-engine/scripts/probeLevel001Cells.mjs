import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { cellTile, getCompositeTile, isBlockedCell } from "../engine/levelRuntime.js";
import { isDoorTile } from "../tile-engine/tiles.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const level = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "../../../../cc1-asset-extraction-pipeline/.tmp-level1"),
    "utf8",
  ),
);
normalizeLevelLayers(level);

for (let y = 0; y < 32; y++) {
  for (let x = 0; x < 32; x++) {
    const c = getCompositeTile(level, x, y);
    if (c.startsWith("chip") || c.startsWith("key_") || c.startsWith("door_")) {
      console.log(x, y, c);
    }
  }
}
