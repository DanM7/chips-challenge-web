import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { cellTile, getCompositeTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import { decodeSolutionMoves } from "../engine/solutionMoves.js";
import type { Direction, LevelData } from "../engine/types.js";
import { readLevelSolution } from "../integration/solutionStorage.js";

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

const tws = decodeSolutionMoves(readLevelSolution<{ moves: string[] }>(15)!.moves) as Direction[];
const r = createMsCc1SimulationRunner(structuredClone(level));
for (const d of tws) {
  stepMsCc1Simulation(r, d);
  if (r.playerState.chipsRemainingOnMap === 0) break;
}

console.log("at", r.gx, r.gy, "tools", r.playerState.tools);
console.log("local map 0-8 x 10-22:");
for (let y = 10; y <= 22; y++) {
  let row = "";
  for (let x = 0; x <= 8; x++) {
    const t = getCompositeTile(r.level, x, y);
    const mark =
      r.gx === x && r.gy === y
        ? "@"
        : t === "wall"
          ? "#"
          : t === "empty"
            ? "."
            : t.startsWith("force")
              ? t[6] ?? "f"
              : t[0];
    row += mark;
  }
  console.log(String(y).padStart(2), row);
}
