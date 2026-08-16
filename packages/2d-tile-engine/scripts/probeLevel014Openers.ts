import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
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
      "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-014.json",
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

const dirMap: Record<string, Direction> = {
  L: "left",
  R: "right",
  U: "up",
  D: "down",
};

function run(letters: string) {
  const runner = createMsCc1SimulationRunner(structuredClone(level));
  for (const ch of letters) {
    const d = dirMap[ch];
    if (!d) continue;
    stepMsCc1Simulation(runner, d);
    if (runner.playerDied) {
      return {
        died: true,
        death: runner.deathMessage,
        pos: { x: runner.gx, y: runner.gy },
        ticks: runner.buttonPressCtx.moveBoundary,
      };
    }
    if (runner.completed) {
      return {
        done: true,
        pos: { x: runner.gx, y: runner.gy },
        chips: runner.playerState.chipsRemainingOnMap,
        ticks: runner.buttonPressCtx.moveBoundary,
        rem: msSecondsRemaining(250, runner.buttonPressCtx.moveBoundary),
      };
    }
  }
  return {
    pos: { x: runner.gx, y: runner.gy },
    chips: runner.playerState.chipsRemainingOnMap,
    ticks: runner.buttonPressCtx.moveBoundary,
    rem: msSecondsRemaining(250, runner.buttonPressCtx.moveBoundary),
    tile: getCompositeTile(runner.level, runner.gx, runner.gy),
  };
}

for (const route of ["LLD", "DLRLD", "LRLU", "LLDLRLU", "DLRLDLRLU"]) {
  console.log(route, run(route));
}
