import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import { getForceFloorTileAt } from "../engine/msCc1/msCc1Sliding.js";
import type { LevelData } from "../engine/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const level = JSON.parse(
  readFileSync(
    path.join(
      root,
      "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-011.json",
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);
for (let y = 0; y < 32; y++) {
  const cells = [29, 30, 31].map((x) => {
    const t = getCompositeTile(level, x, y);
    const f = getForceFloorTileAt(level, x, y);
    return `${x}:${f ?? t}`;
  });
  console.log(String(y).padStart(2), cells.join("  "));
}
