/**
 * Level 19 Digger — survive past TWS death at move 69, seek rem 171.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  cloneMsCc1SimulationRunner,
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  type MsCc1SimulationRunner,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import type { Direction, LevelData } from "../engine/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webSol = path.join(
  root,
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/data/cc1-ms-solutions/level-019.json",
);
const level = JSON.parse(
  readFileSync(
    path.join(
      root,
      "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-019.json",
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

const DIRS: Direction[] = ["up", "down", "left", "right"];
const LETTER: Record<Direction, string> = {
  up: "U",
  down: "D",
  left: "L",
  right: "R",
};

function expand(route: string): Direction[] {
  const out: Direction[] = [];
  const re = /(\d+)?([UDLR])/g;
  let m: RegExpExecArray | null;
  const map: Record<string, Direction> = {
    U: "up",
    D: "down",
    L: "left",
    R: "right",
  };
  while ((m = re.exec(route.replace(/\s/g, ""))) !== null) {
    const n = m[1] ? Number(m[1]) : 1;
    for (let i = 0; i < n; i++) out.push(map[m[2]!]!);
  }
  return out;
}

function apply(runner: MsCc1SimulationRunner, dir: Direction): MsCc1SimulationRunner {
  const r = cloneMsCc1SimulationRunner(runner);
  stepMsCc1Simulation(r, dir);
  return r;
}

function runMoves(moves: Direction[], parity: "even" | "odd" = "odd"): MsCc1SimulationRunner {
  const r = createMsCc1SimulationRunner(structuredClone(level));
  r.buttonPressCtx.stepParity = parity;
  for (const d of moves) {
    stepMsCc1Simulation(r, d);
    if (r.playerDied || r.completed) break;
  }
  return r;
}

// Alive prefix: up through 4D4U (TWS dies on following L)
const prefix = expand("11D8R9U6L3D3U11R3D6R4D4U");
const start = runMoves(prefix);
console.log("start", {
  pos: `${start.gx},${start.gy}`,
  chips: start.playerState.chipsRemainingOnMap,
  mb: start.buttonPressCtx.moveBoundary,
  died: start.playerDied,
  monsters: start.monsters.filter((m) => m.alive).map((m) => `${m.x},${m.y}${m.direction[0]}`),
});

// Confirm L dies
const left = apply(start, "left");
console.log("L dies?", left.playerDied, `${left.gx},${left.gy}`);

type Item = { r: MsCc1SimulationRunner; path: Direction[] };
const queue: Item[] = [{ r: start, path: [] }];
const seen = new Set<string>();

function stateKey(rr: MsCc1SimulationRunner): string {
  // Omit exact mb; keep parity via mb%2 and positions
  const mons = rr.monsters
    .filter((m) => m.alive)
    .map((m) => `${m.x},${m.y}${m.direction[0]}`)
    .join(";");
  return `${rr.gx},${rr.gy}|${rr.playerState.chipsRemainingOnMap}|${mons}|${rr.buttonPressCtx.moveBoundary % 2}`;
}
seen.add(stateKey(start));

let bestWin: { moves: Direction[]; rem: number; mb: number } | null = null;
let farthest: { chips: number; pathLen: number; pos: string } = {
  chips: start.playerState.chipsRemainingOnMap,
  pathLen: 0,
  pos: `${start.gx},${start.gy}`,
};
let expanded = 0;
const MAX = 800_000;

while (queue.length && expanded < MAX) {
  const { r: cur, path } = queue.shift()!;
  expanded++;

  if (cur.playerState.chipsRemainingOnMap < farthest.chips) {
    farthest = {
      chips: cur.playerState.chipsRemainingOnMap,
      pathLen: path.length,
      pos: `${cur.gx},${cur.gy}`,
    };
    if (farthest.chips % 10 === 0 || farthest.chips < 20) {
      console.log("farthest", farthest, "mb", cur.buttonPressCtx.moveBoundary, "exp", expanded);
    }
  }

  if (cur.completed) {
    const rem = msSecondsRemaining(210, cur.buttonPressCtx.moveBoundary);
    const moves = prefix.concat(path);
    console.log("WIN moves", moves.length, "rem", rem, "mb", cur.buttonPressCtx.moveBoundary);
    if (!bestWin || rem > bestWin.rem) {
      bestWin = { moves, rem, mb: cur.buttonPressCtx.moveBoundary };
    }
    if (rem >= 171) break;
    continue;
  }

  if (cur.playerDied) continue;
  if (path.length > 320) continue;
  if (cur.buttonPressCtx.moveBoundary > 250) continue;

  for (const d of DIRS) {
    const nr = apply(cur, d);
    if (nr.playerDied) continue;
    if (nr.gx === cur.gx && nr.gy === cur.gy) continue; // wall bump no-op in our engine
    const k = stateKey(nr);
    if (seen.has(k)) continue;
    seen.add(k);
    queue.push({ r: nr, path: [...path, d] });
  }
}

console.log({
  expanded,
  seen: seen.size,
  queue: queue.length,
  farthest,
  bestWin: bestWin
    ? { len: bestWin.moves.length, rem: bestWin.rem, mb: bestWin.mb, meets: bestWin.rem >= 171 }
    : null,
});

if (bestWin) {
  const verify = runMoves(bestWin.moves);
  const rem = msSecondsRemaining(210, verify.buttonPressCtx.moveBoundary);
  console.log("verify", {
    completed: verify.completed,
    died: verify.playerDied,
    rem,
    mb: verify.buttonPressCtx.moveBoundary,
  });
  const letters = bestWin.moves.map((d) => LETTER[d]);
  const existing = JSON.parse(readFileSync(webSol, "utf8")) as Record<string, unknown>;
  const meets = rem >= 171;
  const exact = rem === 171;
  const out = {
    ...existing,
    moves: letters,
    walkthroughUrl: "https://strategywiki.org/wiki/Chip%27s_Challenge/Levels_1-20",
    boldRouteHint:
      "Odd step; TWS-hybrid opening then engine search past teeth; collect chips; exit",
    moveVerified: verify.completed && !verify.playerDied,
    meetsBoldBudget: meets,
    moveSource: `Engine BFS Digger odd-step; ${rem}s remaining (bold 171)`,
    simulatedTicks: verify.buttonPressCtx.moveBoundary,
    simulatedSecondsRemaining: rem,
    stepParity: "odd",
  };
  // Only write if completed; prefer exact 171 but write best if completed
  if (verify.completed && !verify.playerDied) {
    writeFileSync(webSol, JSON.stringify(out, null, 2) + "\n");
    console.log("WROTE", webSol, "moves", letters.length, "exact171", exact);
  }
}
