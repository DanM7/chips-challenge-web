/**
 * Hunt serpentine: snake top rows, lodge teeth, snake rest, dive center, exit.
 */
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import {
  cloneMsCc1SimulationRunner,
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { decodeSolutionMoves, encodeSolutionMoves } from "../engine/solutionMoves.js";
import type { Direction, LevelData } from "../engine/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const level = JSON.parse(
  readFileSync(
    path.join(
      root,
      "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-012.json",
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

type Runner = ReturnType<typeof createMsCc1SimulationRunner>;
const DIRS: Direction[] = ["up", "down", "left", "right"];

function chipAt(r: Runner, x: number, y: number): boolean {
  return getCompositeTile(r.level, x, y) === "chip";
}

function tryDir(r: Runner, d: Direction): Runner | null {
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

function nearestChip(r: Runner, pred: (x: number, y: number) => boolean): { x: number; y: number } | null {
  let best: { x: number; y: number; d: number } | null = null;
  for (let y = 1; y <= 30; y++) {
    for (let x = 1; x <= 30; x++) {
      if (!chipAt(r, x, y) || !pred(x, y)) continue;
      const d = Math.abs(x - r.gx) + Math.abs(y - r.gy);
      if (!best || d < best.d || (d === best.d && y < best.y) || (d === best.d && y === best.y && x < best.x)) {
        best = { x, y, d };
      }
    }
  }
  return best;
}

function stepToward(r: Runner, tx: number, ty: number): { r: Runner; d: Direction } | null {
  const opts: Direction[] = [];
  if (ty < r.gy) opts.push("up");
  if (ty > r.gy) opts.push("down");
  if (tx < r.gx) opts.push("left");
  if (tx > r.gx) opts.push("right");
  for (const d of [...opts, ...DIRS]) {
    const n = tryDir(r, d);
    if (!n) continue;
    if (n.gx === r.gx && n.gy === r.gy) continue;
    if (teethDist(n) === 0) continue;
    return { r: n, d };
  }
  return null;
}

const route: Direction[] = [];
let r = createMsCc1SimulationRunner(structuredClone(level));

function go(d: Direction): boolean {
  const n = tryDir(r, d);
  if (!n) return false;
  r = n;
  route.push(d);
  return true;
}

// SW open: U 12L 4U 3R 2D
for (const d of decodeSolutionMoves([..."U", ..."LLLLLLLLLLLL", ..."UUUU", ..."RRR", ..."DD"]) as Direction[]) {
  if (!go(d)) {
    console.log("open fail", d, `${r.gx},${r.gy}`, r.deathMessage);
    break;
  }
}
console.log("after open", `${r.gx},${r.gy}`, "chips", r.playerState.chipsRemainingOnMap, "teeth", r.monsters.map((m) => `${m.x},${m.y}`));

function snakeRows(y0: number, y1: number, skip: (x: number, y: number) => boolean) {
  for (let y = y0; y <= y1; y++) {
    const leftToRight = (y - y0) % 2 === 0;
    const xs = [];
    for (let x = 1; x <= 30; x++) xs.push(x);
    if (!leftToRight) xs.reverse();
    for (const x of xs) {
      if (r.completed || r.playerState.chipsRemainingOnMap <= 180) return;
      if (!chipAt(r, x, y) || skip(x, y)) continue;
      let guard = 0;
      while ((r.gx !== x || r.gy !== y) && guard++ < 80) {
        const s = stepToward(r, x, y);
        if (!s) {
          console.log("stuck toward", x, y, "at", r.gx, r.gy, "td", teethDist(r));
          return;
        }
        r = s.r;
        route.push(s.d);
        if (r.completed) return;
      }
    }
  }
}

const corners = (x: number, y: number) =>
  (x <= 2 && y <= 2) || (x >= 29 && y <= 2) || (x <= 2 && y >= 29) || (x >= 29 && y >= 29);

snakeRows(1, 7, corners);
console.log("after top", `${r.gx},${r.gy}`, "chips", r.playerState.chipsRemainingOnMap, "ticks", r.buttonPressCtx.moveBoundary, "len", route.length, "teeth", r.monsters.map((m) => `${m.x},${m.y}`));

// Lodge: run along y=1 29R if we're near top
if (r.gy <= 3 && r.playerState.chipsRemainingOnMap > 200) {
  while (r.gx < 30 && route.length < 900) {
    if (!go("right")) break;
  }
  console.log("lodge", `${r.gx},${r.gy}`, "teeth", r.monsters.map((m) => `${m.x},${m.y}:${m.direction}`), "td", teethDist(r));
}

snakeRows(24, 30, corners);
console.log("after bottom", `${r.gx},${r.gy}`, "chips", r.playerState.chipsRemainingOnMap, "ticks", r.buttonPressCtx.moveBoundary);

// remaining: anything except center 9-22 x 9-22 until ~180 left, then center
while (r.playerState.chipsRemainingOnMap > 180 && !r.completed && route.length < 1200) {
  const t = nearestChip(r, (x, y) => !(x >= 9 && x <= 22 && y >= 9 && y <= 22) && !corners(x, y));
  if (!t) break;
  const s = stepToward(r, t.x, t.y);
  if (!s) break;
  r = s.r;
  route.push(s.d);
}
console.log("before center", `${r.gx},${r.gy}`, "chips", r.playerState.chipsRemainingOnMap, "ticks", r.buttonPressCtx.moveBoundary);

while (r.playerState.chipsRemainingOnMap > 0 && !r.completed && route.length < 1600) {
  const t = nearestChip(r, () => true);
  if (!t) break;
  const s = stepToward(r, t.x, t.y);
  if (!s) {
    console.log("stuck chips", r.playerState.chipsRemainingOnMap, `${r.gx},${r.gy}`, "td", teethDist(r));
    break;
  }
  r = s.r;
  route.push(s.d);
}
console.log("chips0", `${r.gx},${r.gy}`, "chips", r.playerState.chipsRemainingOnMap, "completed", r.completed, "ticks", r.buttonPressCtx.moveBoundary);

if (r.playerState.chipsRemainingOnMap === 0 && !r.completed) {
  // walk to nearest socket/exit
  const goals: [number, number][] = [];
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++) {
      const t = getCompositeTile(r.level, x, y);
      if (t === "exit" || t === "socket") goals.push([x, y]);
    }
  let guard = 0;
  while (!r.completed && guard++ < 80) {
    let best: [number, number] | null = null;
    let bd = 99;
    for (const [x, y] of goals) {
      const d = Math.abs(x - r.gx) + Math.abs(y - r.gy);
      if (d < bd) {
        bd = d;
        best = [x, y];
      }
    }
    if (!best) break;
    const s = stepToward(r, best[0], best[1]);
    if (!s) break;
    r = s.r;
    route.push(s.d);
  }
}

const rem = msSecondsRemaining(400, r.buttonPressCtx.moveBoundary);
console.log("FINAL", {
  completed: r.completed,
  died: r.playerDied,
  death: r.deathMessage,
  chips: r.playerState.chipsRemainingOnMap,
  len: route.length,
  ticks: r.buttonPressCtx.moveBoundary,
  rem,
});

if (r.completed && rem >= 266) {
  const webPath = path.join(
    root,
    "../../apps/chips-challenge-web/public/games/chips-challenge-1/data/cc1-ms-solutions/level-012.json",
  );
  const entry = JSON.parse(readFileSync(webPath, "utf8"));
  if ((entry.simulatedSecondsRemaining ?? 0) <= rem) {
    entry.moves = encodeSolutionMoves(route);
    entry.moveVerified = rem === 270;
    entry.meetsBoldBudget = rem >= 270;
    entry.simulatedTicks = r.buttonPressCtx.moveBoundary;
    entry.simulatedSecondsRemaining = rem;
    entry.moveSource = `serpentine greedy; rem ${rem} (bold 270)`;
    writeFileSync(webPath, `${JSON.stringify(entry, null, 2)}\n`);
    console.log("wrote hunt", rem);
  }
}
