/**
 * Hunt: verified greedy serpentine (no beam dedup bugs) + fast exit.
 * Writes best completing route; pads/trims toward rem 270 if possible.
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
import { encodeSolutionMoves } from "../engine/solutionMoves.js";

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

function tryStep(r: Runner, d: Direction): Runner | null {
  const n = cloneMsCc1SimulationRunner(r);
  stepMsCc1Simulation(n, d);
  return n.playerDied ? null : n;
}

function teethDist(r: Runner): number {
  let b = 99;
  for (const m of r.monsters) {
    if (!m.alive) continue;
    b = Math.min(b, Math.abs(m.x - r.gx) + Math.abs(m.y - r.gy));
  }
  return b;
}

function exitKey(r: Runner): string {
  // chipsRemaining is 0; chip tiles don't affect walkability vs empty
  return `${r.gx},${r.gy}|${r.monsters.map((m) => `${m.x},${m.y},${m.direction}`).join(";")}|${r.buttonPressCtx.moveBoundary}`;
}

function bfsExit(start: Runner): Direction[] | null {
  const q: { seq: Direction[]; r: Runner }[] = [{ seq: [], r: start }];
  const seen = new Set([`${start.gx},${start.gy}|${start.monsters.map((m) => `${m.x},${m.y}`).join(";")}`]);
  let nodes = 0;
  while (q.length && nodes < 300_000) {
    const f = q.shift()!;
    nodes++;
    if (f.r.completed) return f.seq;
    if (f.seq.length >= 50) continue;
    for (const d of DIRS) {
      const n = tryStep(f.r, d);
      if (!n) continue;
      if (n.completed) return [...f.seq, d];
      if (n.gx === f.r.gx && n.gy === f.r.gy) continue;
      const k = `${n.gx},${n.gy}|${n.monsters.map((m) => `${m.x},${m.y}`).join(";")}`;
      if (seen.has(k)) continue;
      seen.add(k);
      q.push({ seq: [...f.seq, d], r: n });
    }
  }
  console.error("exit bfs nodes", nodes);
  return null;
}

function bfsToChip(start: Runner, maxDepth: number): Direction[] | null {
  const need = start.playerState.chipsRemainingOnMap;
  const q: { seq: Direction[]; r: Runner }[] = [{ seq: [], r: start }];
  // Include moveBoundary so teeth parity differs
  const seen = new Set([
    `${start.gx},${start.gy}|${need}|${start.buttonPressCtx.moveBoundary}|${start.monsters.map((m) => `${m.x},${m.y}`).join(";")}`,
  ]);
  let nodes = 0;
  while (q.length && nodes < 100_000) {
    const f = q.shift()!;
    nodes++;
    if (f.seq.length > 0 && f.r.playerState.chipsRemainingOnMap < need) return f.seq;
    if (f.seq.length >= maxDepth) continue;
    const ordered = [...DIRS].sort((a, b) => {
      const na = tryStep(f.r, a);
      const nb = tryStep(f.r, b);
      const ca = na && na.playerState.chipsRemainingOnMap < need ? 1 : 0;
      const cb = nb && nb.playerState.chipsRemainingOnMap < need ? 1 : 0;
      if (ca !== cb) return cb - ca;
      return (nb ? teethDist(nb) : -1) - (na ? teethDist(na) : -1);
    });
    for (const d of ordered) {
      const n = tryStep(f.r, d);
      if (!n) continue;
      if (n.gx === f.r.gx && n.gy === f.r.gy) continue;
      const k = `${n.gx},${n.gy}|${n.playerState.chipsRemainingOnMap}|${n.buttonPressCtx.moveBoundary}|${n.monsters.map((m) => `${m.x},${m.y}`).join(";")}`;
      if (seen.has(k)) continue;
      seen.add(k);
      if (n.playerState.chipsRemainingOnMap < need) return [...f.seq, d];
      q.push({ seq: [...f.seq, d], r: n });
    }
  }
  return null;
}

function pickAdjacent(r: Runner, prefer: Direction | null): Direction | null {
  const td0 = teethDist(r);
  const opts: { d: Direction; chip: boolean; td: number; straight: boolean }[] = [];
  for (const d of DIRS) {
    const n = tryStep(r, d);
    if (!n || (n.gx === r.gx && n.gy === r.gy)) continue;
    const td = teethDist(n);
    if (td === 0) continue;
    opts.push({
      d,
      chip: n.playerState.chipsRemainingOnMap < r.playerState.chipsRemainingOnMap,
      td,
      straight: d === prefer,
    });
  }
  if (!opts.length) return null;
  opts.sort((a, b) => {
    if (td0 <= 2) {
      if (a.td !== b.td) return b.td - a.td;
      if (a.chip !== b.chip) return a.chip ? -1 : 1;
      return 0;
    }
    if (a.chip !== b.chip) return a.chip ? -1 : 1;
    if (a.straight !== b.straight) return a.straight ? -1 : 1;
    return b.td - a.td;
  });
  if (opts[0]!.chip || td0 <= 2) return opts[0]!.d;
  return null;
}

function verify(level: LevelData, moves: Direction[]) {
  let r = createMsCc1SimulationRunner(structuredClone(level));
  for (const d of moves) {
    stepMsCc1Simulation(r, d);
    if (r.playerDied) return { ok: false, r };
    if (r.completed) return { ok: true, r };
  }
  return { ok: r.completed, r };
}

/** Insert out-and-back pairs before exit to land ticks in [650,654]. */
function padBeforeExit(level: LevelData, moves: Direction[]): Direction[] | null {
  let r = createMsCc1SimulationRunner(structuredClone(level));
  let lastSafe = -1;
  for (let i = 0; i < moves.length; i++) {
    const n = tryStep(r, moves[i]!);
    if (!n) return null;
    r = n;
    if (!r.completed) lastSafe = i;
    else break;
  }
  if (lastSafe < 0) return null;
  const prefix = moves.slice(0, lastSafe + 1);
  const suffix = moves.slice(lastSafe + 1);
  r = createMsCc1SimulationRunner(structuredClone(level));
  for (const d of prefix) r = tryStep(r, d)!;
  const ticksNow = r.buttonPressCtx.moveBoundary;
  // After suffix, ticks ≈ ticksNow + suffix.length (if each advances by 1)
  const projected = ticksNow + suffix.length;
  if (projected >= 650 && projected <= 654) return moves;
  if (projected > 654) return null; // too long already
  let need = 650 - projected;
  // make need even for out-back pairs preferentially
  const pad: Direction[] = [];
  let cur = r;
  let guard = 0;
  while (pad.length < need && guard < need * 6) {
    guard++;
    let did = false;
    for (const d of DIRS) {
      const n = tryStep(cur, d);
      if (!n || n.completed || (n.gx === cur.gx && n.gy === cur.gy)) continue;
      if (teethDist(n) < 2) continue;
      const back = tryStep(n, OPP[d]);
      if (!back || back.gx !== cur.gx || back.gy !== cur.gy) continue;
      if (pad.length + 2 > need) {
        // single step
        pad.push(d);
        cur = n;
        did = true;
        break;
      }
      pad.push(d, OPP[d]);
      cur = back;
      did = true;
      break;
    }
    if (!did) {
      const opts = DIRS.map((d) => ({ d, n: tryStep(cur, d) }))
        .filter((x) => x.n && !x.n.completed && !(x.n.gx === cur.gx && x.n.gy === cur.gy))
        .sort((a, b) => teethDist(b.n!) - teethDist(a.n!));
      if (!opts.length) break;
      pad.push(opts[0]!.d);
      cur = opts[0]!.n!;
    }
  }
  return [...prefix, ...pad, ...suffix];
}

const level = loadLevel();
let runner = createMsCc1SimulationRunner(structuredClone(level));
const route: Direction[] = [];
let prefer: Direction | null = null;
let waste = 0;

function go(seq: Direction[]): boolean {
  for (const d of seq) {
    const before = runner.playerState.chipsRemainingOnMap;
    const n = tryStep(runner, d);
    if (!n) return false;
    if (n.playerState.chipsRemainingOnMap >= before && !n.completed) waste++;
    route.push(d);
    runner = n;
    prefer = d;
    if (runner.completed) return true;
  }
  return true;
}

if (!go(expand("U 12L 4U 3R 2D"))) {
  console.error("open fail");
  process.exit(1);
}
console.log("open", route.length, "chips", runner.playerState.chipsRemainingOnMap);

while (runner.playerState.chipsRemainingOnMap > 0 && route.length < 780) {
  // At ~130 chips left, prefer moves toward center
  const chips = runner.playerState.chipsRemainingOnMap;
  const centerBias = chips <= 140;
  let d = pickAdjacent(runner, prefer);
  if (d && centerBias) {
    // re-rank: among chip moves, prefer closer to center
    const opts: Direction[] = [];
    for (const dir of DIRS) {
      const n = tryStep(runner, dir);
      if (!n || (n.gx === runner.gx && n.gy === runner.gy)) continue;
      if (teethDist(n) === 0) continue;
      if (n.playerState.chipsRemainingOnMap < chips) opts.push(dir);
    }
    if (opts.length) {
      opts.sort((a, b) => {
        const na = tryStep(runner, a)!;
        const nb = tryStep(runner, b)!;
        const da = Math.abs(na.gx - 15) + Math.abs(na.gy - 15);
        const db = Math.abs(nb.gx - 15) + Math.abs(nb.gy - 15);
        return da - db;
      });
      d = opts[0]!;
    }
  }
  if (d) {
    if (!go([d])) break;
  } else {
    const seq = bfsToChip(runner, centerBias ? 40 : 28);
    if (!seq) {
      console.error("stuck", `${runner.gx},${runner.gy}`, chips, "td", teethDist(runner));
      break;
    }
    if (!go(seq)) break;
  }
  if (route.length % 100 === 0) {
    console.log(route.length, `${runner.gx},${runner.gy}`, "chips", runner.playerState.chipsRemainingOnMap, "waste", waste, "td", teethDist(runner));
  }
}

console.log("collect", {
  chips: runner.playerState.chipsRemainingOnMap,
  moves: route.length,
  waste,
  pos: `${runner.gx},${runner.gy}`,
});

if (runner.playerState.chipsRemainingOnMap === 0 && !runner.completed) {
  const ex = bfsExit(runner);
  if (!ex) {
    console.error("no exit");
    process.exit(1);
  }
  console.log("exit", ex.length, ex.map((x) => ({ up: "U", down: "D", left: "L", right: "R" })[x]).join(""));
  if (!go(ex)) {
    console.error("exit died");
    process.exit(1);
  }
}

let v = verify(level, route);
let rem = msSecondsRemaining(400, v.r.buttonPressCtx.moveBoundary);
console.log("verify1", {
  ok: v.ok,
  moves: route.length,
  ticks: v.r.buttonPressCtx.moveBoundary,
  rem,
});

let finalRoute = route;
if (v.ok && rem > 270) {
  const padded = padBeforeExit(level, route);
  if (padded) {
    const v2 = verify(level, padded);
    const rem2 = msSecondsRemaining(400, v2.r.buttonPressCtx.moveBoundary);
    console.log("padded", { ok: v2.ok, moves: padded.length, ticks: v2.r.buttonPressCtx.moveBoundary, rem: rem2 });
    if (v2.ok) {
      finalRoute = padded;
      v = v2;
      rem = rem2;
    }
  }
}

const letters = encodeSolutionMoves(finalRoute);
const entry = {
  levelId: "level-012",
  passwordMs: "WVHI",
  title: "Hunt",
  timeLimitSeconds: 400,
  boldTimeRemaining: 270,
  minChipMoves: 130,
  moves: letters,
  source: "https://scores.bitbusters.club/levels/cc1/12/ms",
  walkthroughUrl: "https://strategywiki.org/wiki/Chip%27s_Challenge/Levels_1-20",
  boldRouteHint:
    "U 12L 4U 3R 2D, east/west serpentine, center at ~140 left; chipsRequired 652",
  moveVerified: v.ok && rem === 270,
  meetsBoldBudget: v.ok && rem >= 270,
  moveSource: v.ok
    ? `verified greedy serpentine; rem ${rem} (bold 270); waste~${waste}`
    : `failed/incomplete; chips ${v.r.playerState.chipsRemainingOnMap}`,
  simulatedTicks: v.r.buttonPressCtx.moveBoundary,
  simulatedSecondsRemaining: rem,
};
fs.writeFileSync(webSolPath, `${JSON.stringify(entry, null, 2)}\n`);
fs.writeFileSync(path.join(__dirname, "level012-letters.json"), `${JSON.stringify(letters, null, 2)}\n`);
console.log("wrote moveVerified=", entry.moveVerified, "rem", rem, "meets", entry.meetsBoldBudget);
