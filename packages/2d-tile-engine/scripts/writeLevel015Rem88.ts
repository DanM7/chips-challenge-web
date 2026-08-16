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
import { readLevelSolution } from "../integration/solutionStorage.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const level = JSON.parse(
  readFileSync(
    path.join(
      root,
      "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-015.json",
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);
const tws = decodeSolutionMoves(readLevelSolution<{ moves: string[] }>(15)!.moves) as Direction[];
const exit: Direction[] = [
  "down", "down", "down", "down", "right", "right", "right", "right",
  "up", "up", "left", "left", "up", "up", "up", "up", "left", "left",
  "up", "up", "up", "up", "up", "up", "up", "up", "up", "up", "up", "up",
  "up", "down", "down", "right", "right", "up", "up", "up",
  "down", "down", "down", "down", "down", "down", "down", "down",
];
const full = [...tws.slice(0, 761), ...exit];
const r = createMsCc1SimulationRunner(structuredClone(level));
for (const d of full) {
  stepMsCc1Simulation(r, d);
  if (r.playerDied || r.completed) break;
}
const rem = msSecondsRemaining(250, r.buttonPressCtx.moveBoundary);
console.log({ completed: r.completed, died: r.playerDied, rem, ticks: r.buttonPressCtx.moveBoundary, len: full.length });
if (r.completed && !r.playerDied) {
  const webPath = path.join(
    root,
    "../../apps/chips-challenge-web/public/games/chips-challenge-1/data/cc1-ms-solutions/level-015.json",
  );
  const entry = JSON.parse(readFileSync(webPath, "utf8"));
  writeFileSync(
    webPath,
    `${JSON.stringify(
      {
        ...entry,
        moves: encodeSolutionMoves(full),
        moveVerified: rem === 89,
        meetsBoldBudget: rem >= 89,
        simulatedTicks: r.buttonPressCtx.moveBoundary,
        simulatedSecondsRemaining: rem,
        moveSource: `TWS to chips0 + thief-slide hold-brown exit; rem ${rem} (bold 89)`,
        boldGapNote: rem === 89 ? undefined : `Completes at ${rem}s vs bold 89 (need ${r.buttonPressCtx.moveBoundary - 805} fewer ticks)`,
      },
      null,
      2,
    )}\n`,
  );
  console.log("wrote 15");
}
