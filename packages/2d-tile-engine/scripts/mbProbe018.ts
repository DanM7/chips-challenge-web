import { readFileSync } from "node:fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";

const level = JSON.parse(
  readFileSync(
    "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-018.json",
    "utf8",
  ),
);
normalizeLevelLayers(level);
const r = createMsCc1SimulationRunner(structuredClone(level));
for (let i = 0; i < 5; i++) {
  stepMsCc1Simulation(r, "left");
  console.log(
    i + 1,
    "pos",
    r.gx,
    r.gy,
    "mb",
    r.buttonPressCtx.moveBoundary,
    "rem",
    msSecondsRemaining(600, r.buttonPressCtx.moveBoundary),
    "chipMoves",
    r.chipMoves,
  );
}
