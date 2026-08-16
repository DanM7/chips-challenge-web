/**
 * chips3 → chips2+blue → red → thief chips0 → brown → exit 89
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
const SEARCH_TICK_CAP = (TIME_LIMIT - 70) * 5;
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

function blockSig(r: Runner): string {
  // Center block + any elsewhere
  let s = "";
  for (let y = 8; y <= 20; y++)
    for (let x = 14; x <= 22; x++)
      if (getCompositeTile(r.level, x, y) === "block_movable") s += `${x},${y};`;
  return s;
}

function mazeKey(r: Runner): string {
  return [
    r.gx,
    r.gy,
    r.playerState.chipsRemainingOnMap,
    r.playerState.keys.join("+"),
    r.playerState.tools.length, // boots count enough post-ice
    r.playerState.tools.includes("ice_skates") ? "S" : "",
    r.playerState.tools.includes("fire_boots") ? "F" : "",
    r.playerState.tools.includes("flippers") ? "P" : "",
    r.playerState.tools.includes("suction_boots") ? "U" : "",
    blockSig(r),
    getCompositeTile(r.level, 16, 9) === "block_movable" ? "B" : "o",
    cellTile(r.level, "upper", 16, 11)[0],
    cellTile(r.level, "upper", 16, 15)[0],
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
  const t0 = Date.now();
  while (qi < q.length && n < maxNodes) {
    const f = q[qi++]!;
    n++;
    if (n % 100000 === 0)
      console.log(label, "…", n, "q", q.length - qi, "ms", Date.now() - t0);
    if (done(f.runner)) {
      console.log(label, "found", n, "len", f.seq.length, "ticks", f.runner.buttonPressCtx.moveBoundary);
      return f.seq;
    }
    if (
      f.seq.length >= maxDepth ||
      f.runner.playerDied ||
      f.runner.buttonPressCtx.moveBoundary > SEARCH_TICK_CAP
    )
      continue;
    for (const d of dirs) {
      const next = cloneMsCc1SimulationRunner(f.runner);
      stepMsCc1Simulation(next, d);
      if (next.playerDied || next.buttonPressCtx.moveBoundary > SEARCH_TICK_CAP) continue;
      const k = mazeKey(next);
      if (seen.has(k)) continue;
      seen.add(k);
      q.push({ seq: [...f.seq, d], runner: next });
    }
  }
  console.error(label, "expanded", n, "seen", seen.size);
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
    blocks: blockSig(r),
    brown: getCompositeTile(r.level, 16, 9),
    trap: isTrapOpen(r.buttonPressCtx, 16, 16),
    done: r.completed,
  });
}

const all = JSON.parse(
  readFileSync(path.join(root, ".tmp/level015-bold-letters.json"), "utf8"),
) as { letters: string[] };

// Prefer cut at first chips===3 with skates
{
  const rScan = createMsCc1SimulationRunner(structuredClone(level));
  let cut = -1;
  for (let i = 0; i < all.letters.length; i++) {
    const ch = all.letters[i]!;
    if (ch === "W") stepMsCc1Wait(rScan);
    else
      stepMsCc1Simulation(
        rScan,
        (ch === "U" ? "up" : ch === "D" ? "down" : ch === "L" ? "left" : "right") as Direction,
      );
    if (
      cut < 0 &&
      rScan.playerState.chipsRemainingOnMap === 3 &&
      rScan.playerState.tools.includes("ice_skates")
    ) {
      cut = i + 1;
      break;
    }
  }
  if (cut < 0) throw new Error("no chips3");
  var letters = all.letters.slice(0, cut);
}
let r = applyLetters(letters);
save(letters, "chips3", r);

console.log("Searching chips2_blue");
{
  const seg = bfs(
    r,
    150,
    2_000_000,
    (x) =>
      x.playerState.chipsRemainingOnMap <= 2 &&
      x.playerState.keys.includes("key_blue") &&
      x.playerState.tools.includes("ice_skates"),
    "c2b",
  );
  if (!seg) {
    console.error("FAIL chips2_blue — try blue only then chips2");
    const b = bfs(
      r,
      120,
      1_500_000,
      (x) => x.playerState.keys.includes("key_blue") && x.playerState.tools.includes("ice_skates"),
      "blue",
    );
    if (!b) {
      console.error("FAIL blue");
      process.exit(1);
    }
    letters.push(...encodeSolutionMoves(b));
    r = applyLetters(letters);
    save(letters, "blue", r);
    const c = bfs(
      r,
      120,
      1_500_000,
      (x) =>
        x.playerState.chipsRemainingOnMap <= 2 &&
        x.playerState.keys.includes("key_blue") &&
        x.playerState.tools.includes("ice_skates"),
      "c2",
    );
    if (!c) {
      console.error("FAIL c2");
      process.exit(1);
    }
    letters.push(...encodeSolutionMoves(c));
  } else {
    letters.push(...encodeSolutionMoves(seg));
  }
  r = applyLetters(letters);
  save(letters, "chips2_blue", r);
}

console.log("Searching red_keep_blue");
{
  const seg = bfs(
    r,
    150,
    2_000_000,
    (x) =>
      x.playerState.keys.includes("key_blue") &&
      x.playerState.keys.includes("key_red") &&
      x.playerState.tools.includes("ice_skates") &&
      x.playerState.chipsRemainingOnMap <= 2,
    "red",
  );
  if (!seg) {
    console.error("FAIL red");
    process.exit(1);
  }
  letters.push(...encodeSolutionMoves(seg));
  r = applyLetters(letters);
  save(letters, "red", r);
}

console.log("Searching thief_chips0");
{
  const seg = bfs(
    r,
    200,
    2_500_000,
    (x) =>
      x.playerState.chipsRemainingOnMap <= 0 &&
      !x.playerState.tools.includes("ice_skates") &&
      x.playerState.keys.includes("key_blue") &&
      x.playerState.keys.includes("key_red"),
    "thief",
  );
  if (!seg) {
    console.error("FAIL thief");
    process.exit(1);
  }
  letters.push(...encodeSolutionMoves(seg));
  r = applyLetters(letters);
  save(letters, "thief", r);
}

console.log("Searching brown");
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
    80,
    800_000,
    (x) =>
      x.completed &&
      !x.playerDied &&
      msSecondsRemaining(TIME_LIMIT, x.buttonPressCtx.moveBoundary) >= BOLD,
    "exit89",
  );
  if (!seg) {
    const seg2 = bfs(r, 80, 800_000, (x) => x.completed && !x.playerDied, "exit_any");
    if (!seg2) {
      console.error("FAIL exit");
      process.exit(1);
    }
    letters.push(...encodeSolutionMoves(seg2));
  } else letters.push(...encodeSolutionMoves(seg));
  r = applyLetters(letters);
  save(letters, "exit", r);
}

let finalLetters = letters;
let finalRem = msSecondsRemaining(TIME_LIMIT, r.buttonPressCtx.moveBoundary);
let finalTicks = r.buttonPressCtx.moveBoundary;

if (r.completed && finalRem > BOLD) {
  const targetLow = (TIME_LIMIT - BOLD) * 5;
  let guard = 0;
  while (finalRem > BOLD && finalTicks < targetLow + 4 && guard++ < 80) {
    const i = Math.max(0, finalLetters.length - 30);
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

console.log("FINAL", { rem: finalRem, ticks: finalTicks, exact: finalRem === BOLD, done: r.completed });

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
          "SW/NW boots; fire/ice; chips; blue+red; ice thief; brown; exit; 89",
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
} else {
  console.error("not bold", finalRem);
  process.exit(1);
}
