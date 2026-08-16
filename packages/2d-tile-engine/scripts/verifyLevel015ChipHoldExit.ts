import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { decodeSolutionMoves } from "../engine/solutionMoves.js";
import { isTrapOpen } from "../engine/msCc1/msCc1Traps.js";
import type { Direction, LevelData } from "../engine/types.js";
import { readLevelSolution } from "../integration/solutionStorage.js";
import { getCompositeTile } from "../engine/levelRuntime.js";

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
for (let i = 0; i < 793; i++) stepMsCc1Simulation(r, tws[i]!);

console.log("start", { x: r.gx, y: r.gy, ticks: r.buttonPressCtx.moveBoundary });

const exit = "DRRUUUDDDDDDDD".split("").map((c) =>
  c === "D" ? "down" : c === "U" ? "up" : c === "R" ? "right" : "left",
) as Direction[];

for (let i = 0; i < exit.length; i++) {
  stepMsCc1Simulation(r, exit[i]!);
  console.log(i + 1, exit[i], {
    pos: { x: r.gx, y: r.gy },
    ticks: r.buttonPressCtx.moveBoundary,
    trapOpen: isTrapOpen(r.buttonPressCtx, 16, 16),
    brownHeld: [...r.buttonPressCtx.heldBrownButtons],
    onTile: getCompositeTile(r.level, r.gx, r.gy),
    died: r.playerDied,
    death: r.deathMessage,
    done: r.completed,
    keys: r.playerState.keys,
  });
  if (r.completed || r.playerDied) break;
}
console.log("rem", msSecondsRemaining(250, r.buttonPressCtx.moveBoundary));
