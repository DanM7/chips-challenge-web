import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
} from "../engine/msCc1/msCc1Simulation.js";

const level = JSON.parse(
  fs.readFileSync(
    path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-005.json",
    ),
    "utf8",
  ),
);
normalizeLevelLayers(level);

const prefix = [
  "up", "up", "right", "up", "up", "up", "up", "left", "left", "left", "left", "left",
  "right", "left",
  "right", "right", "right", "right", "right",
  "down", "down", "down", "down", "down", "down",
  "up",
  "left", "left", "left", "left", "left", "left", "left",
  "down",
];

const r = createMsCc1SimulationRunner(structuredClone(level));
for (let i = 0; i < prefix.length; i++) {
  if (i > 0) stepMsCc1Wait(r);
  stepMsCc1Simulation(r, prefix[i]);
  console.log(i + 1, prefix[i], r.gx, r.gy, r.playerState.keys, r.playerDied ? "DIED" : "");
  if (r.playerDied) break;
}
