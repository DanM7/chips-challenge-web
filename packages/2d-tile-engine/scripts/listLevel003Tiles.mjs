import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const level = JSON.parse(
  fs.readFileSync(
    path.join(
      __dirname,
      "../../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-003.json",
    ),
    "utf8",
  ),
);
normalizeLevelLayers(level);

const interesting = ["chip", "exit", "flippers", "fire_boots", "suction_boots", "ice_skates", "chip_s"];
for (let y = 0; y < level.height; y++) {
  for (let x = 0; x < level.width; x++) {
    const t = getCompositeTile(level, x, y);
    if (interesting.some((i) => t === i || t.includes(i))) {
      console.log(x, y, t);
    }
  }
}
