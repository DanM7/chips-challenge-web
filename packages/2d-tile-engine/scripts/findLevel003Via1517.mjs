import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
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
      "../../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-003.json",
    ),
    "utf8",
  ),
);
normalizeLevelLayers(level);

const allTools = ["suction_boots", "fire_boots", "flippers", "ice_skates"];
const target = { gx: 15, gy: 17, chips: 1 };
const dirs = ["up", "down", "left", "right"];

const q = [{ moves: [], runner: createMsCc1SimulationRunner(structuredClone(level)) }];
const seen = new Set();
let prefix = null;

while (q.length && !prefix) {
  const f = q.shift();
  const k = msCc1RunnerStateKey(f.runner);
  if (seen.has(k)) continue;
  seen.add(k);
  const toolsOk = allTools.every((t) => f.runner.playerState.tools.includes(t));
  if (toolsOk && f.runner.gx === target.gx && f.runner.gy === target.gy && f.runner.playerState.chipsRemainingOnMap === 1) {
    prefix = f.moves;
    break;
  }
  if (f.moves.length >= 40 || f.runner.playerDied) continue;
  for (const d of dirs) {
    const n = cloneMsCc1SimulationRunner(f.runner);
    stepMsCc1Simulation(n, d);
    if (!n.playerDied) q.push({ moves: [...f.moves, d], runner: n });
  }
}

if (!prefix) {
  console.log("no prefix to 15,17");
  process.exit(1);
}
console.log("prefix to 15,17", prefix.length);

const start = createMsCc1SimulationRunner(structuredClone(level));
for (const m of prefix) stepMsCc1Simulation(start, m);

const q2 = [{ moves: [], runner: start }];
const seen2 = new Set([msCc1RunnerStateKey(start)]);
while (q2.length) {
  const f = q2.shift();
  if (f.runner.playerState.chipsRemainingOnMap === 0) {
    console.log("collected last chip suffix", f.moves.length, "at", f.runner.gx, f.runner.gy);
    const full = [...prefix, ...f.moves];
    fs.writeFileSync(path.join(__dirname, "level003-partial2.json"), JSON.stringify(full));
    // exit BFS
    const q3 = [{ moves: [], runner: f.runner }];
    const seen3 = new Set([msCc1RunnerStateKey(f.runner)]);
    while (q3.length) {
      const g = q3.shift();
      if (g.runner.completed) {
        const all = [...full, ...g.moves];
        fs.writeFileSync(path.join(__dirname, "level003-solution.json"), `${JSON.stringify(all)}\n`);
        console.log("COMPLETE", all.length, simulateMsCc1Level(structuredClone(level), all).completed);
        process.exit(0);
      }
      if (g.moves.length >= 60 || g.runner.playerDied) continue;
      for (const d of dirs) {
        const n = cloneMsCc1SimulationRunner(g.runner);
        stepMsCc1Simulation(n, d);
        if (n.playerDied) continue;
        const k = msCc1RunnerStateKey(n);
        if (seen3.has(k)) continue;
        seen3.add(k);
        q3.push({ moves: [...g.moves, d], runner: n });
      }
    }
    console.log("got chip but no exit");
    process.exit(1);
  }
  if (f.moves.length >= 30 || f.runner.playerDied) continue;
  for (const d of dirs) {
    const n = cloneMsCc1SimulationRunner(f.runner);
    stepMsCc1Simulation(n, d);
    if (n.playerDied) continue;
    const k = msCc1RunnerStateKey(n);
    if (seen2.has(k)) continue;
    seen2.add(k);
    q2.push({ moves: [...f.moves, d], runner: n });
  }
}
console.log("no last chip from 15,17");
