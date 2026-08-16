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

const eastChips = [[24, 7], [24, 10], [24, 12], [24, 15]];

function status(runner, label) {
  const gone = eastChips.filter(([x, y]) => getCompositeTile(runner.level, x, y) !== "chip").length;
  console.log(label, runner.gx, runner.gy, "chips left", runner.playerState.chipsRemainingOnMap, "east collected", gone);
}

const r = createMsCc1SimulationRunner(structuredClone(level));
status(r, "start");

// East room: right from start, through toggle maze (GameFAQs order)
const east = [
  "right", "right", "right", "right", "right",
  "up", "up",
  "right", "right", "right", "right", "right", "right",
  "down",
  "right",
  "down", "down",
  "left",
  "down", "down",
  "left",
  "up",
  "left", "left", "left", "left", "left", "left",
  "down",
  "right", "right", "right", "right", "right", "right",
  "up",
  "right",
  "down", "down", "down",
  "left",
  "down",
  "left", "left", "left", "left", "left", "left",
  "up", "up",
  "left", "left", "left",
];

for (const m of east) {
  stepMsCc1Simulation(r, m);
  if (r.playerDied) {
    console.log("DIED on", m);
    break;
  }
}
status(r, "after east attempt");

const verify = simulateMsCc1Level(structuredClone(level), east);
console.log("verify partial", verify.playerDied, verify.finalPlayerState?.chipsRemainingOnMap);
