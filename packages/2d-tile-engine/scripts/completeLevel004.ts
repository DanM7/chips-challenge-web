/**
 * Level 4: rebuild prefix + hub + waypoint-chained west + exit.
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

type Runner = ReturnType<typeof createMsCc1SimulationRunner>;

function apply(moves: Direction[]): Runner {
  const r = createMsCc1SimulationRunner(structuredClone(level));
  for (const m of moves) stepMsCc1Simulation(r, m);
  return r;
}

function segmentBfs(
  start: Runner,
  maxDepth: number,
  maxNodes: number,
  done: (r: Runner) => boolean,
): Direction[] | null {
  const q: { moves: Direction[]; runner: Runner }[] = [{ moves: [], runner: start }];
  const seen = new Set<string>([msCc1RunnerStateKey(start)]);
  let n = 0;
  while (q.length && n < maxNodes) {
    const f = q.shift()!;
    n++;
    if (done(f.runner)) return f.moves;
    if (f.moves.length >= maxDepth || f.runner.playerDied) continue;
    for (const d of dirs) {
      const next = cloneMsCc1SimulationRunner(f.runner);
      stepMsCc1Simulation(next, d);
      if (next.playerDied) continue;
      const k = msCc1RunnerStateKey(next);
      if (seen.has(k)) continue;
      seen.add(k);
      q.push({ moves: [...f.moves, d], runner: next });
    }
  }
  return null;
}

function buildEastSouth(): Direction[] {
  const goals = [
    { d: 25, n: 200_000, done: (r: Runner) => getCompositeTile(r.level, 24, 7) !== "chip" },
    { d: 35, n: 200_000, done: (r: Runner) => getCompositeTile(r.level, 24, 10) !== "chip" },
    { d: 35, n: 200_000, done: (r: Runner) => getCompositeTile(r.level, 24, 12) !== "chip" },
    { d: 40, n: 200_000, done: (r: Runner) => getCompositeTile(r.level, 24, 15) !== "chip" },
    { d: 60, n: 400_000, done: (r: Runner) => r.playerState.chipsRemainingOnMap <= 1 },
  ];
  let r = createMsCc1SimulationRunner(structuredClone(level));
  const full: Direction[] = [];
  for (const g of goals) {
    const s = segmentBfs(r, g.d, g.n, g.done);
    if (!s) throw new Error("east/south fail");
    for (const m of s) {
      stepMsCc1Simulation(r, m);
      full.push(m);
    }
  }
  return full;
}

const partialPath = path.join(__dirname, "level004-partial.json");
const prefix = fs.existsSync(partialPath)
  ? (JSON.parse(fs.readFileSync(partialPath, "utf8")) as Direction[])
  : buildEastSouth();

const hubMoves =
  segmentBfs(apply(prefix), 25, 150_000, (r) => r.gx === 14 && r.gy === 9) ??
  ["right", "up", "right", "right", "right", "right", "up", "up", "up", "up", "left"];

let full = [...prefix, ...hubMoves];
let runner = apply(full);
console.log("hub", runner.gx, runner.gy, "chips", runner.playerState.chipsRemainingOnMap);

type Step = { label: string; depth: number; nodes: number; done: (r: Runner) => boolean };
const westSteps: Step[] = [
  { label: "btn5,10", depth: 15, nodes: 50_000, done: (r) => r.gx === 5 && r.gy === 10 },
  { label: "btn11,8", depth: 25, nodes: 80_000, done: (r) => r.gx === 11 && r.gy === 8 },
  { label: "btn5,6", depth: 20, nodes: 80_000, done: (r) => r.gx === 5 && r.gy === 6 },
  {
    label: "chip",
    depth: 30,
    nodes: 150_000,
    done: (r) => getCompositeTile(r.level, 11, 5) !== "chip" && r.playerState.chipsRemainingOnMap === 0,
  },
  { label: "hub2", depth: 35, nodes: 150_000, done: (r) => r.gx === 14 && r.gy === 9 && r.playerState.chipsRemainingOnMap === 0 },
];

for (const step of westSteps) {
  const s = segmentBfs(runner, step.depth, step.nodes, step.done);
  if (!s) {
    console.error("FAIL", step.label, runner.gx, runner.gy);
    process.exit(1);
  }
  console.log(step.label, s.length);
  for (const m of s) {
    stepMsCc1Simulation(runner, m);
    full.push(m);
  }
}

const exit = segmentBfs(runner, 40, 200_000, (r) => r.completed);
if (!exit) process.exit(1);
full = [...full, ...exit];

const verify = simulateMsCc1Level(structuredClone(level), full);
fs.writeFileSync(path.join(__dirname, "level004-solution.json"), `${JSON.stringify(full)}\n`);
fs.writeFileSync(partialPath, `${JSON.stringify(prefix)}\n`);
console.log("SOLVED", full.length, verify.completed);
process.exit(verify.completed ? 0 : 1);
