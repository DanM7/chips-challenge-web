/**
 * Level 15: from chips0, walk (keep boots) — push block onto brown — exit.
 * Budget: ticks <= 809.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile, cellTile } from "../engine/levelRuntime.js";
import {
  cloneMsCc1SimulationRunner,
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
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

const TIME_LIMIT = 250;
const BOLD = 89;
const MAX_TICKS = (TIME_LIMIT - BOLD) * 5 + 4;
type Runner = ReturnType<typeof createMsCc1SimulationRunner>;
const dirs: Direction[] = ["up", "down", "left", "right"];

function mazeKey(r: Runner): string {
  return [
    r.gx,
    r.gy,
    r.playerState.keys.join("+"),
    // block / brown / doors / trap
    getCompositeTile(r.level, 18, 13),
    getCompositeTile(r.level, 17, 13),
    getCompositeTile(r.level, 16, 13),
    getCompositeTile(r.level, 16, 12),
    getCompositeTile(r.level, 16, 11),
    getCompositeTile(r.level, 16, 10),
    getCompositeTile(r.level, 16, 9),
    cellTile(r.level, "upper", 16, 11), // blue door
    cellTile(r.level, "upper", 16, 15), // red door
    isTrapOpen(r.buttonPressCtx, 16, 16) ? 1 : 0,
  ].join("|");
}

function segmentBfs(
  start: Runner,
  maxDepth: number,
  maxNodes: number,
  done: (r: Runner) => boolean,
): Direction[] | null {
  type Frame = { seq: Direction[]; runner: Runner };
  const q: Frame[] = [{ seq: [], runner: start }];
  const seen = new Set([mazeKey(start)]);
  let n = 0;
  let qi = 0;
  while (qi < q.length && n < maxNodes) {
    const f = q[qi++]!;
    n++;
    if (done(f.runner)) {
      console.log("found", n, "len", f.seq.length, "ticks", f.runner.buttonPressCtx.moveBoundary);
      return f.seq;
    }
    if (
      f.seq.length >= maxDepth ||
      f.runner.playerDied ||
      f.runner.buttonPressCtx.moveBoundary > MAX_TICKS
    ) {
      continue;
    }
    for (const d of dirs) {
      const next = cloneMsCc1SimulationRunner(f.runner);
      stepMsCc1Simulation(next, d);
      if (next.playerDied || next.buttonPressCtx.moveBoundary > MAX_TICKS) continue;
      const k = mazeKey(next);
      if (seen.has(k)) continue;
      seen.add(k);
      q.push({ seq: [...f.seq, d], runner: next });
    }
  }
  console.error("expanded", n);
  return null;
}

const tws = decodeSolutionMoves(readLevelSolution<{ moves: string[] }>(15)!.moves) as Direction[];
const prefix: Direction[] = [];
const start = createMsCc1SimulationRunner(structuredClone(level));
for (const d of tws) {
  stepMsCc1Simulation(start, d);
  prefix.push(d);
  if (start.playerState.chipsRemainingOnMap === 0) break;
}
console.log("chips0", {
  pos: { x: start.gx, y: start.gy },
  ticks: start.buttonPressCtx.moveBoundary,
  rem: msSecondsRemaining(TIME_LIMIT, start.buttonPressCtx.moveBoundary),
  keys: start.playerState.keys,
});

// Milestone: block on brown
console.log("Searching block on brown...");
const toBrown = segmentBfs(
  start,
  60,
  800_000,
  (r) => getCompositeTile(r.level, 16, 9) === "block_movable",
);
if (!toBrown) {
  console.error("FAIL block on brown");
  process.exit(1);
}
let r = cloneMsCc1SimulationRunner(start);
for (const d of toBrown) stepMsCc1Simulation(r, d);
console.log("block on brown", {
  pos: { x: r.gx, y: r.gy },
  ticks: r.buttonPressCtx.moveBoundary,
  rem: msSecondsRemaining(TIME_LIMIT, r.buttonPressCtx.moveBoundary),
  keys: r.playerState.keys,
  trap: isTrapOpen(r.buttonPressCtx, 16, 16),
});

console.log("Searching exit...");
const toExit = segmentBfs(
  r,
  40,
  400_000,
  (x) =>
    x.completed &&
    msSecondsRemaining(TIME_LIMIT, x.buttonPressCtx.moveBoundary) >= BOLD,
);
if (!toExit) {
  // any exit
  const any = segmentBfs(r, 40, 400_000, (x) => x.completed);
  if (any) {
    const end = cloneMsCc1SimulationRunner(r);
    for (const d of any) stepMsCc1Simulation(end, d);
    console.log("any exit", {
      rem: msSecondsRemaining(TIME_LIMIT, end.buttonPressCtx.moveBoundary),
      ticks: end.buttonPressCtx.moveBoundary,
      moves: encodeSolutionMoves(any).join(""),
    });
  }
  console.error("FAIL bold exit");
  process.exit(1);
}

const full = [...prefix, ...toBrown, ...toExit];
const end = createMsCc1SimulationRunner(structuredClone(level));
for (const d of full) stepMsCc1Simulation(end, d);
const rem = msSecondsRemaining(TIME_LIMIT, end.buttonPressCtx.moveBoundary);
const letters = encodeSolutionMoves(full);
console.log("SUCCESS", {
  rem,
  ticks: end.buttonPressCtx.moveBoundary,
  moves: letters.length,
  exact: rem === BOLD,
});
writeFileSync(
  path.join(root, ".tmp/level015-bold-letters.json"),
  JSON.stringify({ letters, rem, ticks: end.buttonPressCtx.moveBoundary }, null, 2),
);
