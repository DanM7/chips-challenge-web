import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import type { Direction, LevelData } from "../engine/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const level = JSON.parse(
  readFileSync(
    path.join(
      root,
      "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-013.json",
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

function tryRoute(name: string, moves: Direction[]) {
  const runner = createMsCc1SimulationRunner(structuredClone(level));
  for (const d of moves) {
    if (stepMsCc1Simulation(runner, d)) {
      break;
    }
  }
  console.log(name, {
    completed: runner.completed,
    pos: { x: runner.gx, y: runner.gy },
    ticks: runner.buttonPressCtx.moveBoundary,
    chipMoves: runner.chipMoves,
    rem: msSecondsRemaining(999, runner.buttonPressCtx.moveBoundary),
  });
}

tryRoute(
  "hold D 200",
  Array.from({ length: 200 }, () => "down" as Direction),
);
tryRoute("RDL UU DDD", ["right", "down", "left", "up", "up", "down", "down", "down"]);
tryRoute("RDL UU DDD + hold D", [
  "right",
  "down",
  "left",
  "up",
  "up",
  "down",
  "down",
  "down",
  ...Array.from({ length: 200 }, () => "down" as Direction),
]);
