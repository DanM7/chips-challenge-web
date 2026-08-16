import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import { getForceFloorTileAt } from "../engine/msCc1/msCc1Sliding.js";
import type { LevelData } from "../engine/types.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const level = JSON.parse(
  readFileSync(
    path.join(
      root,
      "../../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-009.json",
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

const interesting = new Set([
  "chip",
  "chip_s",
  "key_yellow",
  "key_red",
  "key_blue",
  "key_green",
  "lock_yellow",
  "lock_red",
  "lock_blue",
  "lock_green",
  "button_green",
  "button_blue",
  "button_red",
  "button_brown",
  "exit",
  "socket",
  "block_movable",
  "bomb",
  "water",
  "ice",
  "force_s",
  "force_n",
  "force_e",
  "force_w",
  "force_any",
  "fireball_n",
  "fireball_s",
  "fireball_e",
  "fireball_w",
  "bug_n",
  "bug_s",
  "bug_e",
  "bug_w",
]);

const finds: string[] = [];
for (let y = 0; y < level.height; y++) {
  for (let x = 0; x < level.width; x++) {
    const t = getCompositeTile(level, x, y);
    const f = getForceFloorTileAt(level, x, y);
    if (interesting.has(t) || (f && interesting.has(f))) {
      finds.push(`${x},${y}\t${t}\tforce=${f ?? "-"}`);
    }
  }
}
console.log("size", level.width, level.height);
console.log(finds.join("\n"));
