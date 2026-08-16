import { readFileSync } from "fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { createMsCc1SimulationRunner, stepMsCc1Simulation, stepMsCc1Wait } from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import type { Direction, LevelData } from "../engine/types.js";

const level = JSON.parse(readFileSync("../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-005.json","utf8")) as LevelData;
normalizeLevelLayers(level);
const letters = "UURUUUULLLLLRRRRRDDDDDDDLLLLLLLUUUWWWWDDDRRURUURRRRUUUULLLLLLLUUURRLLUUURRWWWLLUULLL".split("");
const r = createMsCc1SimulationRunner(structuredClone(level));
for (const ch of letters) {
  if (ch === "W") stepMsCc1Wait(r);
  else stepMsCc1Simulation(r, ch === "U" ? "up" : ch === "D" ? "down" : ch === "L" ? "left" : "right");
  if (r.completed || r.playerDied) break;
}
console.log({ completed: r.completed, died: r.playerDied, rem: msSecondsRemaining(100, r.buttonPressCtx.moveBoundary), ticks: r.buttonPressCtx.moveBoundary });
