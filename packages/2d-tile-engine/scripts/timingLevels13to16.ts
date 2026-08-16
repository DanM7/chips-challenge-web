import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { decodeSolutionMoves } from "../engine/solutionMoves.js";
import type { LevelData } from "../engine/types.js";
import { readLevelSolution } from "../integration/solutionStorage.js";
import { replayTwsRecords } from "../engine/twsReplay.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const levelsDir = path.join(
  root,
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels",
);

function loadLevel(n: number): LevelData {
  const level = JSON.parse(
    readFileSync(path.join(levelsDir, `level-${String(n).padStart(3, "0")}.json`), "utf8"),
  ) as LevelData;
  normalizeLevelLayers(level);
  return level;
}

/** Replay TWS and return runner moveBoundary (not exposed on TwsReplayResult). */
function replayTwsBoundary(level: LevelData, records: { tick: number; direction: number }[]) {
  const TWS_DIR = ["up", "left", "down", "right"] as const;
  const runner = createMsCc1SimulationRunner(structuredClone(level));
  let prevTick = 0;
  for (const rec of records) {
    const dir = TWS_DIR[rec.direction];
    if (!dir) continue;
    const gap = Math.max(0, rec.tick - prevTick - 1);
    for (let i = 0; i < gap; i += 1) {
      stepMsCc1Wait(runner);
      if (runner.completed || runner.playerDied) break;
    }
    stepMsCc1Wait(runner);
    if (runner.completed || runner.playerDied) break;
    stepMsCc1Simulation(runner, dir);
    prevTick = rec.tick;
    if (runner.completed || runner.playerDied) break;
  }
  return runner;
}

for (const n of [13, 14, 15, 16]) {
  const sol = readLevelSolution<{
    timeLimitSeconds: number | null;
    boldTimeRemaining: number;
    moves: string[] | null;
    twsRecords?: { tick: number; direction: number }[];
  }>(n)!;
  const limit = sol.timeLimitSeconds && sol.timeLimitSeconds > 0 ? sol.timeLimitSeconds : 999;
  const level = loadLevel(n);

  console.log(`\n=== Level ${n} (limit ${limit}, bold ${sol.boldTimeRemaining}) ===`);

  if (sol.moves?.length) {
    const runner = createMsCc1SimulationRunner(structuredClone(level));
    for (const d of decodeSolutionMoves(sol.moves)) {
      if (stepMsCc1Simulation(runner, d)) break;
    }
    const rem = msSecondsRemaining(limit, runner.buttonPressCtx.moveBoundary);
    console.log("bare moves:", {
      completed: runner.completed,
      ticks: runner.buttonPressCtx.moveBoundary,
      rem,
      meets: rem >= sol.boldTimeRemaining,
    });
  }

  if (sol.twsRecords?.length) {
    const tws = replayTwsRecords(structuredClone(level), sol.twsRecords);
    const runner = replayTwsBoundary(level, sol.twsRecords);
    const rem = msSecondsRemaining(limit, runner.buttonPressCtx.moveBoundary);
    console.log("TWS:", {
      completed: tws.completed,
      chipMoves: tws.chipMoves.length,
      waitTicks: tws.waitTicks,
      boundary: runner.buttonPressCtx.moveBoundary,
      rem,
      meets: rem >= sol.boldTimeRemaining,
    });
  }
}
