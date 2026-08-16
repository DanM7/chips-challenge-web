/**
 * Shave ticks from TWS[0..793] so chip-hold exit lands on rem 89.
 * Current: slide@798 + exit → 811 (rem 88). Need ticks <= 809.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  cloneMsCc1SimulationRunner,
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

const TIME_LIMIT = 250;
const BOLD = 89;
type Runner = ReturnType<typeof createMsCc1SimulationRunner>;

function apply(r: Runner, seq: Direction[]) {
  for (const d of seq) {
    stepMsCc1Simulation(r, d);
    if (r.completed || r.playerDied) break;
  }
}

function evalFull(moves: Direction[]) {
  const r = createMsCc1SimulationRunner(structuredClone(level));
  apply(r, moves);
  return {
    completed: r.completed,
    died: r.playerDied,
    ticks: r.buttonPressCtx.moveBoundary,
    rem: msSecondsRemaining(TIME_LIMIT, r.buttonPressCtx.moveBoundary),
  };
}

const tws = decodeSolutionMoves(readLevelSolution<{ moves: string[] }>(15)!.moves) as Direction[];
const exit = decodeSolutionMoves([..."DRRUUUDDDDDDDD"]) as Direction[];
const prefixLen = 793; // through slide landing

let prefix = tws.slice(0, prefixLen);
let best = evalFull([...prefix, ...exit]);
console.log("start", best, "prefixLen", prefix.length);

// Try removing single moves from prefix that preserve slide landing state enough for exit to work
function reachesExit(pref: Direction[]) {
  const r = evalFull([...pref, ...exit]);
  return r.completed && !r.died ? r : null;
}

// Greedy remove from prefix
let improved = true;
let pass = 0;
while (improved && pass < 20) {
  improved = false;
  pass++;
  for (let i = 0; i < prefix.length; i++) {
    const cand = prefix.slice(0, i).concat(prefix.slice(i + 1));
    const r = reachesExit(cand);
    if (r && r.ticks < best.ticks) {
      prefix = cand;
      best = r;
      improved = true;
      console.log("removed", i, best, "len", prefix.length);
      break;
    }
  }
}

// Try removing adjacent pairs
for (let i = 0; i < prefix.length - 1; i++) {
  const cand = prefix.slice(0, i).concat(prefix.slice(i + 2));
  const r = reachesExit(cand);
  if (r && r.ticks < best.ticks) {
    prefix = cand;
    best = r;
    console.log("removed pair", i, best);
    i = Math.max(-1, i - 2);
  }
}

console.log("after prune", best);

// If rem >= 89, done. If rem > 89, burn; if still 88, try swapping small windows with BFS
const full = [...prefix, ...exit];
if (best.completed && best.rem >= BOLD) {
  // exactify if needed
  let letters = encodeSolutionMoves(full);
  let ticks = best.ticks;
  let rem = best.rem;
  if (rem > BOLD) {
    // insert LR at (14,11) after slide — slide is last move of prefix
    const burnNeeded = (TIME_LIMIT - BOLD) * 5 - ticks; // to reach 805
    console.log("burn needed", burnNeeded);
  }
  writeFileSync(
    path.join(root, ".tmp/level015-bold-letters.json"),
    JSON.stringify({ letters, rem, ticks, exact: rem === BOLD }, null, 2),
  );
  console.log("WROTE", { rem, ticks, exact: rem === BOLD, moves: letters.length });
} else {
  console.log("still short", best);
  writeFileSync(
    path.join(root, ".tmp/level015-bold-letters.json"),
    JSON.stringify(
      {
        letters: encodeSolutionMoves(full),
        rem: best.rem,
        ticks: best.ticks,
        exact: false,
        note: "best chip-hold exit; need 2 more ticks shaved",
      },
      null,
      2,
    ),
  );
}
