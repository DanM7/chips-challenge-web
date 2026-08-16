/**
 * Trace level 7 solution and try small edits for bold 139.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { decodeSolutionMoves } from "../engine/solutionMoves.js";
import type { Direction, LevelData } from "../engine/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const level = JSON.parse(
  readFileSync(
    path.join(
      root,
      "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-007.json",
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

const sol = JSON.parse(
  readFileSync(path.join(root, "integration/data/cc1-ms-solutions/level-007.json"), "utf8"),
);
const current = decodeSolutionMoves(sol.moves);

const runner = createMsCc1SimulationRunner(structuredClone(level));
for (let i = 0; i < current.length; i++) {
  stepMsCc1Simulation(runner, current[i]!);
  const rem = msSecondsRemaining(150, runner.buttonPressCtx.moveBoundary);
  if (i % 5 === 0 || runner.completed || runner.playerDied) {
    console.log(
      i + 1,
      current[i]![0]!.toUpperCase(),
      `pos=${runner.gx},${runner.gy}`,
      `keys=${runner.playerState.keys.join("+")}`,
      `tools=${runner.playerState.tools.join("+")}`,
      `chips=${runner.playerState.chipsRemainingOnMap}`,
      `ticks=${runner.buttonPressCtx.moveBoundary}`,
      `rem=${rem}`,
    );
  }
  if (runner.completed || runner.playerDied) break;
}

console.log("FINAL", {
  completed: runner.completed,
  ticks: runner.buttonPressCtx.moveBoundary,
  rem: msSecondsRemaining(150, runner.buttonPressCtx.moveBoundary),
  needTicks: "<=59 for 139",
});
