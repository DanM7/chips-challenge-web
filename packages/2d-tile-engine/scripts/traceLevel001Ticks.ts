import { readFileSync } from "node:fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { decodeSolutionMoves } from "../engine/solutionMoves.js";
import type { LevelData } from "../engine/types.js";

const level = JSON.parse(
  readFileSync(
    "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-001.json",
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);
const sol = JSON.parse(
  readFileSync("integration/data/cc1-ms-solutions/level-001.json", "utf8"),
) as { moves: string[] };
const moves = decodeSolutionMoves(sol.moves);
const runner = createMsCc1SimulationRunner(level);
let i = 0;
for (const d of moves) {
  const before = runner.buttonPressCtx.moveBoundary;
  stepMsCc1Simulation(runner, d);
  i++;
  if (i <= 8 || i > moves.length - 3) {
    console.log(
      i,
      d,
      before,
      "->",
      runner.buttonPressCtx.moveBoundary,
      "delta",
      runner.buttonPressCtx.moveBoundary - before,
      "pos",
      runner.gx,
      runner.gy,
    );
  }
}
console.log({
  done: runner.completed,
  ticks: runner.buttonPressCtx.moveBoundary,
  rem: msSecondsRemaining(100, runner.buttonPressCtx.moveBoundary),
  moves: moves.length,
});
