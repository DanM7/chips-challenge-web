import { readFileSync } from "fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { decodeSolutionMoves } from "../engine/solutionMoves.js";
import type { LevelData } from "../engine/types.js";

for (const n of [1, 2, 3, 4, 8, 10, 16]) {
  const id = String(n).padStart(3, "0");
  const level = JSON.parse(
    readFileSync(
      `../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-${id}.json`,
      "utf8",
    ),
  ) as LevelData;
  normalizeLevelLayers(level);
  const sol = JSON.parse(
    readFileSync(
      `../../apps/chips-challenge-web/public/games/chips-challenge-1/data/cc1-ms-solutions/level-${id}.json`,
      "utf8",
    ),
  ) as {
    moves: string[] | null;
    timeLimitSeconds: number;
    boldTimeRemaining: number;
    simulatedSecondsRemaining?: number;
  };
  if (!sol.moves) {
    console.log(n, "no moves");
    continue;
  }
  const dirs = decodeSolutionMoves(sol.moves);
  const chipOnly = createMsCc1SimulationRunner(structuredClone(level));
  for (const d of dirs) {
    stepMsCc1Simulation(chipOnly, d);
    if (chipOnly.completed || chipOnly.playerDied) break;
  }
  const autoplay = createMsCc1SimulationRunner(structuredClone(level));
  for (const d of dirs) {
    stepMsCc1Wait(autoplay);
    if (autoplay.playerDied) break;
    stepMsCc1Simulation(autoplay, d);
    if (autoplay.completed || autoplay.playerDied) break;
  }
  const limit = sol.timeLimitSeconds || 0;
  console.log(n, {
    moves: dirs.length,
    bold: sol.boldTimeRemaining,
    recorded: sol.simulatedSecondsRemaining,
    chipOnly: {
      ok: chipOnly.completed,
      rem: limit ? msSecondsRemaining(limit, chipOnly.buttonPressCtx.moveBoundary) : null,
      ticks: chipOnly.buttonPressCtx.moveBoundary,
    },
    autoplayWait: {
      ok: autoplay.completed,
      rem: limit ? msSecondsRemaining(limit, autoplay.buttonPressCtx.moveBoundary) : null,
      ticks: autoplay.buttonPressCtx.moveBoundary,
    },
  });
}
