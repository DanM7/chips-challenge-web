/**
 * Level 15 bold: insert early block→brown at TWS center pass (chips=6),
 * then force-thief slide + short exit (trap already held).
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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

const TIME_LIMIT = 250;
const BOLD = 89;
type Runner = ReturnType<typeof createMsCc1SimulationRunner>;

function apply(r: Runner, seq: Direction[]) {
  for (const d of seq) {
    stepMsCc1Simulation(r, d);
    if (r.completed || r.playerDied) break;
  }
}

function status(label: string, r: Runner) {
  console.log(label, {
    pos: { x: r.gx, y: r.gy },
    ticks: r.buttonPressCtx.moveBoundary,
    rem: msSecondsRemaining(TIME_LIMIT, r.buttonPressCtx.moveBoundary),
    chips: r.playerState.chipsRemainingOnMap,
    keys: [...r.playerState.keys],
    block18: getCompositeTile(r.level, 18, 13),
    block17: getCompositeTile(r.level, 17, 13),
    brown: getCompositeTile(r.level, 16, 9),
    blueDoor: cellTile(r.level, "upper", 16, 11),
    trap: isTrapOpen(r.buttonPressCtx, 16, 16),
    died: r.playerDied,
    death: r.deathMessage,
    done: r.completed,
  });
}

const tws = decodeSolutionMoves(readLevelSolution<{ moves: string[] }>(15)!.moves) as Direction[];

// Insert after move index 445 (1-based) → slice(0,445), at (19,13)
const insertAt = 445;
const before = tws.slice(0, insertAt);
const r0 = createMsCc1SimulationRunner(structuredClone(level));
apply(r0, before);
status("insert point", r0);

// Try several block-to-brown sequences from (19,13)
const pushVariants: Direction[][] = [
  // push LL, go around, open blue, push UUUU onto brown
  decodeSolutionMoves([..."LLDLUUUU".split("")]) as Direction[],
  decodeSolutionMoves([..."LLDLLUUUU".split("")]) as Direction[],
  decodeSolutionMoves([..."L L D L U U U U".split(" ")]) as Direction[],
  // open blue first then push
  decodeSolutionMoves([..."LLLUULDLUUUU".split("")]) as Direction[],
  decodeSolutionMoves([..."ULLLLDDRRRULLLLUUUU".split("")]) as Direction[],
  // from (19,13): L push, get below, etc
  decodeSolutionMoves([..."LDLUULDLUUUU".split("")]) as Direction[],
  decodeSolutionMoves([..."LURDLDLUUUU".split("")]) as Direction[],
  decodeSolutionMoves([..."LLURDDLUUUU".split("")]) as Direction[],
];

let bestPush: Direction[] | null = null;
for (const push of pushVariants) {
  const r = cloneMsCc1SimulationRunner(r0);
  apply(r, push);
  const ok =
    !r.playerDied &&
    getCompositeTile(r.level, 16, 9) === "block_movable" &&
    isTrapOpen(r.buttonPressCtx, 16, 16);
  console.log(encodeSolutionMoves(push).join(""), {
    ok,
    pos: { x: r.gx, y: r.gy },
    brown: getCompositeTile(r.level, 16, 9),
    trap: isTrapOpen(r.buttonPressCtx, 16, 16),
    blueDoor: cellTile(r.level, "upper", 16, 11),
    keys: r.playerState.keys,
    died: r.playerDied,
    death: r.deathMessage,
    ticks: r.buttonPressCtx.moveBoundary,
  });
  if (ok && !bestPush) bestPush = push;
}

if (!bestPush) {
  // BFS push to brown
  console.log("BFS block to brown...");
  const dirs: Direction[] = ["up", "down", "left", "right"];
  type Frame = { seq: Direction[]; runner: Runner };
  const q: Frame[] = [{ seq: [], runner: r0 }];
  const seen = new Set<string>();
  const key = (x: Runner) =>
    `${x.gx},${x.gy}|${getCompositeTile(x.level, 18, 13)}|${getCompositeTile(x.level, 17, 13)}|${getCompositeTile(x.level, 16, 13)}|${getCompositeTile(x.level, 16, 12)}|${getCompositeTile(x.level, 16, 11)}|${getCompositeTile(x.level, 16, 10)}|${getCompositeTile(x.level, 16, 9)}|${x.playerState.keys.join("+")}|${cellTile(x.level, "upper", 16, 11)}`;
  seen.add(key(r0));
  let qi = 0;
  let found: Direction[] | null = null;
  while (qi < q.length && qi < 500_000) {
    const f = q[qi++]!;
    if (
      getCompositeTile(f.runner.level, 16, 9) === "block_movable" &&
      isTrapOpen(f.runner.buttonPressCtx, 16, 16)
    ) {
      found = f.seq;
      break;
    }
    if (f.seq.length >= 30 || f.runner.playerDied) continue;
    for (const d of dirs) {
      const next = cloneMsCc1SimulationRunner(f.runner);
      stepMsCc1Simulation(next, d);
      if (next.playerDied) continue;
      const k = key(next);
      if (seen.has(k)) continue;
      seen.add(k);
      q.push({ seq: [...f.seq, d], runner: next });
    }
  }
  if (!found) {
    console.error("cannot place block on brown");
    process.exit(1);
  }
  bestPush = found;
  console.log("BFS push", encodeSolutionMoves(found).join(""), "len", found.length);
}

const afterPush = cloneMsCc1SimulationRunner(r0);
apply(afterPush, bestPush!);
status("after push", afterPush);

// Continue TWS from insertAt to post-slide (793), but skip TWS end block manipulation
// TWS 445..793 should be fine. Then short exit.
const mid = tws.slice(insertAt, 793);
const afterSlide = cloneMsCc1SimulationRunner(afterPush);
apply(afterSlide, mid);
status("after TWS mid+slide", afterSlide);

// Short exits with trap already open
const exits = [
  "DRRUDDDDDDD", // door+socket+down to exit (7D from socket?)
  "DRRUUDDDDDDD",
  "DRRUUUDDDDDDD",
  "DRRUDDDDDDDD",
  "RRUDDDDDDD", // if can go RR
  "DRRRDDDDDDD",
  "DDRRUDDDDDDD",
];

for (const s of exits) {
  const r = cloneMsCc1SimulationRunner(afterSlide);
  const seq = decodeSolutionMoves([...s]) as Direction[];
  apply(r, seq);
  const rem = msSecondsRemaining(TIME_LIMIT, r.buttonPressCtx.moveBoundary);
  console.log("exit", s, {
    done: r.completed,
    died: r.playerDied,
    death: r.deathMessage,
    rem,
    ticks: r.buttonPressCtx.moveBoundary,
    pos: { x: r.gx, y: r.gy },
  });
  if (r.completed && !r.playerDied && rem >= BOLD) {
    const full = [...before, ...bestPush!, ...mid, ...seq];
    const letters = encodeSolutionMoves(full);
    // verify full replay
    const v = createMsCc1SimulationRunner(structuredClone(level));
    apply(v, full);
    const vrem = msSecondsRemaining(TIME_LIMIT, v.buttonPressCtx.moveBoundary);
    console.log("VERIFY", {
      rem: vrem,
      ticks: v.buttonPressCtx.moveBoundary,
      done: v.completed,
      died: v.playerDied,
      exact: vrem === BOLD,
    });
    writeFileSync(
      path.join(root, ".tmp/level015-bold-letters.json"),
      JSON.stringify(
        {
          letters,
          rem: vrem,
          ticks: v.buttonPressCtx.moveBoundary,
          exact: vrem === BOLD,
          insertAt,
          push: encodeSolutionMoves(bestPush!),
          exit: s,
        },
        null,
        2,
      ),
    );
    if (vrem === BOLD || vrem >= BOLD) {
      console.log("WROTE bold route");
      break;
    }
  }
}
