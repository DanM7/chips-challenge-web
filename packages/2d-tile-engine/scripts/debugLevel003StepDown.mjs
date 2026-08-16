import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
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
const r = createMsCc1SimulationRunner(structuredClone(level));
for (const m of prefix) stepMsCc1Simulation(r, m);
for (const m of ["down", "down", "down", "down", "left", "left", "left", "left", "left", "down"]) {
  stepMsCc1Simulation(r, m);
}
console.log("before", r.gx, r.gy);
stepMsCc1Simulation(r, "down");
console.log("after down", r.gx, r.gy, getCompositeTile(r.level, r.gx, r.gy));
stepMsCc1Simulation(r, "right");
console.log("after right", r.gx, r.gy, getCompositeTile(r.level, r.gx, r.gy));
stepMsCc1Simulation(r, "down");
console.log("after down2", r.gx, r.gy, getCompositeTile(r.level, r.gx, r.gy), "chips", r.playerState.chipsRemainingOnMap);
