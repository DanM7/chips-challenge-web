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

const toolOrder = ["suction_boots", "fire_boots", "flippers", "ice_skates"];
const dirs = ["up", "down", "left", "right"];

const q = [{ moves: [], runner: createMsCc1SimulationRunner(structuredClone(level)) }];
const seen = new Set();
let best = 0;
while (q.length) {
  const f = q.shift();
  const k = msCc1RunnerStateKey(f.runner);
  if (seen.has(k)) continue;
  seen.add(k);
  const score = toolOrder.filter((t) => f.runner.playerState.tools.includes(t)).length;
  if (score > best && f.runner.playerState.chipsRemainingOnMap === 4) {
    best = score;
    console.log("tools", score, "depth", f.moves.length, "pos", f.runner.gx, f.runner.gy, f.runner.playerState.tools);
  }
  if (score === 4 && f.runner.playerState.chipsRemainingOnMap === 4) {
    console.log("ALL TOOLS NO CHIPS", f.moves.length, f.moves.join(","));
    process.exit(0);
  }
  if (f.moves.length >= 80 || f.runner.playerDied) continue;
  for (const d of dirs) {
    const n = cloneMsCc1SimulationRunner(f.runner);
    stepMsCc1Simulation(n, d);
    if (!n.playerDied) q.push({ moves: [...f.moves, d], runner: n });
  }
}
console.log("best tools without chips", best, "seen", seen.size);
