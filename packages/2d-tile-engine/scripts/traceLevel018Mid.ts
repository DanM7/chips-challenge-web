import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import { replayTwsRecords } from "../engine/twsReplay.js";
import { readLevelSolution } from "../integration/solutionStorage.js";
import type { LevelData } from "../engine/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const level = JSON.parse(
  readFileSync(
    path.join(root, "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-018.json"),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);
const sol = readLevelSolution<{ twsRecords: { tick: number; direction: number }[] }>(18)!;
const moves = replayTwsRecords(structuredClone(level), sol.twsRecords).chipMoves;
const runner = createMsCc1SimulationRunner(structuredClone(level));
const checkpoints = [50, 80, 100, 120, 150, 180, 200, 220];
for (let i = 0; i < moves.length; i += 1) {
  stepMsCc1Simulation(runner, moves[i]!);
  if (checkpoints.includes(i + 1)) {
    console.log(
      `${i + 1}: ${runner.gx},${runner.gy} ${getCompositeTile(runner.level, runner.gx, runner.gy)} fl=${runner.playerState.hasFlippers} ticks=${runner.buttonPressCtx.moveBoundary}`,
    );
  }
}
