import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import {
  cloneMsCc1SimulationRunner,
  createMsCc1SimulationRunner,
  msCc1RunnerStateKey,
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

const dirs = ["up", "down", "left", "right"];
const allTools = ["suction_boots", "fire_boots", "flippers", "ice_skates"];

// rebuild prefix to 12,15 1 chip all tools
const q = [{ moves: [], runner: createMsCc1SimulationRunner(structuredClone(level)) }];
const seen = new Set();
let prefix = null;
while (q.length && !prefix) {
  const f = q.shift();
  const k = msCc1RunnerStateKey(f.runner);
  if (seen.has(k)) continue;
  seen.add(k);
  if (
    f.runner.gx === 12 &&
    f.runner.gy === 15 &&
    f.runner.playerState.chipsRemainingOnMap === 1 &&
    allTools.every((t) => f.runner.playerState.tools.includes(t))
  ) {
    prefix = f.moves;
    break;
  }
  if (f.moves.length >= 50 || f.runner.playerDied) continue;
  for (const d of dirs) {
    const n = cloneMsCc1SimulationRunner(f.runner);
    stepMsCc1Simulation(n, d);
    if (!n.playerDied) q.push({ moves: [...f.moves, d], runner: n });
  }
}

const start = createMsCc1SimulationRunner(structuredClone(level));
for (const m of prefix) stepMsCc1Simulation(start, m);

// BFS to collect last chip (0 chips left)
const q2 = [{ moves: [], runner: start }];
const seen2 = new Set([msCc1RunnerStateKey(start)]);
let expanded = 0;
while (q2.length && expanded < 500000) {
  const f = q2.shift();
  expanded++;
  if (f.runner.playerState.chipsRemainingOnMap === 0) {
    console.log("got last chip in", f.moves.length, "moves at", f.runner.gx, f.runner.gy);
    process.exit(0);
  }
  if (f.moves.length >= 80 || f.runner.playerDied) continue;
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
console.log("cannot get last chip", expanded);
