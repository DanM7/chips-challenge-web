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
const prefix = JSON.parse(fs.readFileSync(path.join(__dirname, "level004-partial.json"), "utf8"));
const start = createMsCc1SimulationRunner(structuredClone(level));
for (const m of prefix) stepMsCc1Simulation(start, m);

const dirs = ["up", "down", "left", "right"];
const q = [{ moves: [], runner: start }];
const seen = new Set([msCc1RunnerStateKey(start)]);
let expanded = 0;
while (q.length && expanded < 300_000) {
  const f = q.shift();
  expanded++;
  if (getCompositeTile(f.runner.level, 11, 5) !== "chip" && f.runner.playerState.chipsRemainingOnMap === 0) {
    console.log("west", f.moves.length, expanded);
    process.exit(0);
  }
  if (f.moves.length >= 70 || f.runner.playerDied) continue;
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
console.log("fail", expanded);
