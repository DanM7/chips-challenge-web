import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { msCc1StateFromRun } from "../engine/msCc1/msCc1Movement.js";
import { tryMsCc1Move } from "../engine/msCc1/msCc1Movement.js";
import { createMsCc1Monsters } from "../engine/msCc1/msCc1Monsters.js";
import { collectRedButtonCells } from "../engine/msCc1/msCc1Buttons.js";
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
// walk to 14,17
for (const m of ["down", "down", "down", "down", "left", "left", "left", "left", "left", "down"]) {
  stepMsCc1Simulation(runner, m);
}
console.log("at", runner.gx, runner.gy);

const buttonPressCtx = {
  redButtonArmed: collectRedButtonCells(runner.level),
  openTraps: new Set(),
  stuckOnTraps: new Set(),
  heldBrownButtons: new Set(),
  moveBoundary: 0,
  stepParity: "even",
};
const monsters = createMsCc1Monsters(runner.level);
const state = msCc1StateFromRun([], runner.playerState.chipsRemainingOnMap, runner.playerState.tools);
for (const d of ["down", "left", "right"]) {
  const r = tryMsCc1Move(
    runner.level,
    { x: runner.gx, y: runner.gy },
    d,
    state,
    buttonPressCtx,
    monsters,
  );
  console.log(d, "moved", r.moved, "to", r.position, "died", r.playerDied, r.deathMessage);
}
