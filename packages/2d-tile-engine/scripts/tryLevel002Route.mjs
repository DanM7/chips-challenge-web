import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { cellTile, getCompositeTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
  simulateMsCc1AutoplayLevel,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const level = JSON.parse(
  fs.readFileSync(
    path.join(
      __dirname,
      "../../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-002.json",
    ),
    "utf8",
  ),
);
normalizeLevelLayers(level);

function dump(runner: ReturnType<typeof createMsCc1SimulationRunner>) {
  for (let y = 10; y <= 14; y++) {
    let row = "";
    for (let x = 14; x <= 24; x++) {
      const t = getCompositeTile(runner.level, x, y).slice(0, 5).padEnd(5);
      const w = cellTile(runner.level, "lower", x, y) === "water" ? "*" : " ";
      row += `${t}${w} `;
    }
    console.log(y, row);
  }
}

function play(moves) {
  const runner = createMsCc1SimulationRunner(structuredClone(level));
  for (const d of moves) {
    stepMsCc1Simulation(runner, d);
    if (runner.playerDied) {
      console.log("DIED on", d);
      return runner;
    }
  }
  return runner;
}

// East chips then reposition to push blocks north into water (StrategyWiki top route).
const moves = [
  "up",
  "right",
  "right",
  "down",
  "down",
  "left",
  "left",
  "left",
  "up",
  "up",
  "left",
  "down",
  "right",
  "up",
  "left",
  "left",
  "up",
  "up",
  "right",
  "right",
  "down",
  "left",
  "up",
  "left",
  "left",
  "left",
  "up",
  "right",
  "up",
  "right",
  "down",
  "left",
  "left",
  "left",
  "down",
  "right",
  "right",
  "up",
  "left",
  "left",
  "left",
  "left",
  "up",
  "up",
  "up",
  "up",
  "up",
  "left",
  "left",
  "left",
  "left",
  "down",
  "down",
  "down",
  "down",
  "down",
  "down",
  "down",
  "down",
  "right",
  "up",
  "up",
  "up",
  "up",
  "up",
  "up",
  "up",
  "left",
  "left",
  "left",
  "left",
  "down",
  "down",
  "down",
  "down",
  "down",
  "down",
  "down",
  "down",
  "right",
  "right",
  "right",
  "right",
  "right",
  "right",
  "right",
  "right",
  "up",
  "up",
  "left",
  "left",
  "left",
  "left",
  "left",
  "left",
  "left",
  "left",
];

const runner = play(moves);
console.log("end", runner.gx, runner.gy, "chips", runner.playerState.chipsRemainingOnMap, "completed", runner.completed);
dump(runner);

const autoplay = simulateMsCc1AutoplayLevel(structuredClone(level), moves);
console.log("autoplay", autoplay.completed, autoplay.finalPosition, autoplay.finalPlayerState.chipsRemainingOnMap);
