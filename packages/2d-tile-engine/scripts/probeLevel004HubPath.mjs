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
      "../../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-004.json",
    ),
    "utf8",
  ),
);
normalizeLevelLayers(level);
const prefix = JSON.parse(fs.readFileSync(path.join(__dirname, "level004-partial.json"), "utf8"));
const r = createMsCc1SimulationRunner(structuredClone(level));
for (const m of prefix) stepMsCc1Simulation(r, m);

for (let y = 8; y <= 16; y++) {
  let row = `${y} `;
  for (let x = 8; x <= 16; x++) {
    const t = getCompositeTile(r.level, x, y);
    const c = r.gx === x && r.gy === y ? "@" : t === "empty" ? "." : t === "wall" ? "#" : t[0];
    row += c;
  }
  console.log(row);
}

function tryPath(moves) {
  const s = createMsCc1SimulationRunner(structuredClone(level));
  for (const m of prefix) stepMsCc1Simulation(s, m);
  for (const m of moves) {
    stepMsCc1Simulation(s, m);
    if (s.playerDied) return null;
  }
  return s;
}

const hub = tryPath(["right", "right", "right", "right", "up", "up", "up", "up"]);
if (hub) console.log("to hub?", hub.gx, hub.gy);

const westTry = tryPath([
  "right", "right", "right", "right",
  "up", "up", "up", "up",
  "left", "left", "left", "left", "left", "left", "left", "left",
  "up", "up", "up",
]);
if (westTry) console.log("west try", westTry.gx, westTry.gy, getCompositeTile(westTry.level, 11, 5));
