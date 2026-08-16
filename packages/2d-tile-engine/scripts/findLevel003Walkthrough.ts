/**
 * Lesson 3 walkthrough-order segmented BFS: tool+chip pairs then exit.
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
      "../../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-003.json",
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

type Goal = {
  label: string;
  done: (r: ReturnType<typeof createMsCc1SimulationRunner>) => boolean;
};

const goals: Goal[] = [
  {
    label: "flippers",
    done: (r) => r.playerState.tools.includes("flippers"),
  },
  {
    label: "skates+chip1",
    done: (r) =>
      r.playerState.tools.includes("ice_skates") &&
      r.playerState.chipsRemainingOnMap <= 3,
  },
  {
    label: "fire+chip2",
    done: (r) =>
      r.playerState.tools.includes("fire_boots") &&
      r.playerState.chipsRemainingOnMap <= 2,
  },
  {
    label: "suction+chip3",
    done: (r) =>
      r.playerState.tools.includes("suction_boots") &&
      r.playerState.chipsRemainingOnMap <= 1,
  },
  {
    label: "last chip",
    done: (r) => r.playerState.chipsRemainingOnMap === 0,
  },
  {
    label: "exit",
    done: (r) => r.completed,
  },
];

type Frame = { moves: Direction[]; runner: ReturnType<typeof createMsCc1SimulationRunner> };

function segmentBfs(
  start: ReturnType<typeof createMsCc1SimulationRunner>,
  goal: Goal,
  maxDepth: number,
): Direction[] | null {
  const queue: Frame[] = [{ moves: [], runner: start }];
  const seen = new Set<string>([msCc1RunnerStateKey(start)]);
  while (queue.length > 0) {
    const frame = queue.shift()!;
    if (goal.done(frame.runner)) {
      return frame.moves;
    }
    if (frame.moves.length >= maxDepth || frame.runner.playerDied) continue;
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
  return null;
}

let runner = createMsCc1SimulationRunner(structuredClone(level));
const full: Direction[] = [];

for (const goal of goals) {
  const suffix = segmentBfs(
    runner,
    goal,
    goal.label === "exit" ? 120 : goal.label === "last chip" ? 120 : 60,
  );
  if (!suffix) {
    console.error("FAILED at", goal.label, "after", full.length, "moves");
    console.error("state", runner.gx, runner.gy, runner.playerState);
    fs.writeFileSync(path.join(__dirname, "level003-partial.json"), `${JSON.stringify(full)}\n`);
    process.exit(1);
  }
  for (const m of suffix) {
    stepMsCc1Simulation(runner, m);
    full.push(m);
  }
  console.log("done", goal.label, "total", full.length, "at", runner.gx, runner.gy, runner.playerState);
}

const verify = simulateMsCc1Level(structuredClone(level), full);
const out = path.join(__dirname, "level003-solution.json");
fs.writeFileSync(out, `${JSON.stringify(full)}\n`);
console.log("SOLVED", full.length, "verified", verify.completed);
process.exit(verify.completed ? 0 : 1);
