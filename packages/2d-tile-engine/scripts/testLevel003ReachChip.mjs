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
  if (f.runner.gx === 15 && f.runner.gy === 19 && f.runner.playerState.chipsRemainingOnMap === 4) {
    console.log("reached 15,19 with 4 chips in", f.moves.length, "suffix moves");
    process.exit(0);
  }
  if (f.moves.length >= 60 || f.runner.playerDied) continue;
  for (const d of dirs) {
    const n = cloneMsCc1SimulationRunner(f.runner);
    stepMsCc1Simulation(n, d);
    if (!n.playerDied) q.push({ moves: [...f.moves, d], runner: n });
  }
}
console.log("cannot reach 15,19 with all chips");
