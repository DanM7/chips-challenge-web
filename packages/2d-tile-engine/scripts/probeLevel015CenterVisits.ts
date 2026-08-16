import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  cloneMsCc1SimulationRunner,
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
const r = createMsCc1SimulationRunner(structuredClone(level));

const visits: Array<{ i: number; x: number; y: number; ticks: number; keys: string[]; chips: number }> = [];
for (let i = 0; i < tws.length; i++) {
  stepMsCc1Simulation(r, tws[i]!);
  if (r.gy >= 11 && r.gy <= 15 && r.gx >= 14 && r.gx <= 20) {
    visits.push({
      i: i + 1,
      x: r.gx,
      y: r.gy,
      ticks: r.buttonPressCtx.moveBoundary,
      keys: [...r.playerState.keys],
      chips: r.playerState.chipsRemainingOnMap,
    });
  }
}
console.log("center visits", visits.length);
// show unique-ish samples every time chips/keys change or near block
let last = "";
for (const v of visits) {
  const sig = `${v.chips}|${v.keys.join(",")}|${v.x},${v.y}`;
  if (sig !== last && (v.chips <= 6 || v.i < 200 || v.i > 700)) {
    console.log(v);
    last = sig;
  }
}

// Try: at first visit after chips<=3 with red+blue keys near block, insert push to brown
console.log("\nLooking for insert points...");
for (const v of visits) {
  if (
    v.chips === 0 &&
    v.keys.includes("key_blue") &&
    v.keys.includes("key_red") &&
    v.i < 761
  ) {
    console.log("chips0 before end in center?", v);
  }
}
