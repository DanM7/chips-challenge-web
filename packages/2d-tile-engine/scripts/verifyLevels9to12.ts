#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import {
  decodeSolutionMoves,
  encodeSolutionMoves,
} from "../engine/solutionMoves.js";
import { replayTwsRecords } from "../engine/twsReplay.js";
import { readLevelSolution } from "../integration/solutionStorage.js";
import type { Direction, LevelData } from "../engine/types.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const levelsDir = path.join(
  root,
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels",
);

const TWS_DIR: Direction[] = ["up", "left", "down", "right"];

function loadLevel(n: number): LevelData {
  const level = JSON.parse(
    fs.readFileSync(path.join(levelsDir, `level-${String(n).padStart(3, "0")}.json`), "utf8"),
  ) as LevelData;
  normalizeLevelLayers(level);
  return level;
}

function expandWalkthrough(notation: string): string[] {
  const moves: string[] = [];
  for (const tok of notation.split(/\s+/)) {
    const m = tok.match(/^(\d+)?([UDLR])$/);
    if (!m) {
      throw new Error(`bad token: ${tok}`);
    }
    const n = m[1] ? Number.parseInt(m[1], 10) : 1;
    for (let i = 0; i < n; i += 1) {
      moves.push(m[2]!);
    }
  }
  return moves;
}

function simAutoplay(level: LevelData, moves: string[], limit: number) {
  const runner = createMsCc1SimulationRunner(structuredClone(level));
  for (const d of decodeSolutionMoves(moves)) {
    if (stepMsCc1Simulation(runner, d)) {
      break;
    }
  }
  return {
    completed: runner.completed,
    died: runner.playerDied,
    death: runner.deathMessage,
    ticks: runner.buttonPressCtx.moveBoundary,
    rem: msSecondsRemaining(limit, runner.buttonPressCtx.moveBoundary),
    pos: `${runner.gx},${runner.gy}`,
    chipMoves: runner.chipMoves,
  };
}

function simTws(
  level: LevelData,
  records: { tick: number; direction: number }[],
  limit: number,
) {
  const replay = replayTwsRecords(structuredClone(level), records);
  const runner = createMsCc1SimulationRunner(structuredClone(level));
  let prevTick = 0;
  for (const rec of records) {
    const dir = TWS_DIR[rec.direction];
    if (!dir) {
      continue;
    }
    const gap = Math.max(0, rec.tick - prevTick - 1);
    for (let i = 0; i < gap; i += 1) {
      if (stepMsCc1Wait(runner)) {
        break;
      }
    }
    if (stepMsCc1Wait(runner)) {
      break;
    }
    if (stepMsCc1Simulation(runner, dir)) {
      break;
    }
    prevTick = rec.tick;
  }
  return {
    completed: runner.completed,
    died: runner.playerDied,
    death: runner.deathMessage,
    ticks: runner.buttonPressCtx.moveBoundary,
    rem: msSecondsRemaining(limit, runner.buttonPressCtx.moveBoundary),
    chipMoves: runner.chipMoves,
    replayChipMoves: replay.chipMoves.length,
    encoded: encodeSolutionMoves(replay.chipMoves),
  };
}

const brushfireSw =
  "4D 4R 4U 12R 3D 3L U 7L 7D L 3D 8R U 10R 10D 4R 2U L 3U R 2U L 6U 3R 18D 5L 2U 10L 7U 5R";
const moves10 = expandWalkthrough(brushfireSw);
console.log("Level 10 StrategyWiki:", simAutoplay(loadLevel(10), moves10, 80));

const sol10 = readLevelSolution<{ moves: string[] }>(10);
if (sol10?.moves) {
  console.log("Level 10 current:", simAutoplay(loadLevel(10), sol10.moves, 80));
}

for (const n of [9, 11, 12]) {
  const sol = readLevelSolution<{
    timeLimitSeconds: number;
    boldTimeRemaining: number;
    twsRecords: { tick: number; direction: number }[];
  }>(n)!;
  const level = loadLevel(n);
  const r = simTws(level, sol.twsRecords, sol.timeLimitSeconds);
  console.log(`Level ${n} TWS:`, {
    ...r,
    bold: sol.boldTimeRemaining,
    meets: r.rem >= sol.boldTimeRemaining,
  });
}
