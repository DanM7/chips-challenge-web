/**
 * Lesson 4 walkthrough-order segmented BFS: east → south → west → exit.
 * Run: npx tsx scripts/findLevel004Walkthrough.ts
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { Direction, LevelData } from "../engine/types.js";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import {
  cloneMsCc1SimulationRunner,
  createMsCc1SimulationRunner,
  msCc1RunnerStateKey,
  simulateMsCc1Level,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dirs: Direction[] = ["up", "down", "left", "right"];

const level = JSON.parse(
  fs.readFileSync(
    path.join(
      __dirname,
      "../../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-004.json",
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

const eastChips = [
  [24, 7],
  [24, 10],
  [24, 12],
  [24, 15],
];
const westChip = [11, 5];

function chipsGoneAt(levelData: LevelData, cells: number[][]): boolean {
  return cells.every(([x, y]) => getCompositeTile(levelData, x, y) !== "chip");
}

type Goal = {
  label: string;
  maxDepth: number;
  done: (r: ReturnType<typeof createMsCc1SimulationRunner>) => boolean;
};

const goals: Goal[] = [
  {
    label: "east 4 chips",
    maxDepth: 80,
    done: (r) => chipsGoneAt(r.level, eastChips) && r.playerState.chipsRemainingOnMap <= 5,
  },
  {
    label: "south 4 chips",
    maxDepth: 80,
    done: (r) => r.playerState.chipsRemainingOnMap <= 1,
  },
  {
    label: "west chip",
    maxDepth: 80,
    done: (r) => chipsGoneAt(r.level, [westChip]) && r.playerState.chipsRemainingOnMap === 0,
  },
  {
    label: "exit",
    maxDepth: 60,
    done: (r) => r.completed,
  },
];

type Frame = { moves: Direction[]; runner: ReturnType<typeof createMsCc1SimulationRunner> };

function segmentBfs(
  start: ReturnType<typeof createMsCc1SimulationRunner>,
  goal: Goal,
): Direction[] | null {
  const queue: Frame[] = [{ moves: [], runner: start }];
  const seen = new Set<string>([msCc1RunnerStateKey(start)]);
  let expanded = 0;
  while (queue.length > 0 && expanded < 2_000_000) {
    const frame = queue.shift()!;
    expanded++;
    if (goal.done(frame.runner)) {
      console.log("  expanded", expanded);
      return frame.moves;
    }
    if (frame.moves.length >= goal.maxDepth || frame.runner.playerDied) continue;
    for (const dir of dirs) {
      const next = cloneMsCc1SimulationRunner(frame.runner);
      const before = msCc1RunnerStateKey(next);
      stepMsCc1Simulation(next, dir);
      if (next.playerDied) continue;
      const after = msCc1RunnerStateKey(next);
      if (after === before || seen.has(after)) continue;
      seen.add(after);
      queue.push({ moves: [...frame.moves, dir], runner: next });
    }
  }
  console.log("  expanded", expanded, "no solution");
  return null;
}

let runner = createMsCc1SimulationRunner(structuredClone(level));
const full: Direction[] = [];

for (const goal of goals) {
  console.log("segment", goal.label);
  const suffix = segmentBfs(runner, goal);
  if (!suffix) {
    console.error("FAILED at", goal.label, "after", full.length);
    console.error("state", runner.gx, runner.gy, runner.playerState);
    fs.writeFileSync(path.join(__dirname, "level004-partial.json"), `${JSON.stringify(full)}\n`);
    process.exit(1);
  }
  for (const m of suffix) {
    stepMsCc1Simulation(runner, m);
    full.push(m);
  }
  console.log("done", goal.label, "total", full.length, "at", runner.gx, runner.gy, runner.playerState);
}

const verify = simulateMsCc1Level(structuredClone(level), full);
const out = path.join(__dirname, "level004-solution.json");
fs.writeFileSync(out, `${JSON.stringify(full)}\n`);
console.log("SOLVED", full.length, "verified", verify.completed);
process.exit(verify.completed ? 0 : 1);
