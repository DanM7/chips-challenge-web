import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import { decodeSolutionMoves } from "../engine/solutionMoves.js";
import type { LevelData } from "../engine/types.js";
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

const moves = decodeSolutionMoves(readLevelSolution<{ moves: string[] }>(15)!.moves);
const runner = createMsCc1SimulationRunner(structuredClone(level));

const milestones = [
  { name: "flippers", test: () => runner.playerState.tools.includes("flippers") },
  { name: "suction", test: () => runner.playerState.tools.includes("suction") },
  { name: "chips10", test: () => runner.playerState.chipsRemainingOnMap <= 10 },
  { name: "chips8", test: () => runner.playerState.chipsRemainingOnMap <= 8 },
  { name: "fire", test: () => runner.playerState.tools.includes("fire") },
  { name: "skates", test: () => runner.playerState.tools.includes("skates") },
  { name: "chips2", test: () => runner.playerState.chipsRemainingOnMap <= 2 },
  { name: "chips0", test: () => runner.playerState.chipsRemainingOnMap === 0 },
  { name: "done", test: () => runner.completed },
];

let mi = 0;
for (let i = 0; i < moves.length; i += 1) {
  stepMsCc1Simulation(runner, moves[i]!);
  while (mi < milestones.length && milestones[mi]!.test()) {
    console.log(milestones[mi]!.name, {
      moveIndex: i + 1,
      ticks: runner.buttonPressCtx.moveBoundary,
      pos: { x: runner.gx, y: runner.gy },
    });
    mi += 1;
  }
}
