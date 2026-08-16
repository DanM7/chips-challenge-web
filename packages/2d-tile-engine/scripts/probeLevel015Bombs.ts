import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { cellTile } from "../engine/levelRuntime.js";
import type { LevelData } from "../engine/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const level = JSON.parse(
  readFileSync(
    path.join(
      root,
      "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-015.json",
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

for (let y = 0; y < 32; y++) {
  for (let x = 0; x < 32; x++) {
    for (const layer of ["upper", "lower"] as const) {
      const t = cellTile(level, layer, x, y);
      if (
        t === "bomb" ||
        t === "door_red" ||
        t === "door_blue" ||
        t === "block_movable" ||
        t === "key_red" ||
        t === "key_blue"
      ) {
        console.log(t, x, y, layer);
      }
    }
  }
}
