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
const hub = ["right", "up", "right", "right", "right", "right", "up", "up", "up", "up", "left"];

const r = createMsCc1SimulationRunner(structuredClone(level));
for (const m of [...prefix, ...hub]) stepMsCc1Simulation(r, m);
console.log("at hub", r.gx, r.gy);

const candidates = [
  ["left", "left", "left", "left", "left", "left", "left", "left", "up", "up", "up", "right", "up", "left", "up"],
  ["down", "left", "left", "left", "left", "left", "left", "up", "up", "up", "up", "right", "right", "up", "left"],
  ["left", "left", "left", "left", "left", "left", "down", "down", "left", "up", "up", "up", "right", "up", "left", "up", "left"],
];

for (const west of candidates) {
  const s = createMsCc1SimulationRunner(structuredClone(level));
  for (const m of [...prefix, ...hub, ...west]) stepMsCc1Simulation(s, m);
  console.log(
    west.length,
    s.gx,
    s.gy,
    "chip",
    getCompositeTile(s.level, 11, 5),
    "chips",
    s.playerState.chipsRemainingOnMap,
    s.playerDied ? "DIED" : "",
  );
}
