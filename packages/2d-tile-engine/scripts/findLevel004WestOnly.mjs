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

const dirs = ["up", "down", "left", "right"];
const q = [{ moves: [], runner: start }];
const seen = new Set([msCc1RunnerStateKey(start)]);
let expanded = 0;
const maxNodes = 400_000;
const maxDepth = 70;

while (q.length && expanded < maxNodes) {
  const f = q.shift();
  expanded++;
  if (getCompositeTile(f.runner.level, 11, 5) !== "chip") {
    console.log("west suffix", f.moves.length, "total", prefix.length + f.moves.length);
    console.log(JSON.stringify(f.moves));
    process.exit(0);
  }
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
console.log("fail west", expanded);
