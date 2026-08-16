/**
 * Chain short BFS segments for level 4 (east chips one-by-one, then rooms, exit).
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

function chipGone(runner: ReturnType<typeof createMsCc1SimulationRunner>, x: number, y: number): boolean {
  return getCompositeTile(runner.level, x, y) !== "chip";
}

type Goal = { label: string; maxDepth: number; done: (r: ReturnType<typeof createMsCc1SimulationRunner>) => boolean };

type Frame = { moves: Direction[]; runner: ReturnType<typeof createMsCc1SimulationRunner> };

function segmentBfs(start: ReturnType<typeof createMsCc1SimulationRunner>, goal: Goal): Direction[] | null {
  const queue: Frame[] = [{ moves: [], runner: start }];
  const seen = new Set<string>([msCc1RunnerStateKey(start)]);
  let expanded = 0;
  while (queue.length > 0 && expanded < 800_000) {
    const frame = queue.shift()!;
    expanded++;
    if (goal.done(frame.runner)) return frame.moves;
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
  return null;
}

const goals: Goal[] = [
  { label: "chip 24,7", maxDepth: 25, done: (r) => chipGone(r, 24, 7) },
  { label: "chip 24,10", maxDepth: 35, done: (r) => chipGone(r, 24, 10) },
  { label: "chip 24,12", maxDepth: 35, done: (r) => chipGone(r, 24, 12) },
  { label: "chip 24,15", maxDepth: 40, done: (r) => chipGone(r, 24, 15) },
  { label: "south 4 chips", maxDepth: 60, done: (r) => r.playerState.chipsRemainingOnMap <= 1 },
  { label: "west chip 11,5", maxDepth: 80, done: (r) => chipGone(r, 11, 5) && r.playerState.chipsRemainingOnMap === 0 },
  { label: "exit", maxDepth: 50, done: (r) => r.completed },
];

let runner = createMsCc1SimulationRunner(structuredClone(level));
const full: Direction[] = [];

for (const goal of goals) {
  console.log("segment", goal.label);
  const suffix = segmentBfs(runner, goal);
  if (!suffix) {
    console.error("FAILED", goal.label, "after", full.length, runner.gx, runner.gy, runner.playerState);
    fs.writeFileSync(path.join(__dirname, "level004-partial.json"), `${JSON.stringify(full)}\n`);
    process.exit(1);
  }
  for (const m of suffix) {
    stepMsCc1Simulation(runner, m);
    full.push(m);
  }
  console.log("done", goal.label, "total", full.length, runner.gx, runner.gy, "chips", runner.playerState.chipsRemainingOnMap);
}

fs.writeFileSync(path.join(__dirname, "level004-solution.json"), `${JSON.stringify(full)}\n`);
console.log("SOLVED", full.length, simulateMsCc1Level(structuredClone(level), full).completed);
