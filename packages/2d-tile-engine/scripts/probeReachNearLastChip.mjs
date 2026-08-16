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
const prefix = JSON.parse(
  fs.readFileSync(path.join(__dirname, "level003-partial.json"), "utf8"),
);
const start = createMsCc1SimulationRunner(structuredClone(level));
for (const m of prefix) stepMsCc1Simulation(start, m);

const targets = [
  [15, 18],
  [14, 18],
  [16, 18],
  [15, 17],
  [17, 18],
  [18, 18],
];
const dirs = ["up", "down", "left", "right"];

for (const [tx, ty] of targets) {
  const q = [{ moves: [], runner: start }];
  const seen = new Set([msCc1RunnerStateKey(start)]);
  let found = null;
  while (q.length && !found) {
    const f = q.shift();
    if (f.runner.gx === tx && f.runner.gy === ty) {
      found = f.moves.length;
      break;
    }
    if (f.moves.length >= 60 || f.runner.playerDied) continue;
    const k = msCc1RunnerStateKey(f.runner);
    if (seen.has(k)) continue;
    seen.add(k);
    for (const d of dirs) {
      const n = cloneMsCc1SimulationRunner(f.runner);
      stepMsCc1Simulation(n, d);
      if (!n.playerDied) q.push({ moves: [...f.moves, d], runner: n });
    }
  }
  console.log(tx, ty, found ?? "unreachable");
}
