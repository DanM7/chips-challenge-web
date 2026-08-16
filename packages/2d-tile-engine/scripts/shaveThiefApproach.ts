/**
 * Shave thief-approach only (moves between chips0 and thief).
 */
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
const exit = decodeSolutionMoves([..."DRRUUUDDDDDDDD"]) as Direction[];

function run(moves: Direction[]) {
  const r = createMsCc1SimulationRunner(structuredClone(level));
  for (const d of moves) {
    stepMsCc1Simulation(r, d);
    if (r.completed || r.playerDied) break;
  }
  return {
    done: r.completed,
    died: r.playerDied,
    ticks: r.buttonPressCtx.moveBoundary,
    rem: msSecondsRemaining(250, r.buttonPressCtx.moveBoundary),
    pos: { x: r.gx, y: r.gy },
  };
}

const chips0 = 761;
const slideEnd = 793; // inclusive landing after D from thief
const before = tws.slice(0, chips0);
const approach = tws.slice(chips0, 792); // up to stepping on thief
const slide = tws.slice(792, slideEnd); // U onto thief + D slide? check

console.log("approach", encodeSolutionMoves(approach).join(""), approach.length);
console.log("slide", encodeSolutionMoves(slide).join(""));

// Verify baseline
const base = run([...before, ...approach, ...slide, ...exit]);
console.log("baseline", base);

// Try all single removals from approach
let best = base;
let bestMoves = [...before, ...approach, ...slide, ...exit];
for (let i = 0; i < approach.length; i++) {
  const candApp = approach.slice(0, i).concat(approach.slice(i + 1));
  const r = run([...before, ...candApp, ...slide, ...exit]);
  if (r.done && !r.died && r.ticks < best.ticks) {
    best = r;
    bestMoves = [...before, ...candApp, ...slide, ...exit];
    console.log("improve remove", i, best);
  }
}

// Try BFS replacement for approach: from chips0 to (1,1) no tools
{
  const start = createMsCc1SimulationRunner(structuredClone(level));
  for (const d of before) stepMsCc1Simulation(start, d);
  const dirs: Direction[] = ["up", "down", "left", "right"];
  type Frame = { seq: Direction[]; runner: typeof start };
  const q: Frame[] = [{ seq: [], runner: start }];
  const seen = new Set<string>();
  const key = (r: typeof start) =>
    `${r.gx},${r.gy}|${r.playerState.tools.join("+")}`;
  seen.add(key(start));
  let qi = 0;
  let found: Direction[] | null = null;
  while (qi < q.length && qi < 500_000) {
    const f = q[qi++]!;
    if (f.runner.gx === 1 && f.runner.gy === 1 && f.runner.playerState.tools.length === 0) {
      found = f.seq;
      break;
    }
    if (f.seq.length >= 40 || f.runner.playerDied) continue;
    for (const d of dirs) {
      const { cloneMsCc1SimulationRunner } = await import("../engine/msCc1/msCc1Simulation.js");
      // use structured approach without dynamic import
    }
  }
}

console.log("best so far", best);
if (best.rem >= 89) {
  writeFileSync(
    path.join(root, ".tmp/level015-bold-letters.json"),
    JSON.stringify(
      {
        letters: encodeSolutionMoves(bestMoves),
        rem: best.rem,
        ticks: best.ticks,
        exact: best.rem === 89,
      },
      null,
      2,
    ),
  );
}
