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
const hub = ["right", "up", "right", "right", "right", "right", "up", "up", "up", "up", "left"];

const start = createMsCc1SimulationRunner(structuredClone(level));
for (const m of [...prefix, ...hub]) stepMsCc1Simulation(start, m);

const dirs = ["up", "down", "left", "right"];
const q = [{ moves: [], runner: start }];
const seen = new Set([msCc1RunnerStateKey(start)]);
let n = 0;
while (q.length && n < 120_000) {
  const f = q.shift();
  n++;
  if (getCompositeTile(f.runner.level, 11, 5) !== "chip" && f.runner.playerState.chipsRemainingOnMap === 0) {
    console.log("FOUND", f.moves.length, n, f.moves.join(","));
    process.exit(0);
  }
  if (f.moves.length >= 45 || f.runner.playerDied) continue;
  for (const d of dirs) {
    const next = cloneMsCc1SimulationRunner(f.runner);
    stepMsCc1Simulation(next, d);
    if (next.playerDied) continue;
    const k = msCc1RunnerStateKey(next);
    if (seen.has(k)) continue;
    seen.add(k);
    q.push({ moves: [...f.moves, d], runner: next });
  }
}
console.log("fail", n);
