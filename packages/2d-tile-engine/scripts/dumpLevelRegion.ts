import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import type { LevelData } from "../engine/types.js";

const levelNum = process.argv[2] ?? "21";
const y0 = Number.parseInt(process.argv[3] ?? "18", 10);
const y1 = Number.parseInt(process.argv[4] ?? "26", 10);
const x1 = Number.parseInt(process.argv[5] ?? "12", 10);
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

for (let y = y0; y <= y1; y++) {
  let row = "";
  for (let x = 0; x < x1; x++) {
    row += `${getCompositeTile(level, x, y).padEnd(12).slice(0, 11)}|`;
  }
  console.log(`y${String(y).padStart(2)} ${row}`);
}
