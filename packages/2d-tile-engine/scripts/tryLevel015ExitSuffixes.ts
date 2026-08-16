import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { decodeSolutionMoves, encodeSolutionMoves } from "../engine/solutionMoves.js";
import { isTrapOpen } from "../engine/msCc1/msCc1Traps.js";
import type { Direction, LevelData } from "../engine/types.js";
import { readLevelSolution } from "../integration/solutionStorage.js";
import { getCompositeTile } from "../engine/levelRuntime.js";

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

function run(prefixLen: number, suffix: string) {
  const r = createMsCc1SimulationRunner(structuredClone(level));
  for (let i = 0; i < prefixLen; i++) stepMsCc1Simulation(r, tws[i]!);
  const startTicks = r.buttonPressCtx.moveBoundary;
  const letters: string[] = encodeSolutionMoves(tws.slice(0, prefixLen));
  for (const c of suffix) {
    const d =
      c === "D" ? "down" : c === "U" ? "up" : c === "L" ? "left" : c === "R" ? "right" : null;
    if (!d) {
      stepMsCc1Wait(r);
      letters.push("W");
    } else {
      stepMsCc1Simulation(r, d);
      letters.push(c);
    }
  }
  return {
    completed: r.completed,
    died: r.playerDied,
    death: r.deathMessage,
    ticks: r.buttonPressCtx.moveBoundary,
    rem: msSecondsRemaining(250, r.buttonPressCtx.moveBoundary),
    startTicks,
    pos: { x: r.gx, y: r.gy },
    trapOpen: isTrapOpen(r.buttonPressCtx, 16, 16),
    letters,
  };
}

const candidates = [
  "RRUUDDDDDDDD", // 2+2+8
  "RRUUUDDDDDDDD",
  "DRRUUDDDDDDDD",
  "RRUURDDDDDDDD", // detour?
  "RUURDDDDDDDD",
  "RRUDUDDDDDDDD",
];

for (const s of candidates) {
  const r = run(793, s);
  console.log(s, {
    done: r.completed,
    died: r.died,
    rem: r.rem,
    ticks: r.ticks,
    start: r.startTicks,
  });
}

// Also try earlier slide prefix — maybe can reach thief sooner
// Find when we're at (1,2) about to step on thief
console.log("\nThief approach ticks:");
{
  const r = createMsCc1SimulationRunner(structuredClone(level));
  for (let i = 0; i < 793; i++) {
    stepMsCc1Simulation(r, tws[i]!);
    if (r.gx === 1 && r.gy <= 3) {
      console.log(i + 1, tws[i], { x: r.gx, y: r.gy, ticks: r.buttonPressCtx.moveBoundary });
    }
  }
}

// Best candidate write if rem>=89
for (const s of ["RRUUDDDDDDDD", "RRUUUDDDDDDDD", "DRRUUDDDDDDDD"]) {
  const r = run(793, s);
  if (r.completed && !r.died && r.rem >= 89) {
    console.log("WRITE", s, r.rem, r.ticks);
    writeFileSync(
      path.join(root, ".tmp/level015-bold-letters.json"),
      JSON.stringify({ letters: r.letters, rem: r.rem, ticks: r.ticks, suffix: s }, null, 2),
    );
    break;
  }
}
