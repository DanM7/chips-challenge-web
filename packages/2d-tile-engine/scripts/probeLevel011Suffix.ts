#!/usr/bin/env node
/** Quick greedy finish from level 11 TWS prefix state. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { Direction, LevelData } from "../engine/types.js";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import { COLLECTIBLE_CHIP_TILE_ID } from "../tile-engine/tiles.js";
import {
  cloneMsCc1SimulationRunner,
  createMsCc1SimulationRunner,
  msCc1RunnerStateKey,
  stepMsCc1Simulation,
  stepMsCc1Wait,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { encodeSolutionMoves } from "../engine/solutionMoves.js";
import { replayTwsRecords } from "../engine/twsReplay.js";
import { readLevelSolution } from "../integration/solutionStorage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const levelsDir = path.join(
  root,
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels",
);

const TWS_DIR: Direction[] = ["up", "left", "down", "right"];
const dirs: Direction[] = ["up", "down", "left", "right"];

function loadLevel(): LevelData {
  const level = JSON.parse(
    fs.readFileSync(path.join(levelsDir, "level-011.json"), "utf8"),
  ) as LevelData;
  normalizeLevelLayers(level);
  return level;
}

function replayTwsPrefix(
  level: LevelData,
  records: { tick: number; direction: number }[],
) {
  const runner = createMsCc1SimulationRunner(structuredClone(level));
  let prevTick = 0;
  for (const rec of records) {
    const dir = TWS_DIR[rec.direction];
    if (!dir) continue;
    const gap = Math.max(0, rec.tick - prevTick - 1);
    for (let i = 0; i < gap; i += 1) {
      if (stepMsCc1Wait(runner)) return runner;
    }
    if (stepMsCc1Wait(runner)) return runner;
    if (stepMsCc1Simulation(runner, dir)) return runner;
    prevTick = rec.tick;
  }
  return runner;
}

function score(runner: ReturnType<typeof createMsCc1SimulationRunner>): number {
  const chips = runner.playerState.chipsRemainingOnMap;
  if (chips === 0) return 1000 - runner.chipMoves;
  let nearest = 999;
  for (let y = 0; y < runner.level.height; y++) {
    for (let x = 0; x < runner.level.width; x++) {
      if (getCompositeTile(runner.level, x, y) === COLLECTIBLE_CHIP_TILE_ID) {
        const d = Math.abs(x - runner.gx) + Math.abs(y - runner.gy);
        if (d < nearest) nearest = d;
      }
    }
  }
  return (100 - chips) * 50 - nearest * 2 - runner.chipMoves;
}

function greedyFrom(start: ReturnType<typeof createMsCc1SimulationRunner>, maxDepth: number) {
  type Frame = { seq: Direction[]; runner: ReturnType<typeof createMsCc1SimulationRunner> };
  const queue: Frame[] = [{ seq: [], runner: start }];
  const seen = new Set<string>([msCc1RunnerStateKey(start)]);
  let best: Direction[] | null = null;
  let bestScore = -Infinity;
  while (queue.length) {
    queue.sort((a, b) => score(b.runner) - score(a.runner));
    const frame = queue.shift()!;
    const s = score(frame.runner);
    if (frame.runner.completed) {
      best = frame.seq;
      break;
    }
    if (s > bestScore) {
      bestScore = s;
      best = frame.seq;
    }
    if (frame.runner.playerDied || frame.seq.length >= maxDepth) continue;
    for (const d of dirs) {
      const next = cloneMsCc1SimulationRunner(frame.runner);
      if (frame.seq.length > 0) stepMsCc1Wait(next);
      stepMsCc1Simulation(next, d);
      if (next.playerDied) continue;
      const key = msCc1RunnerStateKey(next);
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push({ seq: [...frame.seq, d], runner: next });
    }
  }
  return best;
}

const entry = readLevelSolution<{ twsRecords: { tick: number; direction: number }[]; timeLimitSeconds: number; boldTimeRemaining: number }>(11)!;
const level = loadLevel();
const tws = replayTwsRecords(structuredClone(level), entry.twsRecords);
const prefix = createMsCc1SimulationRunner(structuredClone(level));
for (const m of tws.chipMoves) {
  if (stepMsCc1Simulation(prefix, m)) break;
}
console.log("prefix", prefix.gx, prefix.gy, "chips", prefix.playerState.chipsRemainingOnMap);
const suffix = greedyFrom(prefix, 60);
if (!suffix) {
  console.log("no suffix");
  process.exit(1);
}
const all = [...tws.chipMoves, ...suffix];
const runner = createMsCc1SimulationRunner(structuredClone(level));
for (const m of all) {
  if (stepMsCc1Simulation(runner, m)) break;
}
console.log({
  suffixLen: suffix.length,
  total: all.length,
  completed: runner.completed,
  chips: runner.playerState.chipsRemainingOnMap,
  rem: msSecondsRemaining(entry.timeLimitSeconds, runner.buttonPressCtx.moveBoundary),
  bold: entry.boldTimeRemaining,
});
