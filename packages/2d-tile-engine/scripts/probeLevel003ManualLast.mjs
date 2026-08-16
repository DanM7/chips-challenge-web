import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
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
const runner = createMsCc1SimulationRunner(structuredClone(level));
for (const m of prefix) stepMsCc1Simulation(runner, m);

const tries = [
  ["down", "down", "down", "down", "down", "left", "left", "left", "left", "up"],
  ["down", "left", "left", "down", "down", "down", "left", "left", "up", "up", "up"],
  ["left", "down", "down", "down", "down", "down", "left", "left", "left", "up", "up", "up", "up"],
];

for (const moves of tries) {
  const r = createMsCc1SimulationRunner(structuredClone(level));
  for (const m of prefix) stepMsCc1Simulation(r, m);
  let ok = true;
  for (const m of moves) {
    stepMsCc1Simulation(r, m);
    if (r.playerDied) {
      ok = false;
      break;
    }
  }
  console.log(moves.join(","), "->", r.gx, r.gy, "chips", r.playerState.chipsRemainingOnMap, ok ? "" : "DIED");
}
