import fs from "fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { decodeSolutionMoves } from "../engine/solutionMoves.js";
import type { Direction, LevelData } from "../engine/types.js";

const level = JSON.parse(
  fs.readFileSync(
    "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-012.json",
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

const sol = JSON.parse(
  fs.readFileSync(
    "../../apps/chips-challenge-web/public/games/chips-challenge-1/data/cc1-ms-solutions/level-012.json",
    "utf8",
  ),
);
const letters: string[] = sol.moves;
console.log("letters", letters.length, "source", sol.moveSource, "rem", sol.simulatedSecondsRemaining);

const moves = decodeSolutionMoves(letters) as Direction[];
const r = createMsCc1SimulationRunner(structuredClone(level));
let i = 0;
for (const d of moves) {
  stepMsCc1Simulation(r, d);
  i++;
  if (r.playerDied || r.completed) break;
}
console.log({
  i,
  total: moves.length,
  completed: r.completed,
  died: r.playerDied,
  death: r.deathMessage,
  pos: `${r.gx},${r.gy}`,
  chips: r.playerState.chipsRemainingOnMap,
  ticks: r.buttonPressCtx.moveBoundary,
  rem: msSecondsRemaining(400, r.buttonPressCtx.moveBoundary),
});

// Also try letters cache
const cache = JSON.parse(fs.readFileSync("scripts/level012-letters.json", "utf8")) as string[];
console.log("cache letters", cache.length);
const moves2 = decodeSolutionMoves(cache) as Direction[];
const r2 = createMsCc1SimulationRunner(structuredClone(level));
let j = 0;
for (const d of moves2) {
  stepMsCc1Simulation(r2, d);
  j++;
  if (r2.playerDied || r2.completed) break;
}
console.log({
  j,
  completed: r2.completed,
  died: r2.playerDied,
  death: r2.deathMessage,
  ticks: r2.buttonPressCtx.moveBoundary,
  rem: msSecondsRemaining(400, r2.buttonPressCtx.moveBoundary),
});
