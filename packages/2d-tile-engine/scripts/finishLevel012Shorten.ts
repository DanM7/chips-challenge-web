/**
 * Quick save best shorten so far (pairs + win6 only), then try lodge-teeth scripted route.
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

function fullSig(r: Runner): string {
  return `${r.gx},${r.gy}|${chipFp(r)}|${r.monsters.map((m) => `${m.x},${m.y},${m.direction}`).join(";")}`;
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

function teethDist(r: Runner): number {
  let b = 99;
  for (const m of r.monsters) {
    if (!m.alive) continue;
    b = Math.min(b, Math.abs(m.x - r.gx) + Math.abs(m.y - r.gy));
  }
  return b;
}

function expand(n: string): Direction[] {
  const map: Record<string, Direction> = { U: "up", D: "down", L: "left", R: "right" };
  const out: Direction[] = [];
  for (const tok of n.trim().split(/\s+/)) {
    const m = tok.match(/^(\d+)?([UDLR])$/);
    if (!m) throw new Error(tok);
    const c = m[1] ? Number.parseInt(m[1], 10) : 1;
    for (let i = 0; i < c; i++) out.push(map[m[2]!]!);
  }
  return out;
}

const level = loadLevel();
let moves = decodeSolutionMoves(JSON.parse(fs.readFileSync(webSolPath, "utf8")).moves) as Direction[];

// pairs
{
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < moves.length - 1; i++) {
      if (OPP[moves[i]!] !== moves[i + 1]) continue;
      const trial = [...moves.slice(0, i), ...moves.slice(i + 2)];
      if (verify(level, trial).ok) {
        moves = trial;
        changed = true;
        break;
      }
    }
  }
}
console.log("after pairs", verify(level, moves));

// win6 only, few passes
for (let pass = 0; pass < 5; pass++) {
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
  outer: for (let i = 0; i < prefixes.length - 3; i++) {
    for (let len = 4; len <= 8 && i + len < prefixes.length; len++) {
      const j = i + len;
      const start = prefixes[i]!;
      const goalSig = fullSig(prefixes[j]!);
      const q: { seq: Direction[]; r: Runner }[] = [{ seq: [], r: start }];
      const seen = new Set([fullSig(start) + "|" + start.buttonPressCtx.moveBoundary]);
      let found: Direction[] | null = null;
      let nodes = 0;
      while (q.length && nodes < 20_000) {
        const f = q.shift()!;
        nodes++;
        if (f.seq.length > 0 && fullSig(f.r) === goalSig) {
          found = f.seq;
          break;
        }
        if (f.seq.length >= len - 1) continue;
        for (const d of DIRS) {
          const n = tryStep(f.r, d);
          if (!n) continue;
          if (n.gx === f.r.gx && n.gy === f.r.gy && !n.completed) continue;
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
          console.log("improve", i, len, "->", found.length, "rem", tv.rem, "len", trial.length);
          moves = trial;
          improved = true;
          break outer;
        }
      }
    }
  }
  if (!improved) break;
}

let v = verify(level, moves);
console.log("shortened", { len: moves.length, rem: v.rem, ticks: v.ticks });

// Write if best
const existing = JSON.parse(fs.readFileSync(webSolPath, "utf8"));
if (v.ok && v.rem >= (existing.simulatedSecondsRemaining ?? 0)) {
  existing.moves = encodeSolutionMoves(moves);
  existing.moveVerified = v.rem === 270;
  existing.meetsBoldBudget = v.rem >= 270;
  existing.simulatedTicks = v.ticks;
  existing.simulatedSecondsRemaining = v.rem;
  existing.moveSource = `shortened verified; rem ${v.rem} (bold 270)`;
  fs.writeFileSync(webSolPath, `${JSON.stringify(existing, null, 2)}\n`);
  console.log("wrote rem", v.rem);
}

// Probe: after open, clear top then 29R lodge
console.log("\n--- lodge probe ---");
let probe = createMsCc1SimulationRunner(structuredClone(level));
const open = expand("U 12L 4U 3R 2D 5L 4U"); // toward top-left
for (const d of open) {
  const n = tryStep(probe, d);
  if (!n) {
    console.log("died in open+", d);
    break;
  }
  probe = n;
}
console.log("at", `${probe.gx},${probe.gy}`, "chips", probe.playerState.chipsRemainingOnMap, "teeth", probe.monsters.map((m) => `${m.x},${m.y}`), "td", teethDist(probe));
// go to (1,1) then 29R
const toTop = expand("L U"); // adjust
for (const d of [...Array(10)].flatMap(() => {
  // step toward 1,1 greedily
  return [] as Direction[];
})) {}
while (probe.gx > 1 || probe.gy > 1) {
  let d: Direction | null = null;
  if (probe.gy > 1) d = "up";
  else if (probe.gx > 1) d = "left";
  if (!d) break;
  const n = tryStep(probe, d);
  if (!n || teethDist(n) === 0) {
    // try other
    const alt = d === "up" ? "left" : "up";
    const n2 = tryStep(probe, alt);
    if (!n2 || teethDist(n2) === 0) {
      console.log("blocked to top", `${probe.gx},${probe.gy}`, teethDist(probe));
      break;
    }
    probe = n2;
  } else probe = n;
}
console.log("top", `${probe.gx},${probe.gy}`, "teeth", probe.monsters.map((m) => `${m.x},${m.y}:${m.direction}`));
let lodge = 0;
while (probe.gx < 30 && lodge < 29) {
  const n = tryStep(probe, "right");
  if (!n) break;
  probe = n;
  lodge++;
}
console.log("after lodge", lodge, `${probe.gx},${probe.gy}`, "teeth", probe.monsters.map((m) => `${m.x},${m.y}:${m.direction}`), "td", teethDist(probe));
