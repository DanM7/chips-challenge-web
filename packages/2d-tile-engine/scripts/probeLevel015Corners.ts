import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { cellTile, getCompositeTile } from "../engine/levelRuntime.js";
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

function dump(x0: number, y0: number, x1: number, y1: number) {
  console.log(`--- ${x0},${y0}..${x1},${y1}`);
  for (let y = y0; y <= y1; y++) {
    const cells: string[] = [];
    for (let x = x0; x <= x1; x++) {
      const u = cellTile(level, "upper", x, y);
      const l = cellTile(level, "lower", x, y);
      cells.push(`${x}:${u}${l !== "empty" ? "/" + l : ""}`);
    }
    console.log(y, cells.join(" | "));
  }
}

dump(5, 10, 12, 16);
dump(20, 10, 27, 16);
