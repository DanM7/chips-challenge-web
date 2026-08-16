import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { cellTile, getCompositeTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
} from "../engine/msCc1/msCc1Simulation.js";
import type { Direction, LevelData } from "../engine/types.js";

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

const saved = JSON.parse(
  readFileSync(path.join(root, ".tmp/level015-bold-letters.json"), "utf8"),
) as { letters: string[] };
const r = createMsCc1SimulationRunner(structuredClone(level));
for (const ch of saved.letters) {
  if (ch === "W") stepMsCc1Wait(r);
  else
    stepMsCc1Simulation(
      r,
      (ch === "U" ? "up" : ch === "D" ? "down" : ch === "L" ? "left" : "right") as Direction,
    );
}

console.log("pos", r.gx, r.gy);
console.log("all blocks:");
for (let y = 0; y < 32; y++)
  for (let x = 0; x < 32; x++)
    if (getCompositeTile(r.level, x, y) === "block_movable") console.log(x, y);

console.log("SE 20-28 x 12-17:");
for (let y = 12; y <= 17; y++) {
  let row = "";
  for (let x = 20; x <= 28; x++) {
    const t = getCompositeTile(r.level, x, y);
    const m =
      r.gx === x && r.gy === y
        ? "@"
        : t === "wall"
          ? "#"
          : t === "empty"
            ? "."
            : t === "block_movable"
              ? "O"
              : t === "bomb"
                ? "!"
                : t === "key_blue"
                  ? "b"
                  : t[0];
    row += m;
  }
  console.log(y, row);
}
