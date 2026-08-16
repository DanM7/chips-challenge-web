import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { decodeSolutionMoves, encodeSolutionMoves } from "../engine/solutionMoves.js";
import type { Direction, LevelData } from "../engine/types.js";
import { readLevelSolution } from "../integration/solutionStorage.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const levelNumber = Number.parseInt(process.argv[2] ?? "15", 10);
const boldTarget = Number.parseInt(process.argv[3] ?? "89", 10);
const timeLimit = Number.parseInt(process.argv[4] ?? "250", 10);

const level = JSON.parse(
  readFileSync(
    path.join(
      root,
      `../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-${String(levelNumber).padStart(3, "0")}.json`,
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

const sol = readLevelSolution<{ moves: string[] }>(levelNumber)!;
let moves = decodeSolutionMoves(sol.moves);

function evalMoves(candidate: Direction[]) {
  const runner = createMsCc1SimulationRunner(structuredClone(level));
  for (const d of candidate) {
    if (stepMsCc1Simulation(runner, d)) break;
  }
  const ticks = runner.buttonPressCtx.moveBoundary;
  const rem = msSecondsRemaining(timeLimit, ticks);
  return {
    completed: runner.completed,
    died: runner.playerDied,
    ticks,
    rem,
    meets: runner.completed && rem >= boldTarget,
  };
}

let best = evalMoves(moves);
console.log("start", best, "len", moves.length);

let improved = true;
while (improved) {
  improved = false;
  for (let i = 0; i < moves.length; i += 1) {
    const candidate = moves.filter((_, idx) => idx !== i);
    const r = evalMoves(candidate);
    if (
      r.completed &&
      (r.ticks < best.ticks || (r.ticks === best.ticks && candidate.length < moves.length))
    ) {
      moves = candidate;
      best = r;
      improved = true;
      console.log("removed", i, best);
      break;
    }
  }
}

// try adjacent pair removals
for (let i = 0; i < moves.length - 1; i += 1) {
  const candidate = [...moves.slice(0, i), ...moves.slice(i + 2)];
  const r = evalMoves(candidate);
  if (r.completed && r.ticks < best.ticks) {
    moves = candidate;
    best = r;
    console.log("removed pair", i, best);
    i = Math.max(-1, i - 2);
  }
}

console.log("final", best, "len", moves.length);
if (best.meets) {
  writeFileSync(
    path.join(root, `.tmp/level${String(levelNumber).padStart(3, "0")}-optimized.json`),
    JSON.stringify(encodeSolutionMoves(moves), null, 2),
  );
}
