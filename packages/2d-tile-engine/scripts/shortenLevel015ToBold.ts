/**
 * Take the rem-88 Elementary route (TWS prefix 793 + hold-brown exit)
 * and shave 6 ticks to exact bold 89 (805 ticks).
 */
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  cloneMsCc1SimulationRunner,
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { decodeSolutionMoves, encodeSolutionMoves } from "../engine/solutionMoves.js";
import type { Direction, LevelData } from "../engine/types.js";
import { readLevelSolution } from "../integration/solutionStorage.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TIME_LIMIT = 250;
const BOLD = 89;
const TARGET_TICKS = (TIME_LIMIT - BOLD) * 5; // 805
const DIRS: Direction[] = ["up", "down", "left", "right"];
const OPP: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

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

type Runner = ReturnType<typeof createMsCc1SimulationRunner>;

function verify(moves: Direction[]) {
  const r = createMsCc1SimulationRunner(structuredClone(level));
  for (const d of moves) {
    stepMsCc1Simulation(r, d);
    if (r.playerDied) return { ok: false, rem: 0, ticks: 0, r };
    if (r.completed) break;
  }
  return {
    ok: r.completed && !r.playerDied,
    rem: msSecondsRemaining(TIME_LIMIT, r.buttonPressCtx.moveBoundary),
    ticks: r.buttonPressCtx.moveBoundary,
    r,
  };
}

const tws = decodeSolutionMoves(readLevelSolution<{ moves: string[] }>(15)!.moves) as Direction[];
const exit: Direction[] = [
  "down",
  "right",
  "right",
  "up",
  "up",
  "up",
  "down",
  "down",
  "down",
  "down",
  "down",
  "down",
  "down",
  "down",
];
let moves = [...tws.slice(0, 793), ...exit];
let v = verify(moves);
console.log("start", { ok: v.ok, len: moves.length, rem: v.rem, ticks: v.ticks, target: TARGET_TICKS });
if (!v.ok) process.exit(1);

{
  let removed = 0;
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < moves.length - 1; i++) {
      if (OPP[moves[i]!] !== moves[i + 1]) continue;
      const trial = [...moves.slice(0, i), ...moves.slice(i + 2)];
      const tv = verify(trial);
      if (tv.ok) {
        moves = trial;
        removed += 2;
        changed = true;
        if (tv.ticks <= TARGET_TICKS) break;
        break;
      }
    }
  }
  v = verify(moves);
  console.log("pairs", { removed, len: moves.length, rem: v.rem, ticks: v.ticks });
}

{
  let removed = 0;
  for (let i = 0; i < moves.length && v.ticks > TARGET_TICKS; ) {
    const trial = [...moves.slice(0, i), ...moves.slice(i + 1)];
    const tv = verify(trial);
    if (tv.ok) {
      moves = trial;
      v = tv;
      removed++;
      continue;
    }
    i++;
  }
  console.log("singles", { removed, len: moves.length, rem: v.rem, ticks: v.ticks });
}

function sig(r: Runner): string {
  return `${r.gx},${r.gy}|${r.playerState.chipsRemainingOnMap}|${r.playerState.keys.join(",")}|${r.playerState.tools.join(",")}`;
}

function tryStep(r: Runner, d: Direction): Runner | null {
  const n = cloneMsCc1SimulationRunner(r);
  stepMsCc1Simulation(n, d);
  return n.playerDied ? null : n;
}

if (v.ticks > TARGET_TICKS) {
  for (const win of [4, 6, 8, 10, 12, 16]) {
    let improved = true;
    let passes = 0;
    while (improved && passes < 6 && v.ticks > TARGET_TICKS) {
      improved = false;
      passes++;
      const prefixes: Runner[] = [];
      let r = createMsCc1SimulationRunner(structuredClone(level));
      prefixes.push(cloneMsCc1SimulationRunner(r));
      for (const d of moves) {
        const n = tryStep(r, d);
        if (!n) break;
        r = n;
        prefixes.push(cloneMsCc1SimulationRunner(r));
        if (r.completed) break;
      }
      outer: for (let i = 0; i < prefixes.length - 3; i++) {
        for (let len = 3; len <= win && i + len < prefixes.length; len++) {
          const start = prefixes[i]!;
          const goal = prefixes[i + len]!;
          const goalSig = sig(goal);
          const q: { seq: Direction[]; r: Runner }[] = [{ seq: [], r: start }];
          const seen = new Set([sig(start)]);
          let found: Direction[] | null = null;
          let nodes = 0;
          while (q.length && nodes < 12_000) {
            const f = q.shift()!;
            nodes++;
            if (f.seq.length > 0 && sig(f.r) === goalSig) {
              found = f.seq;
              break;
            }
            if (f.seq.length >= len - 1) continue;
            for (const d of DIRS) {
              const n = tryStep(f.r, d);
              if (!n) continue;
              const k = sig(n);
              if (seen.has(k)) continue;
              seen.add(k);
              if (k === goalSig) {
                found = [...f.seq, d];
                q.length = 0;
                break;
              }
              q.push({ seq: [...f.seq, d], r: n });
            }
          }
          if (found && found.length < len) {
            const trial = [...moves.slice(0, i), ...found, ...moves.slice(i + len)];
            const tv = verify(trial);
            if (tv.ok && tv.ticks < v.ticks) {
              console.log(`win${win}`, i, len, "->", found.length, "ticks", tv.ticks, "rem", tv.rem);
              moves = trial;
              v = tv;
              improved = true;
              break outer;
            }
          }
        }
      }
    }
    console.log("after win", win, { len: moves.length, rem: v.rem, ticks: v.ticks, passes });
    if (v.rem === BOLD) break;
  }
}

console.log("FINAL", { ok: v.ok, len: moves.length, ticks: v.ticks, rem: v.rem, exact: v.rem === BOLD });

const webPath = path.join(
  root,
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/data/cc1-ms-solutions/level-015.json",
);
if (v.ok && v.rem >= BOLD) {
  const entry = {
    levelId: "level-015",
    passwordMs: "COZQ",
    title: "Elementary",
    timeLimitSeconds: 250,
    boldTimeRemaining: 89,
    minChipMoves: 161,
    moves: encodeSolutionMoves(moves),
    source: "https://scores.bitbusters.club/levels/cc1/15/ms",
    walkthroughUrl: "https://strategywiki.org/wiki/Chip%27s_Challenge/Levels_1-20",
    boldRouteHint:
      "SW flippers+blue; NW suction+red; water+force; fire boots+red; ice skates+blue; block L; fire W then E; ice E then S; ice thief slide; block L+socket; hold brown → exit",
    moveVerified: v.rem === BOLD,
    meetsBoldBudget: v.rem >= BOLD,
    moveSource: `TWS prefix + hold-brown exit, shortened; rem ${v.rem} (bold 89)`,
    simulatedTicks: v.ticks,
    simulatedSecondsRemaining: v.rem,
    boldGapNote: v.rem === BOLD ? undefined : `rem ${v.rem} vs bold 89`,
  };
  writeFileSync(webPath, `${JSON.stringify(entry, null, 2)}\n`);
  console.log("wrote", webPath);
} else {
  writeFileSync(
    path.join(root, ".tmp/level015-shorten.json"),
    JSON.stringify({ letters: encodeSolutionMoves(moves), rem: v.rem, ticks: v.ticks, ok: v.ok }, null, 2),
  );
  console.log("saved progress only");
}
