/**
 * Compress TWS-derived moves: drop inputs that don't change state/position meaningfully,
 * keep completion with best rem.
 */
import { readFileSync, writeFileSync } from "node:fs";
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

const sol = readLevelSolution<{ moves: string[] }>(15)!;
let moves = decodeSolutionMoves(sol.moves) as Direction[];

function evalMoves(candidate: Direction[]) {
  const runner = createMsCc1SimulationRunner(structuredClone(level));
  let lastKey = "";
  let wasted = 0;
  for (const d of candidate) {
    const before = msCc1RunnerStateKey(runner);
    const beforeMb = runner.buttonPressCtx.moveBoundary;
    stepMsCc1Simulation(runner, d);
    const after = msCc1RunnerStateKey(runner);
    if (after === before && runner.buttonPressCtx.moveBoundary === beforeMb) wasted++;
    lastKey = after;
    if (runner.completed || runner.playerDied) break;
  }
  return {
    completed: runner.completed,
    died: runner.playerDied,
    ticks: runner.buttonPressCtx.moveBoundary,
    rem: msSecondsRemaining(250, runner.buttonPressCtx.moveBoundary),
    wasted,
  };
}

// Greedy: remove any move whose removal still completes with <= ticks
let best = evalMoves(moves);
console.log("start", best, "len", moves.length);

let pass = 0;
while (pass < 5) {
  pass++;
  let improved = false;
  for (let i = 0; i < moves.length; i++) {
    const candidate = moves.slice(0, i).concat(moves.slice(i + 1));
    const r = evalMoves(candidate);
    if (r.completed && !r.died && r.ticks <= best.ticks) {
      // prefer lower ticks, then shorter
      if (r.ticks < best.ticks || candidate.length < moves.length) {
        moves = candidate;
        best = r;
        improved = true;
        if (i % 50 === 0) console.log("removed", i, best, "len", moves.length);
        break;
      }
    }
  }
  if (!improved) break;
  console.log("pass", pass, best, "len", moves.length);
}

// try removing pairs of opposing moves (LR, RL, UD, DU) 
const opp: Record<string, string> = { left: "right", right: "left", up: "down", down: "up" };
for (let i = 0; i < moves.length - 1; i++) {
  if (opp[moves[i]!] === moves[i + 1]) {
    const candidate = moves.slice(0, i).concat(moves.slice(i + 2));
    const r = evalMoves(candidate);
    if (r.completed && !r.died && r.ticks < best.ticks) {
      moves = candidate;
      best = r;
      console.log("removed opp pair", i, best);
      i = Math.max(-1, i - 2);
    }
  }
}

console.log("final", best, "len", moves.length);
writeFileSync(
  path.join(root, ".tmp/level015-compressed.json"),
  JSON.stringify({ ...best, letters: encodeSolutionMoves(moves) }, null, 2),
);
