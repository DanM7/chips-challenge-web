import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  cloneMsCc1SimulationRunner,
  createMsCc1SimulationRunner,
  msCc1RunnerStateKey,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { decodeSolutionMoves, encodeSolutionMoves } from "../engine/solutionMoves.js";
import type { Direction, LevelData } from "../engine/types.js";
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

const twsMoves = decodeSolutionMoves(readLevelSolution<{ moves: string[] }>(15)!.moves);

// BFS prefix from completeLevel015Bold (flippers in 14 moves)
const bfsPrefix: Direction[] = [
  "up",
  "right",
  "right",
  "right",
  "right",
  "down",
  "up",
  "up",
  "up",
  "right",
  "right",
  "right",
  "right",
  "right",
];

function run(moves: Direction[]) {
  const runner = createMsCc1SimulationRunner(structuredClone(level));
  for (const d of moves) stepMsCc1Simulation(runner, d);
  return runner;
}

// find TWS index at flippers
let twsRunner = run([]);
let flippersIdx = -1;
for (let i = 0; i < twsMoves.length; i += 1) {
  const r = run(twsMoves.slice(0, i + 1));
  if (r.playerState.tools.includes("flippers")) {
    flippersIdx = i + 1;
    twsRunner = r;
    break;
  }
}
console.log("TWS flippers at move", flippersIdx, {
  pos: { x: twsRunner.gx, y: twsRunner.gy },
  key: msCc1RunnerStateKey(twsRunner),
});

const bfsRunner = run(bfsPrefix);
console.log("BFS prefix", {
  pos: { x: bfsRunner.gx, y: bfsRunner.gy },
  key: msCc1RunnerStateKey(bfsRunner),
  same: msCc1RunnerStateKey(bfsRunner) === msCc1RunnerStateKey(twsRunner),
});

if (msCc1RunnerStateKey(bfsRunner) === msCc1RunnerStateKey(twsRunner)) {
  const hybrid = [...bfsPrefix, ...twsMoves.slice(flippersIdx)];
  const h = run(hybrid);
  console.log("HYBRID", {
    completed: h.completed,
    ticks: h.buttonPressCtx.moveBoundary,
    rem: msSecondsRemaining(250, h.buttonPressCtx.moveBoundary),
    moves: hybrid.length,
    meets: msSecondsRemaining(250, h.buttonPressCtx.moveBoundary) >= 89,
  });
  if (h.completed) {
    console.log(JSON.stringify(encodeSolutionMoves(hybrid)));
  }
}
