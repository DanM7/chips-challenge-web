import { readFileSync, writeFileSync, copyFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { decodeSolutionMoves } from "../engine/solutionMoves.js";
import type { LevelData } from "../engine/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const level = JSON.parse(
  readFileSync(
    path.join(
      root,
      "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-002.json",
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);
const engineSol = path.join(root, "integration/data/cc1-ms-solutions/level-002.json");
const webSol = path.join(
  root,
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/data/cc1-ms-solutions/level-002.json",
);
const sol = JSON.parse(readFileSync(engineSol, "utf8")) as Record<string, unknown> & {
  moves: string[];
};
const moves = decodeSolutionMoves(sol.moves);
const runner = createMsCc1SimulationRunner(structuredClone(level));
let i = 0;
for (const d of moves) {
  stepMsCc1Simulation(runner, d);
  i++;
  if ([3, 5, 14, 22, 30, 35, 45, 51].includes(i) || runner.completed) {
    console.log(
      i,
      d[0],
      `pos=${runner.gx},${runner.gy}`,
      `c=${runner.playerState.chipsRemainingOnMap}`,
      `t=${runner.buttonPressCtx.moveBoundary}`,
      `bridge=${getCompositeTile(runner.level, 17, 11)}/${getCompositeTile(runner.level, 16, 11)}`,
    );
  }
  if (runner.completed || runner.playerDied) break;
}
const rem = msSecondsRemaining(100, runner.buttonPressCtx.moveBoundary);
console.log({
  completed: runner.completed,
  ticks: runner.buttonPressCtx.moveBoundary,
  rem,
  letters: moves.map((d) => d[0]!.toUpperCase()).join(""),
});

if (runner.completed && rem >= 90) {
  const out = {
    ...sol,
    walkthroughUrl: "https://strategywiki.org/wiki/Chip%27s_Challenge/Levels_1-20",
    boldRouteHint:
      "East chips, blocks 2 then 1 over top water (step dirt both times), top chip, bottom chip, exit west → 90",
    moveVerified: true,
    meetsBoldBudget: true,
    moveSource: `StrategyWiki Lesson 2 bold; engine-verified ${rem}s left (bold 90)`,
    simulatedTicks: runner.buttonPressCtx.moveBoundary,
    simulatedSecondsRemaining: rem,
  };
  writeFileSync(engineSol, JSON.stringify(out, null, 2) + "\n");
  copyFileSync(engineSol, webSol);
  console.log("Updated engine + web level-002.json");
}
