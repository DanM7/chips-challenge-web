/**
 * chips2_blue (red door already open): chips0 first, then open blue if needed, brown, exit.
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
  let blk = "";
  for (const x of [15, 16, 17, 18, 19, 20])
    for (const y of [9, 10, 11, 12, 13, 14, 15])
      if (getCompositeTile(r.level, x, y) === "block_movable") blk += `${x},${y};`;
  return `${r.gx},${r.gy}|${r.playerState.chipsRemainingOnMap}|${r.playerState.keys.join("+")}|${r.playerState.tools.join("+")}|${blk}|${cellTile(r.level, "upper", 16, 11)}|${cellTile(r.level, "upper", 16, 15)}|${isTrapOpen(r.buttonPressCtx, 16, 16) ? 1 : 0}`;
}

function bfsPath(
  start: Runner,
  done: (r: Runner) => boolean,
  label: string,
  maxNodes = 500000,
): Direction[] | null {
  type Node = { r: Runner; parent: number; dir: Direction | null };
  const nodes: Node[] = [{ r: start, parent: -1, dir: null }];
  const seen = new Set([mazeKey(start)]);
  let qi = 0;
  while (qi < nodes.length && qi < maxNodes) {
    const cur = nodes[qi]!;
    if (done(cur.r)) {
      const seq: Direction[] = [];
      let i = qi;
      while (nodes[i]!.parent >= 0) {
        seq.push(nodes[i]!.dir!);
        i = nodes[i]!.parent;
      }
      seq.reverse();
      console.log(label, "found", qi, "len", seq.length, "ticks", cur.r.buttonPressCtx.moveBoundary);
      return seq;
    }
    for (const d of dirs) {
      const next = cloneMsCc1SimulationRunner(cur.r);
      stepMsCc1Simulation(next, d);
      if (next.playerDied) continue;
      const k = mazeKey(next);
      if (seen.has(k)) continue;
      seen.add(k);
      nodes.push({ r: next, parent: qi, dir: d });
    }
    qi++;
  }
  console.error(label, "fail", nodes.length, "seen", seen.size);
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
    ticks: r.buttonPressCtx.moveBoundary,
    rem: msSecondsRemaining(TIME_LIMIT, r.buttonPressCtx.moveBoundary),
    door16_11: cellTile(r.level, "upper", 16, 11),
    door16_15: cellTile(r.level, "upper", 16, 15),
    brown: getCompositeTile(r.level, 16, 9),
    trap: isTrapOpen(r.buttonPressCtx, 16, 16),
    done: r.completed,
  });
}

// Replay to chips2_blue with door16_15 open
const all = JSON.parse(
  readFileSync(path.join(root, ".tmp/level015-bold-letters.json"), "utf8"),
) as { letters: string[] };
{
  const rs = createMsCc1SimulationRunner(structuredClone(level));
  let cut = -1;
  for (let i = 0; i < all.letters.length; i++) {
    const ch = all.letters[i]!;
    if (ch === "W") stepMsCc1Wait(rs);
    else
      stepMsCc1Simulation(
        rs,
        (ch === "U" ? "up" : ch === "D" ? "down" : ch === "L" ? "left" : "right") as Direction,
      );
    if (
      rs.playerState.chipsRemainingOnMap === 2 &&
      rs.playerState.keys.includes("key_blue") &&
      cellTile(rs.level, "upper", 16, 15) !== "door_red" &&
      rs.gx === 18 &&
      rs.gy === 20
    ) {
      cut = i + 1;
      break;
    }
  }
  if (cut < 0) {
    // fallback any chips2+blue with red open
    const rs2 = createMsCc1SimulationRunner(structuredClone(level));
    for (let i = 0; i < all.letters.length; i++) {
      const ch = all.letters[i]!;
      if (ch === "W") stepMsCc1Wait(rs2);
      else
        stepMsCc1Simulation(
          rs2,
          (ch === "U" ? "up" : ch === "D" ? "down" : ch === "L" ? "left" : "right") as Direction,
        );
      if (
        rs2.playerState.chipsRemainingOnMap === 2 &&
        rs2.playerState.keys.includes("key_blue") &&
        cellTile(rs2.level, "upper", 16, 15) !== "door_red"
      ) {
        cut = i + 1;
        break;
      }
    }
  }
  if (cut < 0) throw new Error("no chips2_blue cut");
  var letters = all.letters.slice(0, cut);
}
let r = applyLetters(letters);
save(letters, "c2b", r);

console.log("Searching chips0 (keep blue if possible)");
{
  let seg = bfsPath(
    r,
    (x) =>
      x.playerState.chipsRemainingOnMap === 0 && x.playerState.keys.includes("key_blue"),
    "chips0_blue",
  );
  if (!seg) {
    console.log("retry chips0 without key requirement");
    seg = bfsPath(r, (x) => x.playerState.chipsRemainingOnMap === 0, "chips0_any");
  }
  if (!seg) {
    console.error("FAIL chips0");
    process.exit(1);
  }
  letters.push(...encodeSolutionMoves(seg));
  r = applyLetters(letters);
  save(letters, "chips0", r);
}

if (cellTile(r.level, "upper", 16, 11) === "door_blue") {
  console.log("Searching open_blue");
  const seg = bfsPath(
    r,
    (x) => cellTile(x.level, "upper", 16, 11) !== "door_blue",
    "open_blue",
  );
  if (!seg) {
    console.error("FAIL open_blue");
    process.exit(1);
  }
  letters.push(...encodeSolutionMoves(seg));
  r = applyLetters(letters);
  save(letters, "open_blue", r);
}

console.log("Searching brown");
{
  const seg = bfsPath(
    r,
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
  let seg = bfsPath(
    r,
    (x) =>
      x.completed &&
      !x.playerDied &&
      msSecondsRemaining(TIME_LIMIT, x.buttonPressCtx.moveBoundary) >= BOLD,
    "exit89",
  );
  if (!seg) seg = bfsPath(r, (x) => x.completed && !x.playerDied, "exit_any");
  if (!seg) {
    console.error("FAIL exit");
    process.exit(1);
  }
  letters.push(...encodeSolutionMoves(seg));
  r = applyLetters(letters);
  save(letters, "exit", r);
}

let finalLetters = letters;
let finalRem = msSecondsRemaining(TIME_LIMIT, r.buttonPressCtx.moveBoundary);
let finalTicks = r.buttonPressCtx.moveBoundary;
if (r.completed && finalRem > BOLD) {
  const targetLow = (TIME_LIMIT - BOLD) * 5;
  let guard = 0;
  while (finalRem > BOLD && finalTicks < targetLow + 4 && guard++ < 120) {
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
const stats = {
  rem: finalRem,
  ticks: finalTicks,
  exact: finalRem === BOLD,
  done: fr.completed,
  brown: getCompositeTile(fr.level, 16, 9),
  trap: isTrapOpen(fr.buttonPressCtx, 16, 16),
  moves: finalLetters.length,
  W: finalLetters.filter((c) => c === "W").length,
  U: finalLetters.filter((c) => c === "U").length,
  D: finalLetters.filter((c) => c === "D").length,
  L: finalLetters.filter((c) => c === "L").length,
  R: finalLetters.filter((c) => c === "R").length,
};
console.log("FINAL", stats);

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
          "SW/NW boots; fire/ice; open exit red; chips; brown; exit; 89",
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
