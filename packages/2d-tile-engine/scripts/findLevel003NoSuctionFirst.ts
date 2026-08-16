import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { Direction, LevelData } from "../engine/types.js";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
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

type Goal = { label: string; done: (r: ReturnType<typeof createMsCc1SimulationRunner>) => boolean };
const goals: Goal[] = [
  { label: "flippers", done: (r) => r.playerState.tools.includes("flippers") },
  {
    label: "skates+chip1",
    done: (r) => r.playerState.tools.includes("ice_skates") && r.playerState.chipsRemainingOnMap <= 3,
  },
  {
    label: "fire+chip2",
    done: (r) => r.playerState.tools.includes("fire_boots") && r.playerState.chipsRemainingOnMap <= 2,
  },
];

type Frame = { moves: Direction[]; runner: ReturnType<typeof createMsCc1SimulationRunner> };

function segmentBfs(start: ReturnType<typeof createMsCc1SimulationRunner>, goal: Goal, maxDepth: number): Direction[] | null {
  const queue: Frame[] = [{ moves: [], runner: start }];
  const seen = new Set<string>([msCc1RunnerStateKey(start)]);
  while (queue.length > 0) {
    const frame = queue.shift()!;
    if (goal.done(frame.runner)) return frame.moves;
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
  const suffix = segmentBfs(runner, goal, 60);
  if (!suffix) {
    console.error("fail", goal.label);
    process.exit(1);
  }
  for (const m of suffix) {
    stepMsCc1Simulation(runner, m);
    full.push(m);
  }
  console.log("done", goal.label, full.length, runner.gx, runner.gy, runner.playerState);
}

// From fire+chip2 WITHOUT suction: try finish (2 chips left: 19,15 and 15,19)
const queue: Frame[] = [{ moves: [], runner }];
const seen = new Set<string>([msCc1RunnerStateKey(runner)]);
let expanded = 0;

while (queue.length > 0 && expanded < 3_000_000) {
  const frame = queue.shift()!;
  expanded++;
  if (frame.runner.completed) {
    const all = [...full, ...frame.moves];
    fs.writeFileSync(path.join(__dirname, "level003-solution.json"), `${JSON.stringify(all)}\n`);
    console.log("SOLVED", all.length, simulateMsCc1Level(structuredClone(level), all).completed);
    process.exit(0);
  }
  if (frame.moves.length >= 120 || frame.runner.playerDied) continue;
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
console.log("NO FINISH without suction first", expanded, runner.playerState.chipsRemainingOnMap);
process.exit(1);
