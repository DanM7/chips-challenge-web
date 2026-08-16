import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { decodeSolutionMoves, encodeSolutionMoves } from "../engine/solutionMoves.js";
import type { Direction, LevelData } from "../engine/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webPath = path.join(
  root,
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/data/cc1-ms-solutions/level-011.json",
);
const level = JSON.parse(
  readFileSync(
    path.join(
      root,
      "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-011.json",
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

const entry = JSON.parse(readFileSync(webPath, "utf8"));
const moves = decodeSolutionMoves(entry.moves) as Direction[];
const pad: Direction[] = [];
for (let i = 0; i < 44; i++) pad.push("left", "right");
const full = [...moves.slice(0, -2), ...pad, ...moves.slice(-2)];

const r = createMsCc1SimulationRunner(structuredClone(level));
for (const d of full) {
  stepMsCc1Simulation(r, d);
  if (r.playerDied) {
    console.log("died", r.deathMessage, r.gx, r.gy);
    process.exit(1);
  }
  if (r.completed) break;
}
const rem = msSecondsRemaining(300, r.buttonPressCtx.moveBoundary);
console.log({
  completed: r.completed,
  died: r.playerDied,
  ticks: r.buttonPressCtx.moveBoundary,
  rem,
  exact: rem === 211,
  len: full.length,
});
if (r.completed && rem === 211) {
  entry.moves = encodeSolutionMoves(full);
  entry.moveVerified = true;
  entry.meetsBoldBudget = true;
  entry.simulatedTicks = r.buttonPressCtx.moveBoundary;
  entry.simulatedSecondsRemaining = 211;
  entry.moveSource =
    "Segment BFS (SW outline) + 44 LR pads on thin-wall column before exit; exact 211";
  delete entry.boldGapNote;
  writeFileSync(webPath, `${JSON.stringify(entry, null, 2)}\n`);
  console.log("WROTE exact 211");
}
