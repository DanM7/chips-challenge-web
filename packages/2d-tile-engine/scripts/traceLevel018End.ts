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
import { decodeSolutionMoves } from "../engine/solutionMoves.js";
import { replayTwsRecords } from "../engine/twsReplay.js";
import { readLevelSolution } from "../integration/solutionStorage.js";
import type { Direction, LevelData } from "../engine/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const n = Number.parseInt(process.argv[2] ?? "18", 10);
const level = JSON.parse(
  readFileSync(
    path.join(
      root,
      `../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-${String(n).padStart(3, "0")}.json`,
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);
const sol = readLevelSolution<{ twsRecords: { tick: number; direction: number }[]; timeLimitSeconds: number }>(n)!;
const replay = replayTwsRecords(structuredClone(level), sol.twsRecords);
const moves = replay.chipMoves;
const runner = createMsCc1SimulationRunner(structuredClone(level));
console.log(`start ${runner.gx},${runner.gy} tile=${getCompositeTile(level, runner.gx, runner.gy)}`);
for (let i = 0; i < moves.length; i += 1) {
  const d = moves[i]!;
  stepMsCc1Simulation(runner, d);
  const tail = i >= moves.length - 15;
  if (tail || (i + 1) % 40 === 0 || runner.playerDied || runner.completed) {
    console.log(
      `${i + 1} ${d[0]!.toUpperCase()} @ ${runner.gx},${runner.gy} t=${getCompositeTile(runner.level, runner.gx, runner.gy)} ticks=${runner.buttonPressCtx.moveBoundary}`,
    );
  }
  if (runner.playerDied || runner.completed) break;
}
console.log({
  completed: runner.completed,
  died: runner.playerDied,
  rem: msSecondsRemaining(sol.timeLimitSeconds, runner.buttonPressCtx.moveBoundary),
});

// try suffix from stuck position
if (!runner.completed && n === 18) {
  for (const suffix of ["R", "RR", "RD", "RU", "U", "UU", "UR", "UL", "L", "D"]) {
    const r2 = createMsCc1SimulationRunner(structuredClone(level));
    for (const d of moves) stepMsCc1Simulation(r2, d);
    for (const ch of suffix) {
      const map: Record<string, Direction> = { R: "right", L: "left", U: "up", D: "down" };
      stepMsCc1Simulation(r2, map[ch]!);
    }
    if (r2.completed) {
      console.log(`SUFFIX ${suffix} COMPLETES rem=${msSecondsRemaining(600, r2.buttonPressCtx.moveBoundary)}`);
    }
  }
}
