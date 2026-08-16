/**
 * Shorten verified Hunt route; each candidate must clean-verify.
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

function verify(level: LevelData, moves: Direction[]): { ok: boolean; rem: number; ticks: number; r: Runner } {
  let r = createMsCc1SimulationRunner(structuredClone(level));
  for (const d of moves) {
    stepMsCc1Simulation(r, d);
    if (r.playerDied) return { ok: false, rem: 0, ticks: r.buttonPressCtx.moveBoundary, r };
    if (r.completed) break;
  }
  const rem = msSecondsRemaining(400, r.buttonPressCtx.moveBoundary);
  return { ok: r.completed, rem, ticks: r.buttonPressCtx.moveBoundary, r };
}

function stripPairs(level: LevelData, moves: Direction[]): Direction[] {
  let out = [...moves];
  let changed = true;
  let removed = 0;
  while (changed) {
    changed = false;
    for (let i = 0; i < out.length - 1; i++) {
      if (OPP[out[i]!] !== out[i + 1]) continue;
      const trial = [...out.slice(0, i), ...out.slice(i + 2)];
      const v = verify(level, trial);
      if (v.ok) {
        out = trial;
        removed += 2;
        changed = true;
        break;
      }
    }
  }
  console.log("stripped pairs", removed, "len", out.length);
  return out;
}

/** Sliding window: replace moves[i..j) with shorter BFS if same end state reachable. */
function windowShorten(level: LevelData, moves: Direction[], win: number): Direction[] {
  let best = moves;
  let improved = true;
  let rounds = 0;
  while (improved && rounds < 20) {
    improved = false;
    rounds++;
    // Build prefix runners for best
    const prefixes: Runner[] = [];
    let r = createMsCc1SimulationRunner(structuredClone(level));
    prefixes.push(cloneMsCc1SimulationRunner(r));
    for (const d of best) {
      const n = tryStep(r, d);
      if (!n) break;
      r = n;
      prefixes.push(cloneMsCc1SimulationRunner(r));
      if (r.completed) break;
    }

    for (let i = 0; i < prefixes.length - 2; i += Math.max(1, Math.floor(win / 2))) {
      const j = Math.min(i + win, prefixes.length - 1);
      if (j - i < 4) continue;
      const start = prefixes[i]!;
      const goal = prefixes[j]!;
      const goalSig = `${goal.gx},${goal.gy}|${goal.playerState.chipsRemainingOnMap}|${goal.monsters
        .map((m) => `${m.x},${m.y},${m.direction}`)
        .join(";")}`;
      // BFS shorter path — note: chip set may differ; require matching chipsRemaining and pos/teeth,
      // then full verify of spliced route (chip set encoded in route history via prefix).
      const q: { seq: Direction[]; r: Runner }[] = [{ seq: [], r: start }];
      const seen = new Set([
        `${start.gx},${start.gy}|${start.playerState.chipsRemainingOnMap}|${start.buttonPressCtx.moveBoundary}|${start.monsters.map((m) => `${m.x},${m.y}`).join(";")}`,
      ]);
      let found: Direction[] | null = null;
      let nodes = 0;
      const maxDepth = j - i - 1;
      while (q.length && nodes < 40_000) {
        const f = q.shift()!;
        nodes++;
        const sig = `${f.r.gx},${f.r.gy}|${f.r.playerState.chipsRemainingOnMap}|${f.r.monsters
          .map((m) => `${m.x},${m.y},${m.direction}`)
          .join(";")}`;
        if (f.seq.length > 0 && sig === goalSig) {
          found = f.seq;
          break;
        }
        if (f.seq.length >= maxDepth) continue;
        for (const d of DIRS) {
          const n = tryStep(f.r, d);
          if (!n) continue;
          if (n.gx === f.r.gx && n.gy === f.r.gy && !n.completed) continue;
          const k = `${n.gx},${n.gy}|${n.playerState.chipsRemainingOnMap}|${n.buttonPressCtx.moveBoundary}|${n.monsters.map((m) => `${m.x},${m.y}`).join(";")}`;
          if (seen.has(k)) continue;
          seen.add(k);
          const nsig = `${n.gx},${n.gy}|${n.playerState.chipsRemainingOnMap}|${n.monsters
            .map((m) => `${m.x},${m.y},${m.direction}`)
            .join(";")}`;
          if (nsig === goalSig) {
            found = [...f.seq, d];
            break;
          }
          q.push({ seq: [...f.seq, d], r: n });
        }
        if (found) break;
      }
      if (found && found.length < j - i) {
        const trial = [...best.slice(0, i), ...found, ...best.slice(j)];
        const v = verify(level, trial);
        if (v.ok && trial.length < best.length) {
          console.log("window", i, j, "saved", j - i - found.length, "->", trial.length, "rem", v.rem);
          best = trial;
          improved = true;
          break; // rebuild prefixes
        }
      }
    }
  }
  return best;
}

const level = loadLevel();
const entry = JSON.parse(fs.readFileSync(webSolPath, "utf8"));
let moves = decodeSolutionMoves(entry.moves) as Direction[];
let v = verify(level, moves);
console.log("start", { ok: v.ok, moves: moves.length, ticks: v.ticks, rem: v.rem });
if (!v.ok) {
  console.error("base route invalid");
  process.exit(1);
}

moves = stripPairs(level, moves);
v = verify(level, moves);
console.log("after strip", { moves: moves.length, rem: v.rem });

for (const win of [8, 12, 16, 20, 24]) {
  const before = moves.length;
  moves = windowShorten(level, moves, win);
  v = verify(level, moves);
  console.log("win", win, { moves: moves.length, saved: before - moves.length, rem: v.rem, ok: v.ok });
  if (v.rem === 270) break;
}

v = verify(level, moves);
entry.moves = encodeSolutionMoves(moves);
entry.moveVerified = v.ok && v.rem === 270;
entry.meetsBoldBudget = v.ok && v.rem >= 270;
entry.simulatedTicks = v.ticks;
entry.simulatedSecondsRemaining = v.rem;
entry.moveSource = v.ok
  ? `verified greedy+shorten; rem ${v.rem} (bold 270)`
  : entry.moveSource;
fs.writeFileSync(webSolPath, `${JSON.stringify(entry, null, 2)}\n`);
console.log("final", { ok: v.ok, moves: moves.length, ticks: v.ticks, rem: v.rem, exact: v.rem === 270 });
