import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { decodeSolutionMoves } from "../engine/solutionMoves.js";
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
const r = createMsCc1SimulationRunner(structuredClone(level));

// Trace whenever near ice thief or lose skates or collect ice chips
for (let i = 0; i < tws.length; i++) {
  const beforeChips = r.playerState.chipsRemainingOnMap;
  const beforeSkates = r.playerState.tools.includes("ice_skates");
  stepMsCc1Simulation(r, tws[i]!);
  const nearThief = Math.abs(r.gx - 25) + Math.abs(r.gy - 28) <= 3;
  const lostSkates = beforeSkates && !r.playerState.tools.includes("ice_skates");
  const gotChip = r.playerState.chipsRemainingOnMap < beforeChips;
  const inIce = r.gx >= 16 && r.gy >= 18;
  if ((nearThief || lostSkates || (gotChip && inIce)) && i > 100) {
    console.log(i + 1, tws[i], {
      pos: { x: r.gx, y: r.gy },
      chips: r.playerState.chipsRemainingOnMap,
      skates: r.playerState.tools.includes("ice_skates"),
      ticks: r.buttonPressCtx.moveBoundary,
      rem: msSecondsRemaining(250, r.buttonPressCtx.moveBoundary),
      nearThief,
      lostSkates,
      gotChip,
    });
  }
}
