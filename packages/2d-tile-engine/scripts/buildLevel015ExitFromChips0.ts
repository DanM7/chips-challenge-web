/**
 * Level 15: TWS prefix to all chips, then BFS exit without force-thief detour.
 * Target rem >= 89 (ideally === 89).
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import {
  cloneMsCc1SimulationRunner,
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
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
const MAX_TICKS = (TIME_LIMIT - BOLD) * 5 + 4;
type Runner = ReturnType<typeof createMsCc1SimulationRunner>;
type Action = Direction | "wait";
const dirs: Direction[] = ["up", "down", "left", "right"];

function digest(r: Runner): string {
  return `${r.level.layers.upper.join(",")}|${r.level.layers.lower.join(",")}`;
}

function mazeKey(r: Runner): string {
  return [
    r.gx,
    r.gy,
    r.playerState.keys.join("+"),
    r.playerState.tools.join("+"),
    digest(r),
    [...r.buttonPressCtx.heldBrownButtons].sort().join(","),
    [...r.buttonPressCtx.openTraps].sort().join(","),
  ].join("|");
}

function apply(start: Runner, seq: Action[]): Runner {
  const r = cloneMsCc1SimulationRunner(start);
  for (const a of seq) {
    if (a === "wait") stepMsCc1Wait(r);
    else stepMsCc1Simulation(r, a);
    if (r.completed || r.playerDied) break;
  }
  return r;
}

function segmentBfs(
  start: Runner,
  maxDepth: number,
  maxNodes: number,
  done: (r: Runner) => boolean,
  allowWait = false,
): Action[] | null {
  type Frame = { seq: Action[]; runner: Runner };
  const q: Frame[] = [{ seq: [], runner: start }];
  const seen = new Set<string>([mazeKey(start)]);
  let n = 0;
  let qi = 0;
  while (qi < q.length && n < maxNodes) {
    const f = q[qi++]!;
    n++;
    if (done(f.runner)) {
      console.log("found", n, "nodes len", f.seq.length, "ticks", f.runner.buttonPressCtx.moveBoundary);
      return f.seq;
    }
    if (
      f.seq.length >= maxDepth ||
      f.runner.playerDied ||
      f.runner.buttonPressCtx.moveBoundary > MAX_TICKS
    ) {
      continue;
    }
    const actions: Action[] = allowWait ? [...dirs, "wait"] : dirs;
    for (const a of actions) {
      const next = cloneMsCc1SimulationRunner(f.runner);
      if (a === "wait") stepMsCc1Wait(next);
      else stepMsCc1Simulation(next, a);
      if (next.playerDied || next.buttonPressCtx.moveBoundary > MAX_TICKS) continue;
      // Skip force thief at (1,1) — that detour costs bold
      if (next.gx === 1 && next.gy === 1) continue;
      const key = mazeKey(next);
      if (seen.has(key)) continue;
      seen.add(key);
      q.push({ seq: [...f.seq, a], runner: next });
    }
  }
  console.error("expanded", n);
  return null;
}

const tws = decodeSolutionMoves(readLevelSolution<{ moves: string[] }>(15)!.moves) as Direction[];

// Find chips0 index
let chips0 = -1;
{
  const r = createMsCc1SimulationRunner(structuredClone(level));
  for (let i = 0; i < tws.length; i++) {
    stepMsCc1Simulation(r, tws[i]!);
    if (r.playerState.chipsRemainingOnMap === 0) {
      chips0 = i + 1;
      console.log("chips0 at", chips0, {
        pos: { x: r.gx, y: r.gy },
        ticks: r.buttonPressCtx.moveBoundary,
        rem: msSecondsRemaining(TIME_LIMIT, r.buttonPressCtx.moveBoundary),
        keys: r.playerState.keys,
        tools: r.playerState.tools,
        block: getCompositeTile(r.level, 18, 13),
      });
      break;
    }
  }
}

const prefix = tws.slice(0, chips0) as Action[];
let r = apply(createMsCc1SimulationRunner(structuredClone(level)), prefix);

// Also try from a bit earlier — before last chip return through force
// Milestone: block still at 18,13, have blue+red keys, chips 0
console.log("Searching exit from chips0...");
const exitSeg = segmentBfs(
  r,
  80,
  800_000,
  (x) =>
    x.completed &&
    msSecondsRemaining(TIME_LIMIT, x.buttonPressCtx.moveBoundary) >= BOLD,
  true,
);

if (!exitSeg) {
  console.error("FAIL exit from chips0");
  // Try any exit even if below bold
  const anyExit = segmentBfs(r, 80, 800_000, (x) => x.completed, true);
  if (anyExit) {
    const end = apply(r, anyExit);
    console.log("any exit", {
      ticks: end.buttonPressCtx.moveBoundary,
      rem: msSecondsRemaining(TIME_LIMIT, end.buttonPressCtx.moveBoundary),
      len: anyExit.length,
    });
  }
  process.exit(1);
}

const full = [...prefix, ...exitSeg];
const end = apply(createMsCc1SimulationRunner(structuredClone(level)), full);
const rem = msSecondsRemaining(TIME_LIMIT, end.buttonPressCtx.moveBoundary);
const letters = encodeSolutionMoves(full);
console.log("SUCCESS", {
  rem,
  ticks: end.buttonPressCtx.moveBoundary,
  moves: letters.length,
  waits: letters.filter((c) => c === "W").length,
  chipMoves: letters.filter((c) => c !== "W").length,
  exact: rem === BOLD,
  completed: end.completed,
});

// If rem > 89, try to add detours to hit exact 89
let finalLetters = letters;
let finalRem = rem;
let finalTicks = end.buttonPressCtx.moveBoundary;

if (rem > BOLD) {
  console.log("Above bold; searching exact rem 89 via short detours...");
  // Brute: insert pairs of LR/UD walks before last move to burn ticks
  const targetTicksMin = (TIME_LIMIT - BOLD) * 5; // 805
  const targetTicksMax = targetTicksMin + 4; // 809
  const need = targetTicksMin - end.buttonPressCtx.moveBoundary;
  console.log("need extra ticks", need, "current", end.buttonPressCtx.moveBoundary);
}

writeFileSync(
  path.join(root, ".tmp/level015-bold-letters.json"),
  JSON.stringify(
    {
      letters: finalLetters,
      rem: finalRem,
      ticks: finalTicks,
      meetsBold: finalRem >= BOLD,
      exact: finalRem === BOLD,
    },
    null,
    2,
  ),
);
