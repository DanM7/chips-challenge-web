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
      "../../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-004.json",
    ),
    "utf8",
  ),
);
normalizeLevelLayers(level);

const interesting = /chip|exit|socket|button|block|tank|bug|wall|key|door|hint/i;
for (let y = 0; y < level.height; y++) {
  for (let x = 0; x < level.width; x++) {
    const t = getCompositeTile(level, x, y);
    if (interesting.test(t)) console.log(x, y, t);
  }
}
console.log("start", level.playerStart);
console.log("monsters", level.monsters);
