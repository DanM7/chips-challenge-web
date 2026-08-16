/**
 * Level 15 bold: chips0 → direct U to force thief → slide → tight Chip-hold exit.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
  cloneMsCc1SimulationRunner,
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

const TIME_LIMIT = 250;
const BOLD = 89;
type Runner = ReturnType<typeof createMsCc1SimulationRunner>;
type Action = Direction | "wait";

function apply(r: Runner, seq: Action[]) {
  for (const a of seq) {
    if (a === "wait") stepMsCc1Wait(r);
    else stepMsCc1Simulation(r, a);
    if (r.completed || r.playerDied) break;
  }
}

function status(label: string, r: Runner) {
  console.log(label, {
    pos: { x: r.gx, y: r.gy },
    ticks: r.buttonPressCtx.moveBoundary,
    rem: msSecondsRemaining(TIME_LIMIT, r.buttonPressCtx.moveBoundary),
    tools: r.playerState.tools.length,
    keys: r.playerState.keys,
    trap: isTrapOpen(r.buttonPressCtx, 16, 16),
    died: r.playerDied,
    death: r.deathMessage,
    done: r.completed,
    tile: getCompositeTile(r.level, r.gx, r.gy),
  });
}

const tws = decodeSolutionMoves(readLevelSolution<{ moves: string[] }>(15)!.moves) as Direction[];

// Prefix to chips0
const prefix: Action[] = [];
{
  const r = createMsCc1SimulationRunner(structuredClone(level));
  for (const d of tws) {
    stepMsCc1Simulation(r, d);
    prefix.push(d);
    if (r.playerState.chipsRemainingOnMap === 0) break;
  }
  status("chips0", r);
}

// Try straight up to thief
const upToThief: Action[] = Array.from({ length: 15 }, () => "up" as Direction);
{
  const r = createMsCc1SimulationRunner(structuredClone(level));
  apply(r, prefix);
  apply(r, upToThief);
  status("after 15U", r);
}

// Maybe blocked — BFS to thief (1,1) then note slide
function mazeKey(r: Runner): string {
  return `${r.gx},${r.gy}|${r.playerState.tools.join("+")}|${r.playerState.keys.join("+")}`;
}

function bfsTo(
  start: Runner,
  maxDepth: number,
  done: (r: Runner) => boolean,
): Action[] | null {
  type Frame = { seq: Action[]; runner: Runner };
  const q: Frame[] = [{ seq: [], runner: start }];
  const seen = new Set([mazeKey(start)]);
  let qi = 0;
  const dirs: Direction[] = ["up", "down", "left", "right"];
  while (qi < q.length && qi < 200_000) {
    const f = q[qi++]!;
    if (done(f.runner)) return f.seq;
    if (f.seq.length >= maxDepth || f.runner.playerDied) continue;
    for (const d of dirs) {
      const next = cloneMsCc1SimulationRunner(f.runner);
      stepMsCc1Simulation(next, d);
      if (next.playerDied) continue;
      const k = mazeKey(next);
      if (seen.has(k)) continue;
      seen.add(k);
      q.push({ seq: [...f.seq, d], runner: next });
    }
  }
  return null;
}

const start = createMsCc1SimulationRunner(structuredClone(level));
apply(start, prefix);

console.log("\nBFS to thief...");
const toThief = bfsTo(start, 40, (r) => r.gx === 1 && r.gy === 1 && r.playerState.tools.length === 0);
if (!toThief) {
  console.error("cannot reach thief");
  process.exit(1);
}
console.log("toThief", encodeSolutionMoves(toThief).join(""), "len", toThief.length);

const afterThief = cloneMsCc1SimulationRunner(start);
apply(afterThief, toThief);
status("at thief", afterThief);

// One step to start slide — TWS did D and slid to (14,11)
console.log("\nTrying slide directions from thief:");
for (const d of ["down", "right", "left", "up"] as Direction[]) {
  const r = cloneMsCc1SimulationRunner(afterThief);
  stepMsCc1Simulation(r, d);
  status(`slide ${d}`, r);
}

// Full route: prefix + toThief + D (slide) + exit DRRUUUDDDDDDDD
const slideD: Action[] = ["down"];
const exitPath: Action[] = decodeSolutionMoves([
  ..."DRRUUUDDDDDDDD".split(""),
]) as Action[];

const full = [...prefix, ...toThief, ...slideD, ...exitPath];
const end = createMsCc1SimulationRunner(structuredClone(level));
apply(end, full);
status("FULL", end);

const rem = msSecondsRemaining(TIME_LIMIT, end.buttonPressCtx.moveBoundary);
const letters = encodeSolutionMoves(full);

// If rem > 89, burn ticks with out-and-back before exit
let final = full;
let finalEnd = end;
let finalRem = rem;

if (end.completed && !end.playerDied && rem > BOLD) {
  const needTicks = (TIME_LIMIT - BOLD) * 5 - end.buttonPressCtx.moveBoundary; // want >= 805
  // actually want ticks in [805,809], currently lower
  const target = (TIME_LIMIT - BOLD) * 5; // 805
  let deficit = target - end.buttonPressCtx.moveBoundary;
  console.log("above bold, deficit to 805", deficit);
  // Insert LR pairs before exit path (after slide landing)
  if (deficit > 0) {
    const burn: Action[] = [];
    // after slide at (14,11), do LR pairs on open floor
    while (burn.length < deficit) {
      burn.push("left", "right");
    }
    // trim to exact
    while (true) {
      const cand = [...prefix, ...toThief, ...slideD, ...burn, ...exitPath];
      const r = createMsCc1SimulationRunner(structuredClone(level));
      apply(r, cand);
      const tr = msSecondsRemaining(TIME_LIMIT, r.buttonPressCtx.moveBoundary);
      console.log("burn", burn.length, {
        ticks: r.buttonPressCtx.moveBoundary,
        rem: tr,
        done: r.completed,
        died: r.playerDied,
      });
      if (r.completed && !r.playerDied && tr === BOLD) {
        final = cand;
        finalEnd = r;
        finalRem = tr;
        break;
      }
      if (burn.length === 0) break;
      burn.pop();
    }
  }
}

if (finalEnd.completed && !finalEnd.playerDied && finalRem >= BOLD) {
  const outLetters = encodeSolutionMoves(final);
  writeFileSync(
    path.join(root, ".tmp/level015-bold-letters.json"),
    JSON.stringify(
      {
        letters: outLetters,
        rem: finalRem,
        ticks: finalEnd.buttonPressCtx.moveBoundary,
        exact: finalRem === BOLD,
        waits: outLetters.filter((c) => c === "W").length,
        chipMoves: outLetters.filter((c) => c !== "W").length,
      },
      null,
      2,
    ),
  );
  console.log("WROTE", {
    rem: finalRem,
    ticks: finalEnd.buttonPressCtx.moveBoundary,
    moves: outLetters.length,
  });
} else {
  console.error("not bold", { rem: finalRem, done: finalEnd.completed, died: finalEnd.playerDied });
}
