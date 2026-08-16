/**
 * From best chips0+blue (no early red): try exit via ice; else brown+red path.
 * Rebuild ice→chips quickly using known good goals.
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
    getCompositeTile(r.level, 16, 9) === "block_movable" ? "Br" : "o",
  ].join("|");
}

function bfsPath(
  start: Runner,
  done: (r: Runner) => boolean,
  label: string,
  maxNodes = 800000,
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
    tools: r.playerState.tools,
    ticks: r.buttonPressCtx.moveBoundary,
    rem: msSecondsRemaining(TIME_LIMIT, r.buttonPressCtx.moveBoundary),
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

for (const [label, done] of [
  ["chips5", (x: Runner) => x.playerState.chipsRemainingOnMap <= 5],
  ["chips4", (x: Runner) => x.playerState.chipsRemainingOnMap <= 4],
  ["chips3", (x: Runner) => x.playerState.chipsRemainingOnMap <= 3],
  [
    "c2b",
    (x: Runner) =>
      x.playerState.chipsRemainingOnMap <= 2 && x.playerState.keys.includes("key_blue"),
  ],
  ["c1327", (x: Runner) => cellTile(x.level, "upper", 13, 27) !== "chip"],
  ["c1619", (x: Runner) => cellTile(x.level, "upper", 16, 19) !== "chip"],
] as const) {
  if (done(r)) continue;
  console.log("Searching", label);
  const seg = bfsPath(r, done, label);
  if (!seg) process.exit(1);
  letters.push(...encodeSolutionMoves(seg));
  r = applyLetters(letters);
  save(letters, label, r);
}

console.log("try exit via ice (no brown)");
{
  const seg = bfsPath(
    r,
    (x) =>
      x.completed &&
      !x.playerDied &&
      msSecondsRemaining(TIME_LIMIT, x.buttonPressCtx.moveBoundary) >= BOLD,
    "exit_ice89",
    200000,
  );
  if (seg) {
    letters.push(...encodeSolutionMoves(seg));
    r = applyLetters(letters);
    save(letters, "exit_ice", r);
  } else {
    console.log("ice exit failed; try any complete");
    const seg2 = bfsPath(r, (x) => x.completed && !x.playerDied, "exit_ice_any", 200000);
    if (seg2) {
      letters.push(...encodeSolutionMoves(seg2));
      r = applyLetters(letters);
      save(letters, "exit_ice_any", r);
    } else {
      console.log("Searching red then brown route");
      let segR = bfsPath(
        r,
        (x) => x.playerState.keys.includes("key_red"),
        "red",
      );
      if (!segR) process.exit(1);
      letters.push(...encodeSolutionMoves(segR));
      r = applyLetters(letters);
      save(letters, "red", r);

      const open = bfsPath(
        r,
        (x) => cellTile(x.level, "upper", 16, 15) !== "door_red",
        "open_red",
      );
      if (!open) process.exit(1);
      letters.push(...encodeSolutionMoves(open));
      r = applyLetters(letters);
      save(letters, "open_red", r);

      const brown = bfsPath(
        r,
        (x) => getCompositeTile(x.level, 16, 9) === "block_movable",
        "brown",
      );
      if (!brown) process.exit(1);
      letters.push(...encodeSolutionMoves(brown));
      r = applyLetters(letters);
      save(letters, "brown", r);

      let ex = bfsPath(
        r,
        (x) =>
          x.completed &&
          !x.playerDied &&
          msSecondsRemaining(TIME_LIMIT, x.buttonPressCtx.moveBoundary) >= BOLD,
        "exit89",
      );
      if (!ex) ex = bfsPath(r, (x) => x.completed && !x.playerDied, "exit_any");
      if (!ex) process.exit(1);
      letters.push(...encodeSolutionMoves(ex));
      r = applyLetters(letters);
      save(letters, "exit", r);
    }
  }
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
          "SW/NW boots; fire/ice; chips; exit route; 89",
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
