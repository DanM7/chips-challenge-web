import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  createMsCc1SimulationRunner,
  simulateMsCc1AutoplayLevel,
  simulateMsCc1Level,
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

const moves = JSON.parse(
  fs.readFileSync(path.join(__dirname, "level002-solution.json"), "utf8"),
);

const sim = simulateMsCc1Level(structuredClone(level), moves);
const autoplay = simulateMsCc1AutoplayLevel(structuredClone(level), moves);
console.log("sim", sim.completed, sim.finalPosition, sim.finalPlayerState.chipsRemainingOnMap, sim.playerDied);
console.log("autoplay", autoplay.completed, autoplay.finalPosition, autoplay.finalPlayerState.chipsRemainingOnMap, autoplay.playerDied, autoplay.deathMessage);

const runner = createMsCc1SimulationRunner(structuredClone(level));
for (let i = 0; i < moves.length; i++) {
  if (i > 0) stepMsCc1Wait(runner);
  const before = { x: runner.gx, y: runner.gy, chips: runner.playerState.chipsRemainingOnMap };
  stepMsCc1Simulation(runner, moves[i]);
  if (runner.playerDied || runner.completed || i >= moves.length - 5) {
    console.log(
      `#${i + 1} ${moves[i]}`,
      `${before.x},${before.y}->${runner.gx},${runner.gy}`,
      "chips",
      runner.playerState.chipsRemainingOnMap,
      runner.playerDied ? "DIED" : "",
      runner.completed ? "WIN" : "",
    );
  }
  if (runner.playerDied || runner.completed) break;
}
