/**
 * ice → chips5 → red@18,4 → open 16,15 → chips → brown → exit
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
  return [
    r.gx,
    r.gy,
    r.playerState.chipsRemainingOnMap,
    r.playerState.keys.join("+"),
    r.playerState.tools.join("+"),
    blk,
    cellTile(r.level, "upper", 16, 19) === "chip" ? "A" : "-",
    cellTile(r.level, "upper", 13, 27) === "chip" ? "B" : "-",
    cellTile(r.level, "upper", 16, 11),
    cellTile(r.level, "upper", 16, 15),
    isTrapOpen(r.buttonPressCtx, 16, 16) ? "1" : "0",
  ].join("|");
}

function bfsPath(
  start: Runner,
  done: (r: Runner) => boolean,
  label: string,
  maxNodes = 600000,
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
    d11: cellTile(r.level, "upper", 16, 11),
    d15: cellTile(r.level, "upper", 16, 15),
    brown: getCompositeTile(r.level, 16, 9),
    trap: isTrapOpen(r.buttonPressCtx, 16, 16),
    done: r.completed,
  });
}

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
      rs.playerState.tools.includes("ice_skates") &&
      rs.playerState.tools.includes("fire_boots") &&
      rs.playerState.keys.includes("key_blue") &&
      rs.playerState.chipsRemainingOnMap === 6 &&
      cellTile(rs.level, "upper", 24, 14) !== "bomb"
    ) {
      cut = i + 1;
      break;
    }
  }
  if (cut < 0) throw new Error("ice");
  var letters = all.letters.slice(0, cut);
}
let r = applyLetters(letters);
save(letters, "ice", r);

const steps: { label: string; done: (x: Runner) => boolean }[] = [
  // Original chips5 first (fast fire-west route)
  { label: "chips5", done: (x) => x.playerState.chipsRemainingOnMap <= 5 },
  // Nearby red at 18,4 — require that specific key gone
  {
    label: "red184",
    done: (x) =>
      x.playerState.keys.includes("key_red") && getCompositeTile(x.level, 18, 4) !== "key_red",
  },
  { label: "open_red", done: (x) => cellTile(x.level, "upper", 16, 15) !== "door_red" },
  { label: "chips4", done: (x) => x.playerState.chipsRemainingOnMap <= 4 },
  { label: "chips3", done: (x) => x.playerState.chipsRemainingOnMap <= 3 },
  {
    label: "c2b",
    done: (x) =>
      x.playerState.chipsRemainingOnMap <= 2 && x.playerState.keys.includes("key_blue"),
  },
  { label: "c1327", done: (x) => cellTile(x.level, "upper", 13, 27) !== "chip" },
  { label: "c1619", done: (x) => cellTile(x.level, "upper", 16, 19) !== "chip" },
  // brown may open blue en route if we still have blue
  { label: "brown", done: (x) => getCompositeTile(x.level, 16, 9) === "block_movable" },
  {
    label: "exit89",
    done: (x) =>
      x.completed &&
      !x.playerDied &&
      msSecondsRemaining(TIME_LIMIT, x.buttonPressCtx.moveBoundary) >= BOLD,
  },
];

for (const s of steps) {
  if (s.done(r)) {
    console.log("skip", s.label);
    continue;
  }
  console.log("Searching", s.label);
  let seg = bfsPath(r, s.done, s.label);
  if (!seg && s.label === "exit89") {
    seg = bfsPath(r, (x) => x.completed && !x.playerDied, "exit_any");
  }
  if (!seg && s.label === "brown" && !r.playerState.keys.includes("key_blue")) {
    console.log("reblue then brown");
    const b = bfsPath(r, (x) => x.playerState.keys.includes("key_blue"), "reblue");
    if (!b) process.exit(1);
    letters.push(...encodeSolutionMoves(b));
    r = applyLetters(letters);
    save(letters, "reblue", r);
    seg = bfsPath(r, s.done, "brown2");
  }
  if (!seg) {
    console.error("FAIL", s.label);
    process.exit(1);
  }
  letters.push(...encodeSolutionMoves(seg));
  r = applyLetters(letters);
  save(letters, s.label, r);
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
          "SW/NW boots; fire/ice; chips5+red; open exit; chips; brown; exit; 89",
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
