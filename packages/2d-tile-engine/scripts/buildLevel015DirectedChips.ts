/**
 * Directed: chips at (13,27) then (16,19), keep keys; then brown; exit.
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

function mazeKey(r: Runner): string {
  const blk =
    getCompositeTile(r.level, 19, 14) === "block_movable"
      ? "19,14"
      : getCompositeTile(r.level, 18, 14) === "block_movable"
        ? "18,14"
        : getCompositeTile(r.level, 17, 14) === "block_movable"
          ? "17,14"
          : getCompositeTile(r.level, 16, 14) === "block_movable"
            ? "16,14"
            : getCompositeTile(r.level, 16, 9) === "block_movable"
              ? "16,9"
              : `?${[16, 17, 18, 19, 20].map((x) => [9, 10, 11, 12, 13, 14, 15].map((y) => (getCompositeTile(r.level, x, y) === "block_movable" ? `${x},${y}` : "")).join("")).join("")}`;
  return [
    r.gx,
    r.gy,
    r.playerState.chipsRemainingOnMap,
    r.playerState.keys.join("+"),
    r.playerState.tools.join(","),
    blk,
    cellTile(r.level, "upper", 16, 19) === "chip" ? "1" : "0",
    cellTile(r.level, "upper", 13, 27) === "chip" ? "1" : "0",
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
  tickCap = 950,
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
    if (n % 50000 === 0) console.log(label, "…", n, "ms", Date.now() - t0);
    if (done(f.runner)) {
      console.log(label, "found", n, "len", f.seq.length, "ticks", f.runner.buttonPressCtx.moveBoundary, "ms", Date.now() - t0);
      return f.seq;
    }
    if (f.seq.length >= maxDepth || f.runner.playerDied || f.runner.buttonPressCtx.moveBoundary > tickCap)
      continue;
    for (const d of dirs) {
      const next = cloneMsCc1SimulationRunner(f.runner);
      stepMsCc1Simulation(next, d);
      if (next.playerDied || next.buttonPressCtx.moveBoundary > tickCap) continue;
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
    keys: r.playerState.keys,
    tools: r.playerState.tools,
    ticks: r.buttonPressCtx.moveBoundary,
    rem: msSecondsRemaining(TIME_LIMIT, r.buttonPressCtx.moveBoundary),
    brown: getCompositeTile(r.level, 16, 9),
    trap: isTrapOpen(r.buttonPressCtx, 16, 16),
    chip1619: cellTile(r.level, "upper", 16, 19),
    chip1327: cellTile(r.level, "upper", 13, 27),
    done: r.completed,
  });
}

const saved = JSON.parse(
  readFileSync(path.join(root, ".tmp/level015-bold-letters.json"), "utf8"),
) as { letters: string[] };
let letters = saved.letters;
let r = applyLetters(letters);
save(letters, "start", r);

// Chip A: (13,27)
if (cellTile(r.level, "upper", 13, 27) === "chip") {
  console.log("Searching chip 13,27");
  const seg = bfs(
    r,
    120,
    800_000,
    (x) => cellTile(x.level, "upper", 13, 27) !== "chip" && x.playerState.keys.includes("key_blue") && x.playerState.keys.includes("key_red"),
    "c1327",
  );
  if (!seg) {
    console.error("FAIL c1327");
    process.exit(1);
  }
  letters.push(...encodeSolutionMoves(seg));
  r = applyLetters(letters);
  save(letters, "c1327", r);
}

// Chip B: (16,19)
if (cellTile(r.level, "upper", 16, 19) === "chip") {
  console.log("Searching chip 16,19");
  const seg = bfs(
    r,
    120,
    800_000,
    (x) => cellTile(x.level, "upper", 16, 19) !== "chip" && x.playerState.keys.includes("key_blue") && x.playerState.keys.includes("key_red"),
    "c1619",
  );
  if (!seg) {
    // try without requiring both keys — maybe need to use a door
    const seg2 = bfs(
      r,
      120,
      800_000,
      (x) => cellTile(x.level, "upper", 16, 19) !== "chip" && x.playerState.keys.includes("key_red"),
      "c1619-red",
    );
    if (!seg2) {
      console.error("FAIL c1619");
      process.exit(1);
    }
    letters.push(...encodeSolutionMoves(seg2));
  } else letters.push(...encodeSolutionMoves(seg));
  r = applyLetters(letters);
  save(letters, "c1619", r);
}

if (r.playerState.chipsRemainingOnMap > 0) {
  console.error("still chips", r.playerState.chipsRemainingOnMap);
  process.exit(1);
}

// Ensure we have keys needed for brown+exit; pick up again if needed — keys on map?
console.log("keys now", r.playerState.keys);

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
    60,
    500_000,
    (x) => x.completed && !x.playerDied && msSecondsRemaining(TIME_LIMIT, x.buttonPressCtx.moveBoundary) >= BOLD,
    "exit89",
  );
  if (!seg) {
    const seg2 = bfs(r, 60, 500_000, (x) => x.completed && !x.playerDied, "exit_any");
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

const fr = applyLetters(finalLetters);
console.log("FINAL", {
  rem: finalRem,
  ticks: finalTicks,
  exact: finalRem === BOLD,
  done: fr.completed,
  brown: getCompositeTile(fr.level, 16, 9),
  trap: isTrapOpen(fr.buttonPressCtx, 16, 16),
});

if (fr.completed && finalRem >= BOLD) {
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
          "SW/NW boots; fire/ice; chips; blue+red; last chips; brown; exit; 89",
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
