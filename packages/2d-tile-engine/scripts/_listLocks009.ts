import { readFileSync } from "fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import type { LevelData } from "../engine/types.js";

const level = JSON.parse(
  readFileSync(
    new URL(
      "../../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-009.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

const counts = new Map<string, number>();
for (let y = 0; y < level.height; y++) {
  for (let x = 0; x < level.width; x++) {
    const c = getCompositeTile(level, x, y);
    counts.set(c, (counts.get(c) ?? 0) + 1);
    if (/lock|door|key|red|socket|exit/i.test(c)) {
      console.log("tile", x, y, c);
    }
  }
}
console.log("\nunique tiles with lock/key/door:");
for (const [k, v] of [...counts.entries()].sort()) {
  if (/lock|door|key|socket|gate/i.test(k)) console.log(k, v);
}
