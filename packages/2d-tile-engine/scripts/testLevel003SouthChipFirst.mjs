import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
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

const toolsPrefix = [
  "down", "right", "up", "up", "up", "up", "left", "up", "down", "down",
  "left", "left", "left", "down", "up", "right", "right", "down", "right",
  "right", "right", "right", "right",
];
const dirs = ["up", "down", "left", "right"];

const start = createMsCc1SimulationRunner(structuredClone(level));
for (const m of toolsPrefix) stepMsCc1Simulation(start, m);

const q = [{ moves: [], runner: start }];
const seen = new Set([msCc1RunnerStateKey(start)]);
while (q.length) {
  const f = q.shift();
  const k = msCc1RunnerStateKey(f.runner);
  if (seen.has(k)) continue;
  seen.add(k);
  if (f.runner.gx === 15 && f.runner.gy === 19 && f.runner.playerState.chipsRemainingOnMap === 3) {
    console.log("collected 15,19 chip first in", f.moves.length, "suffix moves");
    console.log(f.moves.join(","));
    process.exit(0);
  }
  if (f.moves.length >= 80 || f.runner.playerDied) continue;
  for (const d of dirs) {
    const n = cloneMsCc1SimulationRunner(f.runner);
    stepMsCc1Simulation(n, d);
    if (!n.playerDied) q.push({ moves: [...f.moves, d], runner: n });
  }
}
console.log("cannot collect 15,19 chip first after tools");
