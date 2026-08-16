import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile, cellTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  cloneMsCc1SimulationRunner,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { decodeSolutionMoves, encodeSolutionMoves } from "../engine/solutionMoves.js";
import { isTrapOpen } from "../engine/msCc1/msCc1Traps.js";
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

type Runner = ReturnType<typeof createMsCc1SimulationRunner>;
const tws = decodeSolutionMoves(readLevelSolution<{ moves: string[] }>(15)!.moves) as Direction[];
const TIME_LIMIT = 250;
const BOLD = 89;

function blockPos(r: Runner): string {
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++)
      if (getCompositeTile(r.level, x, y) === "block_movable") return `${x},${y}`;
  return "gone";
}

function apply(r: Runner, seq: Direction[]) {
  for (const d of seq) {
    stepMsCc1Simulation(r, d);
    if (r.completed || r.playerDied) break;
  }
}

const r0 = createMsCc1SimulationRunner(structuredClone(level));
apply(r0, tws.slice(0, 445));

const pushStr = "ULLLUDDDRRRULLDLUUUU";
const r = cloneMsCc1SimulationRunner(r0);
for (const c of pushStr) {
  const d = c === "U" ? "up" : c === "D" ? "down" : c === "L" ? "left" : "right";
  stepMsCc1Simulation(r, d as Direction);
  console.log(c, `${r.gx},${r.gy}`, "b="+blockPos(r), "trap="+isTrapOpen(r.buttonPressCtx,16,16), r.playerDied?r.deathMessage:"");
  if (r.playerDied) break;
}
console.log("RESULT", { block: blockPos(r), trap: isTrapOpen(r.buttonPressCtx, 16, 16), ticks: r.buttonPressCtx.moveBoundary });

if (blockPos(r) !== "16,9") {
  console.error("push failed");
  process.exit(1);
}

const push = decodeSolutionMoves([...pushStr]) as Direction[];
const mid = tws.slice(445, 793);
const afterSlide = cloneMsCc1SimulationRunner(r);
apply(afterSlide, mid);
console.log("after slide", {
  pos: `${afterSlide.gx},${afterSlide.gy}`,
  ticks: afterSlide.buttonPressCtx.moveBoundary,
  rem: msSecondsRemaining(TIME_LIMIT, afterSlide.buttonPressCtx.moveBoundary),
  trap: isTrapOpen(afterSlide.buttonPressCtx, 16, 16),
  chips: afterSlide.playerState.chipsRemainingOnMap,
  keys: afterSlide.playerState.keys,
  died: afterSlide.playerDied,
  death: afterSlide.deathMessage,
  block: blockPos(afterSlide),
});

if (afterSlide.playerDied) process.exit(1);

for (const s of ["DRRUDDDDDDD", "DRRUUDDDDDDD", "DRRUDDDDDDDD", "DRRUUDDDDDDDD", "DDRRUDDDDDDD"]) {
  const end = cloneMsCc1SimulationRunner(afterSlide);
  apply(end, decodeSolutionMoves([...s]) as Direction[]);
  const rem = msSecondsRemaining(TIME_LIMIT, end.buttonPressCtx.moveBoundary);
  console.log("exit", s, { done: end.completed, died: end.playerDied, rem, ticks: end.buttonPressCtx.moveBoundary });
  if (end.completed && !end.playerDied) {
    const full = [...tws.slice(0, 445), ...push, ...mid, ...(decodeSolutionMoves([...s]) as Direction[])];
    const v = createMsCc1SimulationRunner(structuredClone(level));
    apply(v, full);
    const vrem = msSecondsRemaining(TIME_LIMIT, v.buttonPressCtx.moveBoundary);
    console.log("VERIFY", { rem: vrem, ticks: v.buttonPressCtx.moveBoundary, exact: vrem === BOLD, moves: full.length });
    writeFileSync(
      path.join(root, ".tmp/level015-bold-letters.json"),
      JSON.stringify({ letters: encodeSolutionMoves(full), rem: vrem, ticks: v.buttonPressCtx.moveBoundary, exact: vrem === BOLD, push: pushStr, exit: s }, null, 2),
    );
    if (vrem >= BOLD) {
      console.log("SUCCESS bold");
      break;
    }
  }
}
