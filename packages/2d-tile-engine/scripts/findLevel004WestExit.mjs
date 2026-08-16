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

// Rebuild prefix through south (87 moves) from chained output
import { execSync } from "child_process";
// use saved partial if exists, else run segments quickly
let prefix = null;
const partialPath = path.join(__dirname, "level004-partial.json");
if (fs.existsSync(partialPath)) {
  prefix = JSON.parse(fs.readFileSync(partialPath, "utf8"));
} else {
  // hardcode from chained run - regenerate by running east+south segments only
  const dirs = ["up", "down", "left", "right"];
  const goals = [
    { max: 25, done: (r) => getCompositeTile(r.level, 24, 7) !== "chip" },
    { max: 35, done: (r) => getCompositeTile(r.level, 24, 10) !== "chip" },
    { max: 35, done: (r) => getCompositeTile(r.level, 24, 12) !== "chip" },
    { max: 40, done: (r) => getCompositeTile(r.level, 24, 15) !== "chip" },
    { max: 60, done: (r) => r.playerState.chipsRemainingOnMap <= 1 },
  ];
  function seg(start, goal) {
    const q = [{ moves: [], runner: start }];
    const seen = new Set([msCc1RunnerStateKey(start)]);
    while (q.length) {
      const f = q.shift();
      if (goal.done(f.runner)) return f.moves;
      if (f.moves.length >= goal.max || f.runner.playerDied) continue;
      for (const d of dirs) {
        const n = cloneMsCc1SimulationRunner(f.runner);
        stepMsCc1Simulation(n, d);
        if (n.playerDied) continue;
        const k = msCc1RunnerStateKey(n);
        if (seen.has(k)) continue;
        seen.add(k);
        q.push({ moves: [...f.moves, d], runner: n });
      }
    }
    return null;
  }
  let runner = createMsCc1SimulationRunner(structuredClone(level));
  prefix = [];
  for (const g of goals) {
    const s = seg(runner, g);
    if (!s) {
      console.error("rebuild fail");
      process.exit(1);
    }
    for (const m of s) {
      stepMsCc1Simulation(runner, m);
      prefix.push(m);
    }
  }
  fs.writeFileSync(partialPath, JSON.stringify(prefix));
  console.log("rebuilt prefix", prefix.length, runner.gx, runner.gy);
}

const start = createMsCc1SimulationRunner(structuredClone(level));
for (const m of prefix) stepMsCc1Simulation(start, m);
console.log("after south", start.gx, start.gy, start.playerState.chipsRemainingOnMap);

const dirs = ["up", "down", "left", "right"];
function bfs(runner, done, maxDepth, maxNodes) {
  const q = [{ moves: [], runner }];
  const seen = new Set([msCc1RunnerStateKey(runner)]);
  let expanded = 0;
  while (q.length && expanded < maxNodes) {
    const f = q.shift();
    expanded++;
    if (done(f.runner)) return f.moves;
    if (f.moves.length >= maxDepth || f.runner.playerDied) continue;
    for (const d of dirs) {
      const n = cloneMsCc1SimulationRunner(f.runner);
      stepMsCc1Simulation(n, d);
      if (n.playerDied) continue;
      const k = msCc1RunnerStateKey(n);
      if (seen.has(k)) continue;
      seen.add(k);
      q.push({ moves: [...f.moves, d], runner: n });
    }
  }
  return null;
}

const west = bfs(
  start,
  (r) => getCompositeTile(r.level, 11, 5) !== "chip" && r.playerState.chipsRemainingOnMap === 0,
  100,
  2_000_000,
);
if (!west) {
  console.error("no west");
  process.exit(1);
}
for (const m of west) stepMsCc1Simulation(start, m);
console.log("after west", start.gx, start.gy, start.playerState.chipsRemainingOnMap);

const exitSuffix = bfs(start, (r) => r.completed, 50, 500_000);
if (!exitSuffix) {
  console.error("no exit");
  process.exit(1);
}

const full = [...prefix, ...west, ...exitSuffix];
fs.writeFileSync(path.join(__dirname, "level004-solution.json"), `${JSON.stringify(full)}\n`);
console.log("SOLVED", full.length, simulateMsCc1Level(structuredClone(level), full).completed);
