import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile, cellTile } from "../engine/levelRuntime.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const level = JSON.parse(
  fs.readFileSync(
    path.join(
      __dirname,
      "../../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-005.json",
    ),
    "utf8",
  ),
);
normalizeLevelLayers(level);

const interesting = [
  "exit",
  "trap",
  "button_brown",
  "button_red",
  "button_green",
  "cloner",
  "wall",
  "bomb",
  "fire",
  "water",
];
for (let y = 0; y < level.height; y++) {
  for (let x = 0; x < level.width; x++) {
    const c = getCompositeTile(level, x, y);
    const lower = cellTile(level, "lower", x, y);
    const upper = cellTile(level, "upper", x, y);
    if (
      interesting.some((t) => c.includes(t) || lower.includes(t) || upper.includes(t)) ||
      (x >= 15 && x <= 21 && y >= 6 && y <= 21)
    ) {
      if (c !== "empty" || lower !== "empty" || upper !== "empty") {
        console.log(x, y, "composite", c, "lower", lower, "upper", upper);
      }
    }
  }
}

console.log("playerStart", level.playerStart);
console.log("monsters", level.monsters);
