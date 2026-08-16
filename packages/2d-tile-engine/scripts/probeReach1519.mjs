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
const prefix = JSON.parse(
  fs.readFileSync(path.join(__dirname, "level003-partial.json"), "utf8"),
);
const start = createMsCc1SimulationRunner(structuredClone(level));
for (const m of prefix) stepMsCc1Simulation(start, m);

const dirs = ["up", "down", "left", "right"];
const q = [{ moves: [], runner: start }];
const seen = new Set([msCc1RunnerStateKey(start)]);
while (q.length) {
  const f = q.shift();
  if (f.runner.gx === 15 && f.runner.gy === 19) {
    console.log("reached 15,19 in", f.moves.length, "chips", f.runner.playerState.chipsRemainingOnMap);
    console.log(f.moves.join(","));
    process.exit(0);
  }
  if (f.moves.length >= 100 || f.runner.playerDied) continue;
  const k = msCc1RunnerStateKey(f.runner);
  if (seen.has(k)) continue;
  seen.add(k);
  for (const d of dirs) {
    const n = cloneMsCc1SimulationRunner(f.runner);
    stepMsCc1Simulation(n, d);
    if (!n.playerDied) q.push({ moves: [...f.moves, d], runner: n });
  }
}
console.log("cannot reach 15,19");
