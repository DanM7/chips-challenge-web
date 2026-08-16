/**
 * From TWS ice entry (chips=3), force ice-thief route then exit for bold.
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

function apply(r: Runner, seq: Action[]) {
  for (const a of seq) {
    if (a === "wait") stepMsCc1Wait(r);
    else stepMsCc1Simulation(r, a);
    if (r.completed || r.playerDied) break;
  }
}

function mazeKey(r: Runner): string {
  return [
    r.gx,
    r.gy,
    r.playerState.chipsRemainingOnMap,
    r.playerState.keys.join("+"),
    r.playerState.tools.join("+"),
    getCompositeTile(r.level, 18, 13),
    getCompositeTile(r.level, 17, 13),
    getCompositeTile(r.level, 16, 9),
  ].join("|");
}

function bfs(
  start: Runner,
  maxDepth: number,
  maxNodes: number,
  done: (r: Runner) => boolean,
  allowWait = false,
): Action[] | null {
  type Frame = { seq: Action[]; runner: Runner };
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
    )
      continue;
    const actions: Action[] = allowWait ? [...dirs, "wait"] : dirs;
    for (const a of actions) {
      const next = cloneMsCc1SimulationRunner(f.runner);
      if (a === "wait") stepMsCc1Wait(next);
      else stepMsCc1Simulation(next, a);
      if (next.playerDied || next.buttonPressCtx.moveBoundary > MAX_TICKS) continue;
      const k = mazeKey(next);
      if (seen.has(k)) continue;
      seen.add(k);
      q.push({ seq: [...f.seq, a], runner: next });
    }
  }
  console.error("expanded", n);
  return null;
}

const tws = decodeSolutionMoves(readLevelSolution<{ moves: string[] }>(15)!.moves) as Direction[];

// Find ice entry: chips==3 first time
let iceIdx = -1;
{
  const r = createMsCc1SimulationRunner(structuredClone(level));
  for (let i = 0; i < tws.length; i++) {
    stepMsCc1Simulation(r, tws[i]!);
    if (r.playerState.chipsRemainingOnMap === 3 && r.gx >= 16 && r.gy >= 18) {
      iceIdx = i + 1;
      console.log("ice entry", {
        i: iceIdx,
        pos: { x: r.gx, y: r.gy },
        ticks: r.buttonPressCtx.moveBoundary,
        tools: r.playerState.tools,
        keys: r.playerState.keys,
      });
      break;
    }
  }
}

const prefix = tws.slice(0, iceIdx) as Action[];
let r = createMsCc1SimulationRunner(structuredClone(level));
apply(r, prefix);

console.log("Searching ice chips + thief...");
const iceSeg = bfs(
  r,
  250,
  1_500_000,
  (x) =>
    x.playerState.chipsRemainingOnMap <= 0 &&
    !x.playerState.tools.includes("ice_skates") &&
    // prefer still having other boots or not — thief takes all
    true,
);
if (!iceSeg) {
  console.error("FAIL ice");
  process.exit(1);
}
apply(r, iceSeg);
console.log("after ice+thief", {
  pos: { x: r.gx, y: r.gy },
  ticks: r.buttonPressCtx.moveBoundary,
  rem: msSecondsRemaining(TIME_LIMIT, r.buttonPressCtx.moveBoundary),
  tools: r.playerState.tools,
  keys: r.playerState.keys,
  chips: r.playerState.chipsRemainingOnMap,
});

// Still need force chips? chips should be 0 if ice had last 3.
// TWS had chips3 at ice start meaning 3 ice chips left - so chips0 after ice.
console.log("Searching exit...");
const exitSeg = bfs(
  r,
  100,
  800_000,
  (x) =>
    x.completed &&
    msSecondsRemaining(TIME_LIMIT, x.buttonPressCtx.moveBoundary) >= BOLD,
  true,
);
if (!exitSeg) {
  const any = bfs(r, 100, 800_000, (x) => x.completed, true);
  if (any) {
    const end = cloneMsCc1SimulationRunner(r);
    apply(end, any);
    console.log("any exit", {
      rem: msSecondsRemaining(TIME_LIMIT, end.buttonPressCtx.moveBoundary),
      ticks: end.buttonPressCtx.moveBoundary,
    });
  }
  console.error("FAIL exit");
  process.exit(1);
}

const full = [...prefix, ...iceSeg, ...exitSeg];
const end = createMsCc1SimulationRunner(structuredClone(level));
apply(end, full);
const rem = msSecondsRemaining(TIME_LIMIT, end.buttonPressCtx.moveBoundary);
const letters = encodeSolutionMoves(full);
console.log("SUCCESS", {
  rem,
  ticks: end.buttonPressCtx.moveBoundary,
  exact: rem === BOLD,
  moves: letters.length,
});
writeFileSync(
  path.join(root, ".tmp/level015-bold-letters.json"),
  JSON.stringify({ letters, rem, ticks: end.buttonPressCtx.moveBoundary, exact: rem === BOLD }, null, 2),
);
