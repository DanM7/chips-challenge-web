import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { simulateMsCc1Level } from "../engine/msCc1/msCc1Simulation.js";

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

// Hand exploration from tools-complete state (19,14): try route toward south chip then exit.
const candidate = [
  // tools prefix
  "down", "right", "up", "up", "up", "up", "left", "up", "down", "down",
  "left", "left", "left", "down", "up", "right", "right", "down", "right",
  "right", "right", "right", "right",
  // explore south/west
  "down", "down", "down", "down", "down",
  "left", "left", "left", "left",
  "up", "up", "up", "up",
];

const r = simulateMsCc1Level(structuredClone(level), candidate);
console.log(r.completed, r.playerDied, r.gx, r.gy, r.finalPlayerState.chipsRemainingOnMap, r.deathMessage);
