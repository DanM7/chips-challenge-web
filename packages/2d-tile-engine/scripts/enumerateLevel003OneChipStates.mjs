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

const allTools = ["suction_boots", "fire_boots", "flippers", "ice_skates"];
const dirs = ["up", "down", "left", "right"];

const q = [{ moves: [], runner: createMsCc1SimulationRunner(structuredClone(level)) }];
const seen = new Set();
const endpoints = new Map();

while (q.length) {
  const f = q.shift();
  const k = msCc1RunnerStateKey(f.runner);
  if (seen.has(k)) continue;
  seen.add(k);

  const toolsOk = allTools.every((t) => f.runner.playerState.tools.includes(t));
  if (toolsOk && f.runner.playerState.chipsRemainingOnMap === 1) {
    const pos = `${f.runner.gx},${f.runner.gy}`;
    if (!endpoints.has(pos)) endpoints.set(pos, f.moves.length);
  }

  if (f.moves.length >= 45 || f.runner.playerDied) continue;
  for (const d of dirs) {
    const n = cloneMsCc1SimulationRunner(f.runner);
    stepMsCc1Simulation(n, d);
    if (!n.playerDied) q.push({ moves: [...f.moves, d], runner: n });
  }
}

console.log("endpoints with all tools + 1 chip:", [...endpoints.entries()].sort((a, b) => a[1] - b[1]));
