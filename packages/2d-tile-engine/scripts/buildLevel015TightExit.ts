/**
 * Level 15: optimize exit — push block earlier + tighten suffix.
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
type Runner = ReturnType<typeof createMsCc1SimulationRunner>;
type Action = Direction | "wait";
const dirs: Direction[] = ["up", "down", "left", "right"];

function apply(start: Runner, seq: Action[]): Runner {
  const r = cloneMsCc1SimulationRunner(start);
  for (const a of seq) {
    if (a === "wait") stepMsCc1Wait(r);
    else stepMsCc1Simulation(r, a);
    if (r.completed || r.playerDied) break;
  }
  return r;
}

function mazeKey(r: Runner): string {
  return [
    r.gx,
    r.gy,
    r.playerState.keys.join("+"),
    r.playerState.tools.join("+"),
    r.playerState.chipsRemainingOnMap,
    getCompositeTile(r.level, 18, 13),
    getCompositeTile(r.level, 17, 13),
    getCompositeTile(r.level, 16, 13),
    getCompositeTile(r.level, 16, 12),
    getCompositeTile(r.level, 16, 11),
    getCompositeTile(r.level, 16, 10),
    getCompositeTile(r.level, 16, 9),
    cellTile(r.level, "upper", 16, 11),
    cellTile(r.level, "upper", 16, 15),
    [...r.buttonPressCtx.openTraps].sort().join(","),
    [...r.buttonPressCtx.heldBrownButtons].sort().join(","),
  ].join("|");
}

function segmentBfs(
  start: Runner,
  maxDepth: number,
  maxNodes: number,
  maxTicks: number,
  done: (r: Runner) => boolean,
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
      console.log("found nodes", n, "len", f.seq.length, "ticks", f.runner.buttonPressCtx.moveBoundary);
      return f.seq;
    }
    if (
      f.seq.length >= maxDepth ||
      f.runner.playerDied ||
      f.runner.buttonPressCtx.moveBoundary > maxTicks
    ) {
      continue;
    }
    for (const a of dirs) {
      const next = cloneMsCc1SimulationRunner(f.runner);
      stepMsCc1Simulation(next, a);
      if (next.playerDied || next.buttonPressCtx.moveBoundary > maxTicks) continue;
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

function atChips0(): { runner: Runner; prefix: Direction[] } {
  const runner = createMsCc1SimulationRunner(structuredClone(level));
  const prefix: Direction[] = [];
  for (const d of tws) {
    stepMsCc1Simulation(runner, d);
    prefix.push(d);
    if (runner.playerState.chipsRemainingOnMap === 0) break;
  }
  return { runner, prefix };
}

const { runner: start, prefix } = atChips0();
console.log("chips0", {
  pos: { x: start.gx, y: start.gy },
  ticks: start.buttonPressCtx.moveBoundary,
  rem: msSecondsRemaining(TIME_LIMIT, start.buttonPressCtx.moveBoundary),
});

const MAX_TICKS = (TIME_LIMIT - BOLD) * 5 + 4; // 809

// Path A: walk with boots (no thief) to exit
console.log("\nA: exit walking with boots...");
const walkExit = segmentBfs(
  start,
  100,
  1_000_000,
  MAX_TICKS,
  (r) =>
    r.completed &&
    msSecondsRemaining(TIME_LIMIT, r.buttonPressCtx.moveBoundary) >= BOLD,
);
if (walkExit) {
  const end = apply(start, walkExit);
  console.log("WALK OK", {
    rem: msSecondsRemaining(TIME_LIMIT, end.buttonPressCtx.moveBoundary),
    ticks: end.buttonPressCtx.moveBoundary,
    len: walkExit.length,
  });
  const letters = encodeSolutionMoves([...prefix, ...walkExit]);
  writeFileSync(
    path.join(root, ".tmp/level015-bold-letters.json"),
    JSON.stringify(
      {
        letters,
        rem: msSecondsRemaining(TIME_LIMIT, end.buttonPressCtx.moveBoundary),
        ticks: end.buttonPressCtx.moveBoundary,
        mode: "walk",
      },
      null,
      2,
    ),
  );
} else {
  console.log("WALK fail");
}

// Path B: follow TWS to thief slide landing (14,11), then BFS tight exit
console.log("\nB: TWS to post-slide, then tight exit...");
const postSlideIdx = 793; // after move 793 at (14,11)
const toSlide = tws.slice(0, postSlideIdx);
const afterSlide = apply(createMsCc1SimulationRunner(structuredClone(level)), toSlide);
console.log("after slide", {
  pos: { x: afterSlide.gx, y: afterSlide.gy },
  ticks: afterSlide.buttonPressCtx.moveBoundary,
  rem: msSecondsRemaining(TIME_LIMIT, afterSlide.buttonPressCtx.moveBoundary),
  keys: afterSlide.playerState.keys,
  tools: afterSlide.playerState.tools,
});

const tight = segmentBfs(
  afterSlide,
  40,
  500_000,
  MAX_TICKS,
  (r) =>
    r.completed &&
    msSecondsRemaining(TIME_LIMIT, r.buttonPressCtx.moveBoundary) >= BOLD,
);
if (tight) {
  const end = apply(afterSlide, tight);
  console.log("SLIDE+TIGHT OK", {
    rem: msSecondsRemaining(TIME_LIMIT, end.buttonPressCtx.moveBoundary),
    ticks: end.buttonPressCtx.moveBoundary,
    len: tight.length,
  });
  const letters = encodeSolutionMoves([...toSlide, ...tight]);
  writeFileSync(
    path.join(root, ".tmp/level015-bold-letters.json"),
    JSON.stringify(
      {
        letters,
        rem: msSecondsRemaining(TIME_LIMIT, end.buttonPressCtx.moveBoundary),
        ticks: end.buttonPressCtx.moveBoundary,
        mode: "slide+tight",
      },
      null,
      2,
    ),
  );
} else {
  console.log("SLIDE+TIGHT fail — try any exit");
  const any = segmentBfs(afterSlide, 40, 500_000, 900, (r) => r.completed);
  if (any) {
    const end = apply(afterSlide, any);
    console.log("any", {
      rem: msSecondsRemaining(TIME_LIMIT, end.buttonPressCtx.moveBoundary),
      ticks: end.buttonPressCtx.moveBoundary,
      len: any.length,
      moves: encodeSolutionMoves(any).join(""),
    });
  }
}
