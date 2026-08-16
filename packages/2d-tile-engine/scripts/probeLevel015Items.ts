import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile, cellTile } from "../engine/levelRuntime.js";
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

const interesting = [
  "flippers",
  "fire_boots",
  "ice_skates",
  "suction_boots",
  "key_red",
  "key_blue",
  "key_yellow",
  "key_green",
  "lock_red",
  "lock_blue",
  "chip",
  "chip_socket",
  "socket",
  "exit",
  "thief",
  "block",
  "button_brown",
  "trap",
  "fireball",
  "glider",
  "bug",
  "tank",
  "walker",
  "blob",
  "teeth",
  "pink_ball",
];

const found: Record<string, Array<{ x: number; y: number; layer: string }>> = {};
for (let y = 0; y < 32; y++) {
  for (let x = 0; x < 32; x++) {
    for (const layer of ["upper", "lower"] as const) {
      const t = cellTile(level, layer, x, y);
      if (interesting.includes(t) || t.includes("boot") || t.includes("key") || t.includes("lock") || t.includes("chip") || t.includes("force") || t.includes("ice")) {
        (found[t] ??= []).push({ x, y, layer });
      }
    }
  }
}

for (const [t, cells] of Object.entries(found).sort()) {
  console.log(t, cells.length, JSON.stringify(cells.slice(0, 20)));
}
console.log("playerStart", level.playerStart);
