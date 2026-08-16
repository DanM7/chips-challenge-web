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
import type { LevelData } from "../engine/types.js";
import { readLevelSolution } from "../integration/solutionStorage.js";
import { cellTile, getCompositeTile } from "../engine/levelRuntime.js";

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
  { name: "suction", test: () => runner.playerState.tools.includes("suction_boots") },
  { name: "fire_boots", test: () => runner.playerState.tools.includes("fire_boots") },
  { name: "ice_skates", test: () => runner.playerState.tools.includes("ice_skates") },
  { name: "chips10", test: () => runner.playerState.chipsRemainingOnMap <= 10 },
  { name: "chips9", test: () => runner.playerState.chipsRemainingOnMap <= 9 },
  { name: "chips6", test: () => runner.playerState.chipsRemainingOnMap <= 6 },
  { name: "chips3", test: () => runner.playerState.chipsRemainingOnMap <= 3 },
  { name: "chips0", test: () => runner.playerState.chipsRemainingOnMap === 0 },
  {
    name: "no_skates",
    test: () =>
      runner.playerState.chipsRemainingOnMap === 0 &&
      !runner.playerState.tools.includes("ice_skates"),
  },
  { name: "block_on_brown", test: () => getCompositeTile(runner.level, 16, 9) === "block_movable" },
  { name: "done", test: () => runner.completed },
];

let mi = 0;
for (let i = 0; i < moves.length; i++) {
  stepMsCc1Simulation(runner, moves[i]!);
  while (mi < milestones.length && milestones[mi]!.test()) {
    console.log(milestones[mi]!.name, {
      moveIndex: i + 1,
      ticks: runner.buttonPressCtx.moveBoundary,
      rem: msSecondsRemaining(250, runner.buttonPressCtx.moveBoundary),
      pos: { x: runner.gx, y: runner.gy },
      tools: [...runner.playerState.tools],
      keys: [...runner.playerState.keys],
      chips: runner.playerState.chipsRemainingOnMap,
    });
    mi += 1;
  }
}
console.log("end", {
  completed: runner.completed,
  died: runner.playerDied,
  ticks: runner.buttonPressCtx.moveBoundary,
  rem: msSecondsRemaining(250, runner.buttonPressCtx.moveBoundary),
  remainingMilestones: milestones.slice(mi).map((m) => m.name),
});
