import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
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

function run(moves: Direction[], parity: "even" | "odd" = "odd"): MsCc1SimulationRunner {
  const r = createMsCc1SimulationRunner(structuredClone(level));
  r.buttonPressCtx.stepParity = parity;
  for (const d of moves) {
    stepMsCc1Simulation(r, d);
    if (r.playerDied || r.completed) break;
  }
  return r;
}

function apply(r: MsCc1SimulationRunner, d: Direction): MsCc1SimulationRunner {
  const n = cloneMsCc1SimulationRunner(r);
  stepMsCc1Simulation(n, d);
  return n;
}

function summary(label: string, r: MsCc1SimulationRunner) {
  console.log(
    label,
    `pos=${r.gx},${r.gy} chips=${r.playerState.chipsRemainingOnMap} mb=${r.buttonPressCtx.moveBoundary} rem=${msSecondsRemaining(210, r.buttonPressCtx.moveBoundary)} died=${r.playerDied}${r.deathMessage ? ":" + r.deathMessage : ""} done=${r.completed}`,
  );
}

// Best surviving scripted prefix so far
const prefixStr =
  "11D8R9U6L3D3U11R4DR5U5L5D8RL7D8L2U";
const prefix = expand(prefixStr);
const start = run(prefix);
summary("prefix", start);

// Try SW continuation variants from here
for (const cont of [
  "4D5LUD8LD",
  "4D5LUD8LDU",
  "5D5LUD8LD",
  "3D5LUD8LD",
  "4D5LU2D8LD",
  "4D4LUD8LD",
  "4D6LUD8LD",
  "4D5L2U8LD",
  "4D5LD8LD",
  "2D5LUD8LD",
  "4D5LUD7LD",
  "4D5LUD9LD",
  "4D5LUD8L2D",
  "4D5LUD8L",
  "D5LUD8LD",
  "4D5LU8LD",
  "4D5L8LD",
]) {
  const r = run(expand(prefixStr + cont));
  summary("cont " + cont, r);
}

// Also try full TWS from surviving mid: 11D8R9U6L3D3U11R3D6R4D4U6L2D5U...
const sol = JSON.parse(
  readFileSync(path.join(root, "integration/data/cc1-ms-solutions/level-019.json"), "utf8"),
) as { twsRecords: { direction: number }[] };
const TWS_DIR: Direction[] = ["up", "left", "down", "right"];
const tws = sol.twsRecords
  .map((r) => TWS_DIR[r.direction])
  .filter((d): d is Direction => !!d);

for (const parity of ["odd", "even"] as const) {
  const r = run(tws, parity);
  summary("fullTWS " + parity, r);
}

// BFS from scripted prefix to finish
type Item = { r: MsCc1SimulationRunner; path: Direction[] };
const queue: Item[] = [{ r: start, path: [] }];
const seen = new Set<string>();
function key(r: MsCc1SimulationRunner): string {
  const m = r.monsters
    .filter((x) => x.alive)
    .map((x) => `${x.x},${x.y}${x.direction[0]}`)
    .join(";");
  return `${r.gx},${r.gy}|${r.playerState.chipsRemainingOnMap}|${m}|${r.buttonPressCtx.moveBoundary % 2}`;
}
seen.add(key(start));

let best: { moves: Direction[]; rem: number } | null = null;
let farthest = start.playerState.chipsRemainingOnMap;
let expanded = 0;
const MAX = 2_000_000;

while (queue.length && expanded < MAX) {
  const { r, path } = queue.shift()!;
  expanded++;
  if (r.playerState.chipsRemainingOnMap < farthest) {
    farthest = r.playerState.chipsRemainingOnMap;
    if (farthest % 5 === 0 || farthest <= 15) {
      console.log(
        "farthest chips",
        farthest,
        "at",
        `${r.gx},${r.gy}`,
        "path",
        path.length,
        "mb",
        r.buttonPressCtx.moveBoundary,
        "exp",
        expanded,
      );
    }
  }
  if (r.completed) {
    const rem = msSecondsRemaining(210, r.buttonPressCtx.moveBoundary);
    console.log("WIN len", prefix.length + path.length, "rem", rem);
    const moves = prefix.concat(path);
    if (!best || rem > best.rem) best = { moves, rem };
    if (rem === 171) break;
    if (rem > 171) {
      // keep searching for exact? or accept and trim waits — no waits. continue for exact
    }
    continue;
  }
  if (r.playerDied || path.length > 250) continue;
  // bold budget: need rem 171 => mb <= 199; allow a little slack while searching
  if (r.buttonPressCtx.moveBoundary > 210) continue;

  for (const d of DIRS) {
    const nr = apply(r, d);
    if (nr.playerDied) continue;
    if (nr.gx === r.gx && nr.gy === r.gy) continue;
    const k = key(nr);
    if (seen.has(k)) continue;
    seen.add(k);
    queue.push({ r: nr, path: [...path, d] });
  }
}

console.log({
  expanded,
  seen: seen.size,
  farthest,
  best: best ? { len: best.moves.length, rem: best.rem } : null,
});

if (best) {
  const v = run(best.moves);
  const rem = msSecondsRemaining(210, v.buttonPressCtx.moveBoundary);
  summary("verify", v);
  if (v.completed) {
    const existing = JSON.parse(readFileSync(webSol, "utf8")) as Record<string, unknown>;
    const letters = best.moves.map((d) => LETTER[d]);
    // If rem > 171, we could pad with wall-bumps but engine no-ops those.
    // Exact 171 requires mb in [195,199].
    const out = {
      ...existing,
      moves: letters,
      walkthroughUrl: "https://strategywiki.org/wiki/Chip%27s_Challenge/Levels_1-20",
      boldRouteHint:
        "Odd step; SW/TWS hybrid opening + teeth dodges; engine BFS chip cleanup → exit",
      moveVerified: true,
      meetsBoldBudget: rem >= 171,
      moveSource: `Engine search Digger odd-step; ${rem}s remaining (bold 171)`,
      simulatedTicks: v.buttonPressCtx.moveBoundary,
      simulatedSecondsRemaining: rem,
      stepParity: "odd",
    };
    writeFileSync(webSol, JSON.stringify(out, null, 2) + "\n");
    console.log("WROTE moves", letters.length, "rem", rem, "exact171", rem === 171);
  }
}
