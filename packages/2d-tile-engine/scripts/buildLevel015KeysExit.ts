/**
 * From chips1: get blue+red keys, then ice thief chips0, slide, block brown, exit 89.
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
const webPath = path.join(
  root,
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/data/cc1-ms-solutions/level-015.json",
);
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

function listBlocks(r: Runner): string[] {
  const out: string[] = [];
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++)
      if (getCompositeTile(r.level, x, y) === "block_movable") out.push(`${x},${y}`);
  return out;
}

function mazeKey(r: Runner): string {
  return [
    r.gx,
    r.gy,
    r.playerState.chipsRemainingOnMap,
    r.playerState.keys.join("+"),
    r.playerState.tools.join("+"),
    listBlocks(r).join(";"),
    getCompositeTile(r.level, 16, 9),
    cellTile(r.level, "upper", 16, 11),
    cellTile(r.level, "upper", 18, 11),
    cellTile(r.level, "upper", 16, 15),
    cellTile(r.level, "upper", 18, 15),
    isTrapOpen(r.buttonPressCtx, 16, 16) ? "1" : "0",
  ].join("|");
}

function bfs(
  start: Runner,
  maxDepth: number,
  maxNodes: number,
  done: (r: Runner) => boolean,
  label: string,
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
      console.log(label, "found", n, "len", f.seq.length);
      return f.seq;
    }
    if (
      f.seq.length >= maxDepth ||
      f.runner.playerDied ||
      f.runner.buttonPressCtx.moveBoundary > MAX_TICKS + 30
    )
      continue;
    for (const d of dirs) {
      const next = cloneMsCc1SimulationRunner(f.runner);
      stepMsCc1Simulation(next, d);
      if (next.playerDied || next.buttonPressCtx.moveBoundary > MAX_TICKS + 30) continue;
      const k = mazeKey(next);
      if (seen.has(k)) continue;
      seen.add(k);
      q.push({ seq: [...f.seq, d], runner: next });
    }
  }
  console.error(label, "expanded", n);
  return null;
}

function save(letters: string[], label: string, r: Runner) {
  writeFileSync(
    path.join(root, ".tmp/level015-bold-letters.json"),
    JSON.stringify(
      {
        letters,
        label,
        rem: msSecondsRemaining(TIME_LIMIT, r.buttonPressCtx.moveBoundary),
        ticks: r.buttonPressCtx.moveBoundary,
      },
      null,
      2,
    ),
  );
  console.log(label, {
    pos: [r.gx, r.gy],
    chips: r.playerState.chipsRemainingOnMap,
    tools: r.playerState.tools,
    keys: r.playerState.keys,
    ticks: r.buttonPressCtx.moveBoundary,
    rem: msSecondsRemaining(TIME_LIMIT, r.buttonPressCtx.moveBoundary),
    blocks: listBlocks(r),
    brown: getCompositeTile(r.level, 16, 9),
    trap: isTrapOpen(r.buttonPressCtx, 16, 16),
    done: r.completed,
  });
}

// Rebuild to chips1 by replaying progress file but truncating at chips1 label if present.
// Progress file is currently chips0 — rebuild chips1 from ice via same incremental targets.
const iceLetters = (() => {
  const all = JSON.parse(
    readFileSync(path.join(root, ".tmp/level015-bold-letters.json"), "utf8"),
  ) as { letters: string[]; label: string };
  // Find ice endpoint: first time all 4 boots + blue key + bombs clear
  const r0 = createMsCc1SimulationRunner(structuredClone(level));
  let cut = -1;
  for (let i = 0; i < all.letters.length; i++) {
    const ch = all.letters[i]!;
    if (ch === "W") stepMsCc1Wait(r0);
    else
      stepMsCc1Simulation(
        r0,
        (ch === "U" ? "up" : ch === "D" ? "down" : ch === "L" ? "left" : "right") as Direction,
      );
    if (
      r0.playerState.tools.includes("ice_skates") &&
      r0.playerState.tools.includes("fire_boots") &&
      r0.playerState.keys.includes("key_blue") &&
      cellTile(r0.level, "upper", 24, 14) !== "bomb" &&
      r0.playerState.chipsRemainingOnMap === 6
    ) {
      cut = i + 1;
      break;
    }
  }
  if (cut < 0) throw new Error("ice cut not found");
  return all.letters.slice(0, cut);
})();

let letters = iceLetters;
let r = applyLetters(letters);
save(letters, "ice-cut", r);

for (const target of [5, 4, 3, 2, 1] as const) {
  if (r.playerState.chipsRemainingOnMap <= target) continue;
  console.log("Searching chips", target);
  const seg = bfs(
    r,
    target >= 3 ? 120 : 180,
    2_000_000,
    (x) => x.playerState.chipsRemainingOnMap <= target,
    "chips" + target,
  );
  if (!seg) {
    console.error("FAIL chips", target);
    process.exit(1);
  }
  letters.push(...encodeSolutionMoves(seg));
  r = applyLetters(letters);
  save(letters, "chips" + target, r);
}

// Now at chips1 with boots — get exit keys BEFORE thief
console.log("Searching keys_for_exit");
{
  const seg = bfs(
    r,
    150,
    2_000_000,
    (x) =>
      x.playerState.chipsRemainingOnMap <= 1 &&
      x.playerState.keys.includes("key_blue") &&
      x.playerState.keys.includes("key_red") &&
      x.playerState.tools.includes("ice_skates"),
    "keys",
  );
  if (!seg) {
    console.error("FAIL keys — try blue only");
    const seg2 = bfs(
      r,
      150,
      2_000_000,
      (x) =>
        x.playerState.chipsRemainingOnMap <= 1 &&
        x.playerState.keys.includes("key_blue") &&
        x.playerState.tools.includes("ice_skates"),
      "blue_only",
    );
    if (!seg2) {
      console.error("FAIL blue_only");
      process.exit(1);
    }
    letters.push(...encodeSolutionMoves(seg2));
  } else {
    letters.push(...encodeSolutionMoves(seg));
  }
  r = applyLetters(letters);
  save(letters, "keys", r);
}

console.log("Searching chips0_thief_with_keys");
{
  const seg = bfs(
    r,
    120,
    1_500_000,
    (x) =>
      x.playerState.chipsRemainingOnMap <= 0 &&
      !x.playerState.tools.includes("ice_skates") &&
      x.playerState.keys.includes("key_blue"),
    "chips0",
  );
  if (!seg) {
    console.error("FAIL chips0");
    process.exit(1);
  }
  letters.push(...encodeSolutionMoves(seg));
  r = applyLetters(letters);
  save(letters, "chips0", r);
}

// Slide is just R from thief typically
console.log("Searching block_brown");
{
  const seg = bfs(
    r,
    100,
    1_000_000,
    (x) => getCompositeTile(x.level, 16, 9) === "block_movable",
    "brown",
  );
  if (!seg) {
    console.error("FAIL brown");
    process.exit(1);
  }
  letters.push(...encodeSolutionMoves(seg));
  r = applyLetters(letters);
  save(letters, "brown", r);
}

console.log("Searching exit");
{
  const seg = bfs(
    r,
    60,
    500_000,
    (x) =>
      x.completed &&
      !x.playerDied &&
      msSecondsRemaining(TIME_LIMIT, x.buttonPressCtx.moveBoundary) >= BOLD,
    "exit",
  );
  if (!seg) {
    console.error("FAIL exit");
    process.exit(1);
  }
  letters.push(...encodeSolutionMoves(seg));
  r = applyLetters(letters);
  save(letters, "exit", r);
}

let rem = msSecondsRemaining(TIME_LIMIT, r.buttonPressCtx.moveBoundary);
let finalLetters = letters;
let finalRem = rem;
let finalTicks = r.buttonPressCtx.moveBoundary;

if (rem > BOLD) {
  const targetLow = (TIME_LIMIT - BOLD) * 5;
  let guard = 0;
  while (finalRem > BOLD && finalTicks < targetLow + 4 && guard++ < 50) {
    const i = Math.max(0, finalLetters.length - 25);
    const cand = [...finalLetters.slice(0, i), "L", "R", ...finalLetters.slice(i)];
    const t = applyLetters(cand);
    if (!t.completed || t.playerDied) break;
    const tr = msSecondsRemaining(TIME_LIMIT, t.buttonPressCtx.moveBoundary);
    if (tr < BOLD) break;
    finalLetters = cand;
    finalRem = tr;
    finalTicks = t.buttonPressCtx.moveBoundary;
    if (finalRem === BOLD) break;
  }
}

console.log("FINAL", { rem: finalRem, ticks: finalTicks, exact: finalRem === BOLD });

if (r.completed && finalRem >= BOLD) {
  writeFileSync(
    webPath,
    `${JSON.stringify(
      {
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
          "Red key left → flippers+blue; blue → suction+red; water+force; blue→fire+red; red→skates+blue; chips; keys; ice thief; brown→exit; 89",
        moveVerified: true,
        meetsBoldBudget: finalRem >= BOLD,
        moveSource: `StrategyWiki Elementary bold; engine-verified ${finalRem}s left (bold 89)`,
        simulatedTicks: finalTicks,
        simulatedSecondsRemaining: finalRem,
      },
      null,
      2,
    )}\n`,
  );
  console.log("WROTE", finalRem, "moves", finalLetters.length, "exact", finalRem === BOLD);
}
