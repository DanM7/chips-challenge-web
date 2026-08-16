/**
 * From blue_key save: fire+key, ice+key, then BFS chips/exit with block on brown.
 */
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { cellTile, getCompositeTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
  cloneMsCc1SimulationRunner,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { encodeSolutionMoves } from "../engine/solutionMoves.js";
import { isTrapOpen } from "../engine/msCc1/msCc1Traps.js";
import type { Direction, LevelData } from "../engine/types.js";

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

function applyLetters(letters: string[]): Runner {
  const r = createMsCc1SimulationRunner(structuredClone(level));
  for (const ch of letters) {
    if (ch === "W") stepMsCc1Wait(r);
    else
      stepMsCc1Simulation(
        r,
        (ch === "U" ? "up" : ch === "D" ? "down" : ch === "L" ? "left" : "right") as Direction,
      );
    if (r.playerDied || r.completed) break;
  }
  return r;
}

function status(label: string, r: Runner) {
  console.log(label, {
    pos: [r.gx, r.gy],
    chips: r.playerState.chipsRemainingOnMap,
    tools: [...r.playerState.tools],
    keys: [...r.playerState.keys],
    ticks: r.buttonPressCtx.moveBoundary,
    rem: msSecondsRemaining(TIME_LIMIT, r.buttonPressCtx.moveBoundary),
    brown: getCompositeTile(r.level, 16, 9),
    trap: isTrapOpen(r.buttonPressCtx, 16, 16),
    died: r.playerDied,
    death: r.deathMessage,
    done: r.completed,
  });
}

// Rebuild from SW chips6: the bold-letters file may be polluted; re-read swdeep progress
// by replaying the SW deep script's written file at chips6 - we need that exact letter list.
// Recover: letters length at chips6 was written; check backup from swdeep run.

// Reconstruct chips6 by running openings + searching - too slow.
// Instead read .tmp/level015-bold-letters from when label was chips6 - we overwrote it.
// Re-run minimal: SW+NW+known water path from swdeep output isn't stored as letters only final.

// Use git? The swdeep wrote after each goal. Last write before fire fail was chips6.
// We don't have it. Re-execute quick path to chips6 using BFS from openings.

function parse(s: string): string[] {
  return [...s];
}

const sw = parse("LLLLDDDLLLLLLULURRRRR");
const nw = parse("LLLDDRRRRRUUUUUULLLLLLDLDRRRRR");

function mazeKey(r: Runner): string {
  return [
    r.gx,
    r.gy,
    r.playerState.chipsRemainingOnMap,
    r.playerState.keys.join("+"),
    r.playerState.tools.join("+"),
    cellTile(r.level, "upper", 24, 12),
    cellTile(r.level, "upper", 24, 14),
    getCompositeTile(r.level, 18, 13),
    getCompositeTile(r.level, 16, 9),
    getCompositeTile(r.level, 26, 11),
    getCompositeTile(r.level, 26, 15),
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
      console.log("  found", n, "len", f.seq.length);
      return f.seq;
    }
    if (
      f.seq.length >= maxDepth ||
      f.runner.playerDied ||
      f.runner.buttonPressCtx.moveBoundary > MAX_TICKS
    )
      continue;
    for (const a of allowWait ? [...dirs, "wait" as const] : dirs) {
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
  console.error("  expanded", n);
  return null;
}

let letters = [...sw, ...nw];
let r = applyLetters(letters);
status("NW", r);

const earlyGoals: { label: string; depth: number; nodes: number; done: (x: Runner) => boolean }[] = [
  { label: "chips11", depth: 80, nodes: 400_000, done: (x) => x.playerState.chipsRemainingOnMap <= 11 },
  { label: "chips10", depth: 80, nodes: 400_000, done: (x) => x.playerState.chipsRemainingOnMap <= 10 },
  {
    label: "chips10_blue",
    depth: 40,
    nodes: 200_000,
    done: (x) =>
      x.playerState.chipsRemainingOnMap <= 10 && x.playerState.keys.includes("key_blue"),
  },
  { label: "chips9", depth: 100, nodes: 600_000, done: (x) => x.playerState.chipsRemainingOnMap <= 9 },
  { label: "chips8", depth: 80, nodes: 400_000, done: (x) => x.playerState.chipsRemainingOnMap <= 8 },
  { label: "chips7", depth: 80, nodes: 400_000, done: (x) => x.playerState.chipsRemainingOnMap <= 7 },
  { label: "chips6", depth: 100, nodes: 600_000, done: (x) => x.playerState.chipsRemainingOnMap <= 6 },
];

for (const g of earlyGoals) {
  console.log("Searching", g.label);
  const seg = bfs(r, g.depth, g.nodes, g.done);
  if (!seg) {
    console.error("FAIL", g.label);
    process.exit(1);
  }
  letters.push(...encodeSolutionMoves(seg));
  r = applyLetters(letters);
  status(g.label, r);
}

// blue key WITHOUT losing boots to force thief — stay away from (1,1)
console.log("Searching blue_key_safe");
{
  const seg = bfs(
    r,
    100,
    800_000,
    (x) =>
      x.playerState.keys.includes("key_blue") &&
      x.playerState.tools.includes("flippers") &&
      x.playerState.tools.includes("suction_boots"),
  );
  if (!seg) {
    console.error("FAIL blue_key_safe — try any blue");
    const any = bfs(r, 100, 800_000, (x) => x.playerState.keys.includes("key_blue"));
    if (!any) process.exit(1);
    letters.push(...encodeSolutionMoves(any));
  } else {
    letters.push(...encodeSolutionMoves(seg));
  }
  r = applyLetters(letters);
  status("blue_key", r);
}

// Manual fire if we have blue and preferably boots
if (r.playerState.keys.includes("key_blue")) {
  const fire = "UUURRRRRRDRDLLLLL";
  // Only works from (20,13). BFS to (20,13) first if needed.
  if (r.gx !== 20 || r.gy !== 13) {
    console.log("Searching pos_20_13");
    const seg = bfs(r, 60, 400_000, (x) => x.gx === 20 && x.gy === 13);
    if (seg) {
      letters.push(...encodeSolutionMoves(seg));
      r = applyLetters(letters);
    }
  }
  letters.push(...fire.split(""));
  r = applyLetters(letters);
  status("fire", r);
}

if (!r.playerState.tools.includes("fire_boots") || !r.playerState.keys.includes("key_red")) {
  console.error("no fire/red");
  writeFileSync(
    path.join(root, ".tmp/level015-bold-letters.json"),
    JSON.stringify({ letters, label: "fail-fire" }, null, 2),
  );
  process.exit(1);
}

// Ice skates: BFS
console.log("Searching ice_skates");
{
  const seg = bfs(
    r,
    100,
    800_000,
    (x) =>
      x.playerState.tools.includes("ice_skates") &&
      cellTile(x.level, "upper", 24, 14) !== "bomb",
  );
  if (!seg) {
    console.error("FAIL ice");
    // try manual from various positions
    process.exit(1);
  }
  letters.push(...encodeSolutionMoves(seg));
  r = applyLetters(letters);
  status("ice", r);
}

console.log("Searching chips3");
{
  const seg = bfs(r, 150, 1_000_000, (x) => x.playerState.chipsRemainingOnMap <= 3);
  if (!seg) {
    console.error("FAIL chips3");
    process.exit(1);
  }
  letters.push(...encodeSolutionMoves(seg));
  r = applyLetters(letters);
  status("chips3", r);
}

console.log("Searching chips0 via ice thief");
{
  const seg = bfs(
    r,
    200,
    1_500_000,
    (x) =>
      x.playerState.chipsRemainingOnMap <= 0 && !x.playerState.tools.includes("ice_skates"),
  );
  if (!seg) {
    console.error("FAIL chips0");
    process.exit(1);
  }
  letters.push(...encodeSolutionMoves(seg));
  r = applyLetters(letters);
  status("chips0", r);
}

console.log("Searching exit with block on brown");
{
  const seg = bfs(
    r,
    120,
    1_000_000,
    (x) =>
      x.completed &&
      getCompositeTile(x.level, 16, 9) === "block_movable" &&
      msSecondsRemaining(TIME_LIMIT, x.buttonPressCtx.moveBoundary) >= BOLD,
  );
  if (!seg) {
    // any exit >= 89
    const any = bfs(
      r,
      120,
      1_000_000,
      (x) =>
        x.completed &&
        msSecondsRemaining(TIME_LIMIT, x.buttonPressCtx.moveBoundary) >= BOLD,
      true,
    );
    if (!any) {
      console.error("FAIL exit");
      writeFileSync(
        path.join(root, ".tmp/level015-bold-letters.json"),
        JSON.stringify({ letters, label: "fail-exit" }, null, 2),
      );
      process.exit(1);
    }
    letters.push(...encodeSolutionMoves(any));
  } else {
    letters.push(...encodeSolutionMoves(seg));
  }
  r = applyLetters(letters);
  status("exit", r);
}

const rem = msSecondsRemaining(TIME_LIMIT, r.buttonPressCtx.moveBoundary);
console.log("FINAL", { rem, ticks: r.buttonPressCtx.moveBoundary, exact: rem === BOLD, moves: letters.length });
writeFileSync(
  path.join(root, ".tmp/level015-bold-letters.json"),
  JSON.stringify({ letters, rem, ticks: r.buttonPressCtx.moveBoundary, exact: rem === BOLD }, null, 2),
);

if (r.completed && !r.playerDied && rem >= BOLD) {
  const webPath = path.join(
    root,
    "../../apps/chips-challenge-web/public/games/chips-challenge-1/data/cc1-ms-solutions/level-015.json",
  );
  // If rem > 89, burn ticks with detours to hit exact — W doesn't burn. Insert LR pairs before last moves.
  let finalLetters = letters;
  let finalRem = rem;
  let finalTicks = r.buttonPressCtx.moveBoundary;
  if (rem > BOLD) {
    const targetMin = (TIME_LIMIT - BOLD) * 5;
    let extra = targetMin - finalTicks;
    console.log("need burn", extra);
    // find position before exit to insert burns - append before last 10 moves
    while (extra > 1) {
      const insertAt = finalLetters.length - 12;
      const cand = [
        ...finalLetters.slice(0, insertAt),
        "L",
        "R",
        ...finalLetters.slice(insertAt),
      ];
      const t = applyLetters(cand);
      if (!t.completed || t.playerDied) break;
      const tr = msSecondsRemaining(TIME_LIMIT, t.buttonPressCtx.moveBoundary);
      finalLetters = cand;
      finalRem = tr;
      finalTicks = t.buttonPressCtx.moveBoundary;
      extra = targetMin - finalTicks;
      console.log("burned LR", { rem: tr, ticks: finalTicks });
      if (tr === BOLD) break;
      if (tr < BOLD) {
        // undo last
        finalLetters = [
          ...finalLetters.slice(0, insertAt),
          ...finalLetters.slice(insertAt + 2),
        ];
        break;
      }
    }
  }
  const entry = {
    levelId: "level-015",
    passwordMs: "COZQ",
    title: "Elementary",
    timeLimitSeconds: 250,
    boldTimeRemaining: 89,
    minChipMoves: 161,
    moves: finalLetters,
    source: "https://scores.bitbusters.club/levels/cc1/15/ms",
    walkthroughUrl: "https://strategywiki.org/wiki/Chip%27s_Challenge/Levels_1-20",
    boldRouteHint:
      "Red key left → flippers+blue; blue → suction+red; swim right chips+blue; SW circle; force NE; SW chip; blue→fire+red; red→skates+blue; block L; fire W then E; ice E then S; thief slide; block L+socket; hold brown → 89",
    moveVerified: true,
    meetsBoldBudget: finalRem >= BOLD,
    moveSource: `StrategyWiki Elementary bold; engine-verified ${finalRem}s left (bold 89)`,
    simulatedTicks: finalTicks,
    simulatedSecondsRemaining: finalRem,
  };
  writeFileSync(webPath, `${JSON.stringify(entry, null, 2)}\n`);
  console.log("WROTE", webPath, finalRem);
}
