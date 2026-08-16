import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { cellTile, getCompositeTile } from "../engine/levelRuntime.js";
import type { LevelData } from "../engine/types.js";

const levelNum = process.argv[2] ?? "40";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const level = JSON.parse(
  fs.readFileSync(
    path.join(
      __dirname,
      `../../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-${String(levelNum).padStart(3, "0")}.json`,
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

console.log(`Teleports on level ${levelNum}:`);
for (let y = 0; y < level.height; y++) {
  for (let x = 0; x < level.width; x++) {
    if (cellTile(level, "upper", x, y) === "teleport") {
      console.log(`  pad ${x},${y} composite=${getCompositeTile(level, x, y)}`);
    }
  }
}

console.log(`Flippers:`);
for (let y = 0; y < level.height; y++) {
  for (let x = 0; x < level.width; x++) {
    if (getCompositeTile(level, x, y) === "flippers") {
      console.log(`  ${x},${y}`);
    }
  }
}

for (const [label, x, y] of [
  ["chip start", 15, 13],
  ["before death", 15, 11],
  ["death", 22, 11],
  ["up from before", 15, 10],
]) {
  console.log(`${label} ${x},${y} => ${getCompositeTile(level, x, y)}`);
}
