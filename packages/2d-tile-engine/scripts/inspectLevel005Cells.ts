import { readFileSync } from "fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile, cellTile } from "../engine/levelRuntime.js";
import type { LevelData } from "../engine/types.js";

const level = JSON.parse(
  readFileSync(
    "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-005.json",
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

console.log("start", level.playerStart);
console.log("cloneLinks", JSON.stringify(level.cloneLinks, null, 2));
console.log("trapLinks", JSON.stringify(level.trapLinks, null, 2));
console.log("monsters field", level.monsters);

for (const [x, y] of [
  [18, 18],
  [19, 18],
  [20, 18],
  [14, 17],
  [14, 18],
  [16, 18],
  [18, 15],
  [17, 15],
  [16, 15],
  [15, 15],
  [13, 12],
  [12, 12],
]) {
  console.log(
    `${x},${y}`,
    "comp=",
    getCompositeTile(level, x, y),
    "up=",
    cellTile(level, "upper", x, y),
    "lo=",
    cellTile(level, "lower", x, y),
  );
}
