import fs from "fs";
import type { Direction, LevelData } from "../engine/types.js";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  cloneMsCc1SimulationRunner,
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { decodeSolutionMoves, encodeSolutionMoves } from "../engine/solutionMoves.js";

const levelPath =
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-012.json";
const webSolPath =
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/data/cc1-ms-solutions/level-012.json";

type Runner = ReturnType<typeof createMsCc1SimulationRunner>;
const DIRS: Direction[] = ["up", "down", "left", "right"];

function tryStep(r: Runner, d: Direction): Runner | null {
  const n = cloneMsCc1SimulationRunner(r);
  stepMsCc1Simulation(n, d);
  return n.playerDied ? null : n;
}

function chipFp(r: Runner): string {
  const upper = r.level.layers.upper as string[];
  let h = 0;
  for (let i = 0; i < upper.length; i++) if (upper[i] === "chip") h = (Math.imul(h, 131) + i) >>> 0;
  return `${r.playerState.chipsRemainingOnMap}:${h}`;
}
function fullSig(r: Runner): string {
  return `${r.gx},${r.gy}|${chipFp(r)}|${r.monsters.map((m) => `${m.x},${m.y},${m.direction}`).join(";")}`;
}

function verify(level: LevelData, moves: Direction[]) {
  let r = createMsCc1SimulationRunner(structuredClone(level));
  for (const d of moves) {
    stepMsCc1Simulation(r, d);
    if (r.playerDied) return { ok: false, rem: 0, ticks: 0 };
    if (r.completed) break;
  }
  return { ok: r.completed, rem: msSecondsRemaining(400, r.buttonPressCtx.moveBoundary), ticks: r.buttonPressCtx.moveBoundary };
}

const level = JSON.parse(fs.readFileSync(levelPath, "utf8")) as LevelData;
normalizeLevelLayers(level);
let moves = decodeSolutionMoves(JSON.parse(fs.readFileSync(webSolPath, "utf8")).moves) as Direction[];
console.log("start", verify(level, moves), "len", moves.length);

const deadline = Date.now() + 90_000;
let pass = 0;
while (Date.now() < deadline && pass < 30) {
  pass++;
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
  let improved = false;
  for (let i = 0; i < prefixes.length - 4; i += 2) {
    for (let len = 4; len <= 8 && i + len < prefixes.length; len++) {
      const j = i + len;
      const start = prefixes[i]!;
      const goalSig = fullSig(prefixes[j]!);
      const q: { seq: Direction[]; r: Runner }[] = [{ seq: [], r: start }];
      const seen = new Set([fullSig(start) + "|" + start.buttonPressCtx.moveBoundary]);
      let found: Direction[] | null = null;
      let nodes = 0;
      while (q.length && nodes < 12_000) {
        const f = q.shift()!;
        nodes++;
        if (f.seq.length > 0 && fullSig(f.r) === goalSig) {
          found = f.seq;
          break;
        }
        if (f.seq.length >= len - 1) continue;
        for (const d of DIRS) {
          const n = tryStep(f.r, d);
          if (!n || (n.gx === f.r.gx && n.gy === f.r.gy && !n.completed)) continue;
          const k = fullSig(n) + "|" + n.buttonPressCtx.moveBoundary;
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
          console.log("pass", pass, "i", i, len, "->", found.length, "len", trial.length, "rem", tv.rem);
          moves = trial;
          improved = true;
          break;
        }
      }
    }
    if (improved) break;
  }
  if (!improved) {
    console.log("no more at pass", pass);
    break;
  }
  if (verify(level, moves).rem === 270) break;
}

const v = verify(level, moves);
console.log("done", v, "len", moves.length);
const entry = JSON.parse(fs.readFileSync(webSolPath, "utf8"));
entry.moves = encodeSolutionMoves(moves);
entry.moveVerified = v.ok && v.rem === 270;
entry.meetsBoldBudget = v.ok && v.rem >= 270;
entry.simulatedTicks = v.ticks;
entry.simulatedSecondsRemaining = v.rem;
entry.moveSource = `TWS-hybrid+endgame+shorten; rem ${v.rem} (bold 270)`;
entry.boldGapNote =
  v.rem === 270
    ? undefined
    : `Completes verified; ${v.rem}s vs bold 270 (gap ${270 - v.rem}s / ~${(v.ticks ?? 0) - 654} ticks). TWS dies @220 (teeth). Need ~654 ticks for exact bold.`;
fs.writeFileSync(webSolPath, `${JSON.stringify(entry, null, 2)}\n`);
