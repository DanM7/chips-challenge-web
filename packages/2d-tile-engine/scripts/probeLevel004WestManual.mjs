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
      "../../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-004.json",
    ),
    "utf8",
  ),
);
normalizeLevelLayers(level);
const prefix = JSON.parse(fs.readFileSync(path.join(__dirname, "level004-partial.json"), "utf8"));
const r = createMsCc1SimulationRunner(structuredClone(level));
for (const m of prefix) stepMsCc1Simulation(r, m);

// Return to hub then west tank room (manual probe)
const west = [
  "up", "up", "up", "up",
  "right", "right", "right", "right",
  "up", "up",
  "left", "left", "left", "left", "left", "left", "left", "left",
  "up", "up", "up",
  "right",
  "up",
  "left",
  "up",
  "left", "left",
  "down",
  "left",
  "up", "up", "up", "up",
  "right", "right", "right", "right", "right", "right", "right", "right",
  "down", "down", "down", "down",
];

for (const m of west) {
  const b = { x: r.gx, y: r.gy };
  stepMsCc1Simulation(r, m);
  console.log(m, `${b.x},${b.y}->${r.gx},${r.gy}`, getCompositeTile(r.level, r.gx, r.gy), "chips", r.playerState.chipsRemainingOnMap, r.playerDied ? "DIED" : "");
  if (r.playerDied) break;
}

const full = [...prefix, ...west];
console.log("chip 11,5 gone", getCompositeTile(r.level, 11, 5) !== "chip", "completed", r.completed);
