import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
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
const moves = JSON.parse(fs.readFileSync(path.join(__dirname, "level002-solution.json"), "utf8"));

function replay(idleBetween) {
  const runner = createMsCc1SimulationRunner(structuredClone(level));
  for (let i = 0; i < moves.length; i++) {
    if (idleBetween && i > 0) stepMsCc1Wait(runner);
    stepMsCc1Simulation(runner, moves[i]);
    if (runner.playerDied) {
      console.log(idleBetween ? "autoplay" : "sim", "DIED at", i + 1, moves[i], runner.gx, runner.gy);
      return runner;
    }
  }
  console.log(idleBetween ? "autoplay" : "sim", "WIN", runner.gx, runner.gy);
  return runner;
}

replay(false);
replay(true);
