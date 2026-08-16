/**
 * Hunt: follow TWS until death risk, dodge, resume TWS / greedy.
 * Goal: fewer waste moves than pure greedy (703).
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
const engSol = path.join(root, "integration/data/cc1-ms-solutions/level-012.json");
const webSolPath = path.join(
  root,
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/data/cc1-ms-solutions/level-012.json",
);

type Runner = ReturnType<typeof createMsCc1SimulationRunner>;
const DIRS: Direction[] = ["up", "down", "left", "right"];
const TWS_DIR: Direction[] = ["up", "left", "down", "right"];

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

function teethDist(r: Runner): number {
  let b = 99;
  for (const m of r.monsters) {
    if (!m.alive) continue;
    b = Math.min(b, Math.abs(m.x - r.gx) + Math.abs(m.y - r.gy));
  }
  return b;
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
  return null;
}

function bfsToChip(start: Runner, maxDepth: number): Direction[] | null {
  const need = start.playerState.chipsRemainingOnMap;
  const q: { seq: Direction[]; r: Runner }[] = [{ seq: [], r: start }];
  const seen = new Set([
    `${start.gx},${start.gy}|${need}|${start.buttonPressCtx.moveBoundary}|${start.monsters.map((m) => `${m.x},${m.y}`).join(";")}`,
  ]);
  let nodes = 0;
  while (q.length && nodes < 80_000) {
    const f = q.shift()!;
    nodes++;
    if (f.seq.length > 0 && f.r.playerState.chipsRemainingOnMap < need) return f.seq;
    if (f.seq.length >= maxDepth) continue;
    for (const d of DIRS) {
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

function pickChipOrFlee(r: Runner, prefer: Direction | null): Direction | null {
  const td0 = teethDist(r);
  const opts: { d: Direction; chip: boolean; td: number; straight: boolean }[] = [];
  for (const d of DIRS) {
    const n = tryStep(r, d);
    if (!n || (n.gx === r.gx && n.gy === r.gy)) continue;
    if (teethDist(n) === 0) continue;
    opts.push({
      d,
      chip: n.playerState.chipsRemainingOnMap < r.playerState.chipsRemainingOnMap,
      td: teethDist(n),
      straight: d === prefer,
    });
  }
  if (!opts.length) return null;
  opts.sort((a, b) => {
    if (td0 <= 2) {
      if (a.td !== b.td) return b.td - a.td;
      return a.chip === b.chip ? 0 : a.chip ? -1 : 1;
    }
    if (a.chip !== b.chip) return a.chip ? -1 : 1;
    if (a.straight !== b.straight) return a.straight ? -1 : 1;
    return b.td - a.td;
  });
  if (opts[0]!.chip || td0 <= 2) return opts[0]!.d;
  return null;
}

const level = loadLevel();
const tws = JSON.parse(fs.readFileSync(engSol, "utf8")).twsRecords as {
  direction: number;
}[];
const twsDirs = tws.map((r) => TWS_DIR[r.direction]!);

let runner = createMsCc1SimulationRunner(structuredClone(level));
const route: Direction[] = [];
let prefer: Direction | null = null;
let twsIdx = 0;
let waste = 0;

function go(d: Direction): boolean {
  const before = runner.playerState.chipsRemainingOnMap;
  const n = tryStep(runner, d);
  if (!n) return false;
  if (n.playerState.chipsRemainingOnMap >= before && !n.completed) waste++;
  route.push(d);
  runner = n;
  prefer = d;
  return true;
}

// Follow TWS while safe (next move survives and teethDist after >= 1)
while (twsIdx < twsDirs.length && runner.playerState.chipsRemainingOnMap > 0 && route.length < 750) {
  const d = twsDirs[twsIdx]!;
  const n = tryStep(runner, d);
  if (n && teethDist(n) >= 1) {
    go(d);
    twsIdx++;
    continue;
  }
  // Dodge: find short path that collects or flees, then try to resync TWS
  const dodge = pickChipOrFlee(runner, prefer);
  if (dodge) {
    go(dodge);
    // skip TWS moves until we're roughly near expected or just advance index slowly
    // Try to find a future TWS direction that matches a safe move from here
    let synced = false;
    for (let look = twsIdx; look < Math.min(twsIdx + 30, twsDirs.length); look++) {
      const td = twsDirs[look]!;
      const nn = tryStep(runner, td);
      if (nn && teethDist(nn) >= 1) {
        twsIdx = look;
        synced = true;
        break;
      }
    }
    if (!synced) twsIdx++;
    continue;
  }
  const seq = bfsToChip(runner, 25);
  if (!seq) break;
  for (const x of seq) {
    if (!go(x)) break;
  }
  twsIdx++;
  if (route.length % 50 === 0) {
    console.log("tws-hybrid", route.length, "twsIdx", twsIdx, "chips", runner.playerState.chipsRemainingOnMap, "waste", waste);
  }
}

console.log("after tws phase", {
  moves: route.length,
  twsIdx,
  chips: runner.playerState.chipsRemainingOnMap,
  waste,
  pos: `${runner.gx},${runner.gy}`,
});

// Finish with greedy
while (runner.playerState.chipsRemainingOnMap > 0 && route.length < 780) {
  const d = pickChipOrFlee(runner, prefer);
  if (d) {
    if (!go(d)) break;
  } else {
    const seq = bfsToChip(runner, 35);
    if (!seq) {
      console.error("stuck", runner.playerState.chipsRemainingOnMap, `${runner.gx},${runner.gy}`);
      break;
    }
    for (const x of seq) if (!go(x)) break;
  }
}

console.log("collect done", {
  chips: runner.playerState.chipsRemainingOnMap,
  moves: route.length,
  waste,
});

if (runner.playerState.chipsRemainingOnMap === 0 && !runner.completed) {
  const ex = bfsExit(runner);
  if (!ex) {
    console.error("no exit");
    process.exit(1);
  }
  for (const d of ex) go(d);
}

// Verify
let r = createMsCc1SimulationRunner(structuredClone(level));
for (const d of route) {
  stepMsCc1Simulation(r, d);
  if (r.playerDied) {
    console.error("verify death");
    process.exit(1);
  }
  if (r.completed) break;
}
const rem = msSecondsRemaining(400, r.buttonPressCtx.moveBoundary);
console.log({
  completed: r.completed,
  moves: route.length,
  ticks: r.buttonPressCtx.moveBoundary,
  rem,
  exact270: rem === 270,
});

if (r.completed) {
  const existing = JSON.parse(fs.readFileSync(webSolPath, "utf8"));
  // Only overwrite if better rem (higher = closer to bold / better)
  if (!existing.moveVerified || (existing.simulatedSecondsRemaining ?? 0) < rem) {
    const entry = {
      levelId: "level-012",
      passwordMs: "WVHI",
      title: "Hunt",
      timeLimitSeconds: 400,
      boldTimeRemaining: 270,
      minChipMoves: 130,
      moves: encodeSolutionMoves(route),
      source: "https://scores.bitbusters.club/levels/cc1/12/ms",
      walkthroughUrl: "https://strategywiki.org/wiki/Chip%27s_Challenge/Levels_1-20",
      boldRouteHint:
        "TWS-guided + dodge, then greedy; chipsRequired 652; lodge/center per StrategyWiki",
      moveVerified: rem === 270,
      meetsBoldBudget: rem >= 270,
      moveSource: `TWS-hybrid verified; rem ${rem} (bold 270); waste ${waste}`,
      simulatedTicks: r.buttonPressCtx.moveBoundary,
      simulatedSecondsRemaining: rem,
    };
    fs.writeFileSync(webSolPath, `${JSON.stringify(entry, null, 2)}\n`);
    console.log("wrote rem", rem);
  } else {
    console.log("kept existing better/equal route");
  }
}
