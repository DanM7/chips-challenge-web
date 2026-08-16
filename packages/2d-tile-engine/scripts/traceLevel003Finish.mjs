import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
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

const tail = [
  "down", "down", "down", "down",
  "left", "left", "left", "left", "left",
  "down", "down", "right", "right", "right", "right", "right", "right", "right",
  "down",
  "down", "right", "down",
  "up", "up", "up", "up", "up", "up", "up", "up", "up", "up", "up", "up",
];

const moves = [...prefix, ...tail];
const r = simulateMsCc1Level(structuredClone(level), moves);
console.log("result", r.completed, r.playerDied, r.gx, r.gy, r.finalPlayerState.chipsRemainingOnMap, r.deathMessage);

// step trace last part
const runner = createMsCc1SimulationRunner(structuredClone(level));
for (const m of moves) {
  const b = { x: runner.gx, y: runner.gy };
  stepMsCc1Simulation(runner, m);
  if (m === tail[tail.length - 15] || runner.playerState.chipsRemainingOnMap === 0 || runner.completed) {
    console.log(m, `${b.x},${b.y}->${runner.gx},${runner.gy}`, getCompositeTile(runner.level, runner.gx, runner.gy), "chips", runner.playerState.chipsRemainingOnMap);
  }
}
