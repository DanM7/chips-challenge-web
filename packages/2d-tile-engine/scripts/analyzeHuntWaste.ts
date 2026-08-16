/**
 * Hunt waste: count moves that do not pick up a chip; try deleting those first.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { Direction, LevelData } from "../engine/types.js";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  cloneMsCc1SimulationRunner,
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { decodeSolutionMoves, encodeSolutionMoves } from "../engine/solutionMoves.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const levelPath = path.join(
  root,
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-012.json",
);
const webSolPath = path.join(
  root,
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/data/cc1-ms-solutions/level-012.json",
);

const level = JSON.parse(fs.readFileSync(levelPath, "utf8")) as LevelData;
normalizeLevelLayers(level);
const DIRS: Direction[] = ["up", "down", "left", "right"];
type Runner = ReturnType<typeof createMsCc1SimulationRunner>;

function verify(moves: Direction[]) {
  const r = createMsCc1SimulationRunner(structuredClone(level));
  for (const d of moves) {
    stepMsCc1Simulation(r, d);
    if (r.playerDied) return { ok: false, rem: 0, ticks: 0, r };
    if (r.completed) break;
  }
  return {
    ok: r.completed && !r.playerDied,
    rem: msSecondsRemaining(400, r.buttonPressCtx.moveBoundary),
    ticks: r.buttonPressCtx.moveBoundary,
    r,
  };
}

const entry = JSON.parse(fs.readFileSync(webSolPath, "utf8"));
const moves = decodeSolutionMoves(entry.moves) as Direction[];
const r0 = createMsCc1SimulationRunner(structuredClone(level));
let waste = 0;
let pick = 0;
const wasteIdx: number[] = [];
for (let i = 0; i < moves.length; i++) {
  const before = r0.playerState.chipsRemainingOnMap;
  stepMsCc1Simulation(r0, moves[i]!);
  if (r0.playerDied) {
    console.log("died at", i);
    break;
  }
  if (r0.playerState.chipsRemainingOnMap < before) pick++;
  else {
    waste++;
    wasteIdx.push(i);
  }
  if (r0.completed) {
    console.log("completed at move", i + 1, "chipsLeft", r0.playerState.chipsRemainingOnMap);
    break;
  }
}
console.log({
  total: moves.length,
  pickups: pick,
  waste,
  chipsReq: level.chipsRequired,
  rem: msSecondsRemaining(400, r0.buttonPressCtx.moveBoundary),
  ticks: r0.buttonPressCtx.moveBoundary,
  wasteHead: wasteIdx.slice(0, 40),
  wasteTail: wasteIdx.slice(-20),
});

// Try deleting waste moves one at a time (from the end, more likely detours)
let best = moves;
let bv = verify(best);
console.log("baseline", bv.rem, bv.ticks);
let removed = 0;
for (const i of [...wasteIdx].reverse()) {
  if (i >= best.length) continue;
  const trial = [...best.slice(0, i), ...best.slice(i + 1)];
  const tv = verify(trial);
  if (tv.ok && tv.ticks <= bv.ticks) {
    best = trial;
    bv = tv;
    removed++;
    console.log("deleted", i, "rem", tv.rem, "ticks", tv.ticks, "len", trial.length);
    if (tv.rem === 270) break;
  }
}
console.log("after waste-delete", { removed, len: best.length, rem: bv.rem, ticks: bv.ticks });

if (bv.ok && bv.rem > entry.simulatedSecondsRemaining) {
  entry.moves = encodeSolutionMoves(best);
  entry.simulatedTicks = bv.ticks;
  entry.simulatedSecondsRemaining = bv.rem;
  entry.moveVerified = bv.rem === 270;
  entry.meetsBoldBudget = bv.rem >= 270;
  entry.moveSource = `waste-delete; rem ${bv.rem} (bold 270)`;
  fs.writeFileSync(webSolPath, `${JSON.stringify(entry, null, 2)}\n`);
  console.log("wrote improved");
}
