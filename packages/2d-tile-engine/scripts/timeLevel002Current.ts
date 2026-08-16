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
    "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-002.json",
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);
const sol = JSON.parse(
  readFileSync("integration/data/cc1-ms-solutions/level-002.json", "utf8"),
) as { moves: string[] };
const moves = decodeSolutionMoves(sol.moves);
const runner = createMsCc1SimulationRunner(structuredClone(level));
let i = 0;
for (const d of moves) {
  stepMsCc1Simulation(runner, d);
  i++;
  if (runner.playerDied || runner.completed) break;
}
console.log({
  i,
  done: runner.completed,
  died: runner.playerDied,
  ticks: runner.buttonPressCtx.moveBoundary,
  rem: msSecondsRemaining(100, runner.buttonPressCtx.moveBoundary),
  pos: [runner.gx, runner.gy],
  chips: runner.playerState.chipsRemainingOnMap,
  letters: moves.map((d) => d[0]!.toUpperCase()).join(""),
});
