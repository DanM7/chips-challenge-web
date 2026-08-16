/**
 * Aggressive shorten of verified Hunt route toward ticks 650–654.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { Direction, LevelData } from "../engine/types.js";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  cloneMsCc1SimulationRunner,
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { decodeSolutionMoves, encodeSolutionMoves } from "../engine/solutionMoves.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const levelPath = path.join(
  root,
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-012.json",
);
const webSolPath = path.join(
  root,
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/data/cc1-ms-solutions/level-012.json",
);

type Runner = ReturnType<typeof createMsCc1SimulationRunner>;
const DIRS: Direction[] = ["up", "down", "left", "right"];
const OPP: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

function loadLevel(): LevelData {
  const level = JSON.parse(fs.readFileSync(levelPath, "utf8")) as LevelData;
  normalizeLevelLayers(level);
  return level;
}

function tryStep(r: Runner, d: Direction): Runner | null {
  const n = cloneMsCc1SimulationRunner(r);
  stepMsCc1Simulation(n, d);
  return n.playerDied ? null : n;
}

function chipFp(r: Runner): string {
  const upper = r.level.layers.upper as string[];
  let h = 0;
  for (let i = 0; i < upper.length; i++) {
    if (upper[i] === "chip") h = (Math.imul(h, 131) + i) >>> 0;
  }
  return `${r.playerState.chipsRemainingOnMap}:${h}`;
}

function verify(level: LevelData, moves: Direction[]) {
  let r = createMsCc1SimulationRunner(structuredClone(level));
  for (const d of moves) {
    stepMsCc1Simulation(r, d);
    if (r.playerDied) return { ok: false, rem: 0, ticks: 0, r };
    if (r.completed) break;
  }
  return {
    ok: r.completed,
    rem: msSecondsRemaining(400, r.buttonPressCtx.moveBoundary),
    ticks: r.buttonPressCtx.moveBoundary,
    r,
  };
}

function fullSig(r: Runner): string {
  return `${r.gx},${r.gy}|${chipFp(r)}|${r.monsters.map((m) => `${m.x},${m.y},${m.direction}`).join(";")}`;
}

const level = loadLevel();
const entry = JSON.parse(fs.readFileSync(webSolPath, "utf8"));
let moves = decodeSolutionMoves(entry.moves) as Direction[];
let v = verify(level, moves);
console.log("start", { ok: v.ok, len: moves.length, rem: v.rem, ticks: v.ticks });
if (!v.ok) process.exit(1);

// 1) Strip cancel pairs
{
  let changed = true;
  let removed = 0;
  while (changed) {
    changed = false;
    for (let i = 0; i < moves.length - 1; i++) {
      if (OPP[moves[i]!] !== moves[i + 1]) continue;
      const trial = [...moves.slice(0, i), ...moves.slice(i + 2)];
      const tv = verify(level, trial);
      if (tv.ok) {
        moves = trial;
        removed += 2;
        changed = true;
        break;
      }
    }
  }
  v = verify(level, moves);
  console.log("pairs", { removed, len: moves.length, rem: v.rem });
}

// 2) Try deleting every single move (if still completes) — rare but catches no-ops
{
  let removed = 0;
  for (let i = 0; i < moves.length; ) {
    const trial = [...moves.slice(0, i), ...moves.slice(i + 1)];
    const tv = verify(level, trial);
    if (tv.ok && trial.length < moves.length) {
      moves = trial;
      removed++;
      // don't advance i — check same index again
      continue;
    }
    i++;
  }
  v = verify(level, moves);
  console.log("single deletes", { removed, len: moves.length, rem: v.rem });
}

// 3) Window replace with chip-fingerprint-aware BFS
function shortenWindows(winSizes: number[]) {
  for (const win of winSizes) {
    let improved = true;
    let passes = 0;
    while (improved && passes < 8) {
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

      outer: for (let i = 0; i < prefixes.length - 3; i += 1) {
        for (let len = 3; len <= win && i + len < prefixes.length; len++) {
          const j = i + len;
          const start = prefixes[i]!;
          const goal = prefixes[j]!;
          const goalSig = fullSig(goal);
          const q: { seq: Direction[]; r: Runner }[] = [{ seq: [], r: start }];
          const seen = new Set([fullSig(start) + `|${start.buttonPressCtx.moveBoundary}`]);
          let found: Direction[] | null = null;
          let nodes = 0;
          while (q.length && nodes < 25_000) {
            const f = q.shift()!;
            nodes++;
            if (f.seq.length > 0 && fullSig(f.r) === goalSig) {
              // Also need teeth facing match already in fullSig
              found = f.seq;
              break;
            }
            if (f.seq.length >= len - 1) continue;
            for (const d of DIRS) {
              const n = tryStep(f.r, d);
              if (!n) continue;
              if (n.gx === f.r.gx && n.gy === f.r.gy && !n.completed) continue;
              const k = fullSig(n) + `|${n.buttonPressCtx.moveBoundary}`;
              if (seen.has(k)) continue;
              seen.add(k);
              if (fullSig(n) === goalSig) {
                found = [...f.seq, d];
                break;
              }
              q.push({ seq: [...f.seq, d], r: n });
            }
            if (found) break;
          }
          if (found && found.length < len) {
            const trial = [...moves.slice(0, i), ...found, ...moves.slice(j)];
            const tv = verify(level, trial);
            if (tv.ok && trial.length < moves.length) {
              console.log(`win${win}`, i, "len", len, "->", found.length, "total", trial.length, "rem", tv.rem);
              moves = trial;
              improved = true;
              break outer;
            }
          }
        }
      }
    }
    v = verify(level, moves);
    console.log("after win", win, { len: moves.length, rem: v.rem, passes });
    if (v.rem === 270) return;
  }
}

shortenWindows([6, 10, 14, 18]);

v = verify(level, moves);
entry.moves = encodeSolutionMoves(moves);
entry.moveVerified = v.ok && v.rem === 270;
entry.meetsBoldBudget = v.ok && v.rem >= 270;
entry.simulatedTicks = v.ticks;
entry.simulatedSecondsRemaining = v.rem;
entry.moveSource = `aggressive shorten; rem ${v.rem} (bold 270)`;
fs.writeFileSync(webSolPath, `${JSON.stringify(entry, null, 2)}\n`);
console.log("FINAL", { ok: v.ok, moves: moves.length, ticks: v.ticks, rem: v.rem, exact270: v.rem === 270 });
