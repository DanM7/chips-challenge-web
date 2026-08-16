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

const dirs = ["up", "down", "left", "right"];
const target = { gx: 19, gy: 15, chips: 1 };
const q = [{ moves: [], runner: createMsCc1SimulationRunner(structuredClone(level)) }];
const seen = new Set();
while (q.length) {
  const f = q.shift();
  const k = msCc1RunnerStateKey(f.runner);
  if (seen.has(k)) continue;
  seen.add(k);
  if (f.runner.gx === target.gx && f.runner.gy === target.gy && f.runner.playerState.chipsRemainingOnMap === 1) {
    const r = f.runner;
    const tiles = [];
    for (let y = 0; y < r.level.height; y++) {
      for (let x = 0; x < r.level.width; x++) {
        const t = getCompositeTile(r.level, x, y);
        if (t.includes("suction") || t.includes("boots") || t === "chip") tiles.push({ x, y, t });
      }
    }
    console.log("remaining interesting tiles", tiles);
    process.exit(0);
  }
  if (f.moves.length >= 30 || f.runner.playerDied) continue;
  for (const d of dirs) {
    const n = cloneMsCc1SimulationRunner(f.runner);
    stepMsCc1Simulation(n, d);
    if (!n.playerDied) q.push({ moves: [...f.moves, d], runner: n });
  }
}
