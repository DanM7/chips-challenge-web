/**
 * Hunt spiral collector: row-major serpentine with minimal deviation.
 * Leaves awkward chips; aims for near-zero waste then short exit.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { Direction, LevelData } from "../engine/types.js";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
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

function isChip(r: Runner, x: number, y: number): boolean {
  return getCompositeTile(r.level, x, y) === "chip";
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

function verify(level: LevelData, moves: Direction[]) {
  let r = createMsCc1SimulationRunner(structuredClone(level));
  for (const d of moves) {
    stepMsCc1Simulation(r, d);
    if (r.playerDied) return { ok: false, r };
    if (r.completed) return { ok: true, r };
  }
  return { ok: r.completed, r };
}

function bfsExit(start: Runner): Direction[] | null {
  const q: { seq: Direction[]; r: Runner }[] = [{ seq: [], r: start }];
  const seen = new Set([`${start.gx},${start.gy}|${start.monsters.map((m) => `${m.x},${m.y}`).join(";")}`]);
  while (q.length) {
    const f = q.shift()!;
    if (f.r.completed) return f.seq;
    if (f.seq.length >= 40) continue;
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

function bfsTo(
  start: Runner,
  maxDepth: number,
  done: (r: Runner) => boolean,
): Direction[] | null {
  const q: { seq: Direction[]; r: Runner }[] = [{ seq: [], r: start }];
  const seen = new Set([
    `${start.gx},${start.gy}|${start.playerState.chipsRemainingOnMap}|${start.buttonPressCtx.moveBoundary}|${start.monsters.map((m) => `${m.x},${m.y}`).join(";")}`,
  ]);
  let nodes = 0;
  while (q.length && nodes < 120_000) {
    const f = q.shift()!;
    nodes++;
    if (f.seq.length > 0 && done(f.r)) return f.seq;
    if (f.seq.length >= maxDepth) continue;
    for (const d of DIRS) {
      const n = tryStep(f.r, d);
      if (!n) continue;
      if (n.gx === f.r.gx && n.gy === f.r.gy && !n.completed) continue;
      const k = `${n.gx},${n.gy}|${n.playerState.chipsRemainingOnMap}|${n.buttonPressCtx.moveBoundary}|${n.monsters.map((m) => `${m.x},${m.y}`).join(";")}`;
      if (seen.has(k)) continue;
      seen.add(k);
      if (done(n)) return [...f.seq, d];
      q.push({ seq: [...f.seq, d], r: n });
    }
  }
  return null;
}

/**
 * Build target path: for each row y=1..30, sweep x left-right or right-left
 * skipping walls and center socket block until chipsRemaining hits 0.
 * Execute with local teeth dodges.
 */
function buildRowOrder(): { x: number; y: number }[] {
  const order: { x: number; y: number }[] = [];
  // Outer rows first, then inward — leave center for last
  const rowsOuter = [1, 2, 3, 4, 5, 6, 7, 30, 29, 28, 27, 26, 25, 24, 23];
  const rowsMid = [8, 9, 10, 11, 12, 13, 22, 21, 20, 19, 18];
  const rowsCenter = [14, 15, 16, 17];
  for (const rows of [rowsOuter, rowsMid, rowsCenter]) {
    for (let ri = 0; ri < rows.length; ri++) {
      const y = rows[ri]!;
      const leftToRight = ri % 2 === 0;
      const xs = leftToRight
        ? Array.from({ length: 30 }, (_, i) => i + 1)
        : Array.from({ length: 30 }, (_, i) => 30 - i);
      for (const x of xs) {
        // skip socket/exit cells
        if (x >= 15 && x <= 16 && y >= 14 && y <= 17) continue;
        order.push({ x, y });
      }
    }
  }
  return order;
}

const level = loadLevel();
let runner = createMsCc1SimulationRunner(structuredClone(level));
const route: Direction[] = [];
let waste = 0;

function go(d: Direction): boolean {
  const before = runner.playerState.chipsRemainingOnMap;
  const n = tryStep(runner, d);
  if (!n) return false;
  if (n.playerState.chipsRemainingOnMap >= before && !n.completed) waste++;
  route.push(d);
  runner = n;
  return true;
}

for (const d of expand("U 12L 4U 3R 2D")) {
  if (!go(d)) {
    console.error("open fail");
    process.exit(1);
  }
}
console.log("open", route.length, runner.playerState.chipsRemainingOnMap);

const order = buildRowOrder();
let oi = 0;

while (runner.playerState.chipsRemainingOnMap > 0 && oi < order.length && route.length < 750) {
  // Skip targets that are no longer chips
  while (oi < order.length && !isChip(runner, order[oi]!.x, order[oi]!.y)) oi++;
  if (oi >= order.length) break;

  const target = order[oi]!;
  // If adjacent to target and safe, step there
  const dx = target.x - runner.gx;
  const dy = target.y - runner.gy;
  let stepped = false;
  if (Math.abs(dx) + Math.abs(dy) === 1) {
    const d: Direction = dx === 1 ? "right" : dx === -1 ? "left" : dy === 1 ? "down" : "up";
    const n = tryStep(runner, d);
    if (n && teethDist(n) >= 1) {
      go(d);
      stepped = true;
      if (!isChip(runner, target.x, target.y) || (runner.gx === target.x && runner.gy === target.y)) oi++;
    }
  }
  if (!stepped) {
    // BFS to this chip if still present, else next
    if (!isChip(runner, target.x, target.y)) {
      oi++;
      continue;
    }
    const tx = target.x;
    const ty = target.y;
    const need = runner.playerState.chipsRemainingOnMap;
    // Prefer any chip collection if teeth close
    const seq =
      teethDist(runner) <= 3
        ? bfsTo(runner, 25, (r) => r.playerState.chipsRemainingOnMap < need || teethDist(r) > teethDist(runner))
        : bfsTo(
            runner,
            40,
            (r) =>
              (r.gx === tx && r.gy === ty) ||
              r.playerState.chipsRemainingOnMap < need,
          );
    if (!seq || !seq.length) {
      oi++;
      continue;
    }
    for (const d of seq) {
      if (!go(d)) break;
      if (runner.playerState.chipsRemainingOnMap === 0) break;
    }
    oi++;
  }
  if (route.length % 100 === 0) {
    console.log(route.length, "chips", runner.playerState.chipsRemainingOnMap, "waste", waste, "oi", oi, "td", teethDist(runner));
  }
}

// Finish remaining chips greedily
while (runner.playerState.chipsRemainingOnMap > 0 && route.length < 780) {
  const need = runner.playerState.chipsRemainingOnMap;
  const seq = bfsTo(runner, 40, (r) => r.playerState.chipsRemainingOnMap < need);
  if (!seq) {
    console.error("stuck", need, `${runner.gx},${runner.gy}`);
    break;
  }
  for (const d of seq) if (!go(d)) break;
}

console.log("collect", { chips: runner.playerState.chipsRemainingOnMap, moves: route.length, waste, pos: `${runner.gx},${runner.gy}` });

if (runner.playerState.chipsRemainingOnMap === 0 && !runner.completed) {
  const ex = bfsExit(runner);
  if (!ex) {
    console.error("no exit");
    process.exit(1);
  }
  console.log("exit", ex.length);
  for (const d of ex) go(d);
}

const v = verify(level, route);
const rem = msSecondsRemaining(400, v.r.buttonPressCtx.moveBoundary);
console.log({ ok: v.ok, moves: route.length, ticks: v.r.buttonPressCtx.moveBoundary, rem, waste });

if (v.ok) {
  const existing = JSON.parse(fs.readFileSync(webSolPath, "utf8"));
  if ((existing.simulatedSecondsRemaining ?? 0) < rem) {
    fs.writeFileSync(
      webSolPath,
      `${JSON.stringify(
        {
          levelId: "level-012",
          passwordMs: "WVHI",
          title: "Hunt",
          timeLimitSeconds: 400,
          boldTimeRemaining: 270,
          minChipMoves: 130,
          moves: encodeSolutionMoves(route),
          source: "https://scores.bitbusters.club/levels/cc1/12/ms",
          walkthroughUrl: "https://strategywiki.org/wiki/Chip%27s_Challenge/Levels_1-20",
          boldRouteHint: "row-order spiral + teeth dodge; chipsRequired 652",
          moveVerified: rem === 270,
          meetsBoldBudget: rem >= 270,
          moveSource: `row-order spiral verified; rem ${rem} (bold 270); waste ${waste}`,
          simulatedTicks: v.r.buttonPressCtx.moveBoundary,
          simulatedSecondsRemaining: rem,
        },
        null,
        2,
      )}\n`,
    );
    console.log("wrote better rem", rem);
  } else {
    console.log("not better than", existing.simulatedSecondsRemaining);
  }
}
