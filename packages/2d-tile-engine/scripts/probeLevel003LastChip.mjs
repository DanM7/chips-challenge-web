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

const prefix = JSON.parse(
  fs.readFileSync(path.join(__dirname, "level003-partial.json"), "utf8"),
);

const start = createMsCc1SimulationRunner(structuredClone(level));
for (const m of prefix) stepMsCc1Simulation(start, m);
console.log("start", start.gx, start.gy, start.playerState);

const dirs = ["up", "down", "left", "right"];
const q = [{ moves: [], runner: start }];
const seen = new Set([msCc1RunnerStateKey(start)]);
let expanded = 0;

while (q.length && expanded < 3_000_000) {
  const f = q.shift();
  expanded++;
  if (f.runner.playerState.chipsRemainingOnMap === 0) {
    const full = [...prefix, ...f.moves];
    const verify = simulateMsCc1Level(structuredClone(level), full);
    fs.writeFileSync(path.join(__dirname, "level003-solution.json"), `${JSON.stringify(full)}\n`);
    console.log("last chip suffix", f.moves.length, "total", full.length, "verified chips", verify.finalPlayerState.chipsRemainingOnMap);
    process.exit(0);
  }
  if (f.runner.completed) {
    console.log("completed early?");
    process.exit(0);
  }
  if (f.moves.length >= 200 || f.runner.playerDied) continue;
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
console.log("FAIL last chip", expanded);
