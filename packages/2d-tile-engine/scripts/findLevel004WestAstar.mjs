import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
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
const level = JSON.parse(
  fs.readFileSync(
    path.join(
      __dirname,
      "../../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-004.json",
    ),
    "utf8",
  ),
);
normalizeLevelLayers(level);

const prefix = JSON.parse(
  fs.readFileSync(path.join(__dirname, "level004-partial.json"), "utf8"),
);
const start = createMsCc1SimulationRunner(structuredClone(level));
for (const m of prefix) stepMsCc1Simulation(start, m);

const target = { x: 11, y: 5 };
const dirs = ["up", "down", "left", "right"];

function priority(r, depth) {
  const dist = Math.abs(r.gx - target.x) + Math.abs(r.gy - target.y);
  return dist * 100 + depth;
}

const heap = [{ moves: [], runner: start, pri: priority(start, 0) }];
const seen = new Set([msCc1RunnerStateKey(start)]);
let expanded = 0;

function push(f) {
  let i = heap.length;
  heap.push(f);
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (heap[p].pri <= heap[i].pri) break;
    [heap[p], heap[i]] = [heap[i], heap[p]];
    i = p;
  }
}
function pop() {
  const top = heap[0];
  const last = heap.pop();
  if (!heap.length) return top;
  heap[0] = last;
  let i = 0;
  for (;;) {
    const l = i * 2 + 1;
    const r = l + 1;
    let s = i;
    if (l < heap.length && heap[l].pri < heap[s].pri) s = l;
    if (r < heap.length && heap[r].pri < heap[s].pri) s = r;
    if (s === i) break;
    [heap[i], heap[s]] = [heap[s], heap[i]];
    i = s;
  }
  return top;
}

while (heap.length && expanded < 500_000) {
  const f = pop();
  expanded++;
  if (getCompositeTile(f.runner.level, 11, 5) !== "chip") {
    const west = f.moves;
    // exit BFS
    const q = [{ moves: [], runner: f.runner }];
    const seen2 = new Set([msCc1RunnerStateKey(f.runner)]);
    let exit = null;
    while (q.length && !exit) {
      const g = q.shift();
      if (g.runner.completed) {
        exit = g.moves;
        break;
      }
      if (g.moves.length >= 40 || g.runner.playerDied) continue;
      for (const d of dirs) {
        const n = cloneMsCc1SimulationRunner(g.runner);
        stepMsCc1Simulation(n, d);
        if (n.playerDied) continue;
        const k = msCc1RunnerStateKey(n);
        if (seen2.has(k)) continue;
        seen2.add(k);
        q.push({ moves: [...g.moves, d], runner: n });
      }
    }
    if (!exit) {
      console.log("got chip but no exit", expanded);
      process.exit(1);
    }
    const full = [...prefix, ...west, ...exit];
    fs.writeFileSync(path.join(__dirname, "level004-solution.json"), `${JSON.stringify(full)}\n`);
    console.log("SOLVED", full.length, "west", west.length, "exit", exit.length, simulateMsCc1Level(structuredClone(level), full).completed);
    process.exit(0);
  }
  if (f.moves.length >= 80 || f.runner.playerDied) continue;
  for (const d of dirs) {
    const n = cloneMsCc1SimulationRunner(f.runner);
    stepMsCc1Simulation(n, d);
    if (n.playerDied) continue;
    const k = msCc1RunnerStateKey(n);
    if (seen.has(k)) continue;
    seen.add(k);
    push({ moves: [...f.moves, d], runner: n, pri: priority(n, f.moves.length + 1) });
  }
}
console.log("fail", expanded);
