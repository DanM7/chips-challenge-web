/**
 * Digger bold: stay on chip corridors (teeth blocked by chips), odd step.
 * Target rem === 171 (mb in 195..199).
 */
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

function isChip(t: string | undefined): boolean {
  return !!t && t.startsWith("chip");
}

function apply(r: MsCc1SimulationRunner, d: Direction): MsCc1SimulationRunner {
  const n = cloneMsCc1SimulationRunner(r);
  stepMsCc1Simulation(n, d);
  return n;
}

function key(r: MsCc1SimulationRunner): string {
  const m = r.monsters
    .filter((x) => x.alive)
    .map((x) => `${x.x},${x.y}${x.direction[0]}`)
    .join(";");
  return `${r.gx},${r.gy}|${r.playerState.chipsRemainingOnMap}|${m}|${r.buttonPressCtx.moveBoundary % 2}`;
}

const PARITY: "even" | "odd" = "odd";
const start = createMsCc1SimulationRunner(structuredClone(level));
start.buttonPressCtx.stepParity = PARITY;

type Item = {
  r: MsCc1SimulationRunner;
  path: Direction[];
};
// Priority-ish: BFS but prefer chip-collecting edges via 0-1 BFS
const q: Item[] = [{ r: start, path: [] }];
const seen = new Set([key(start)]);
let bestWin: { path: Direction[]; rem: number; mb: number } | null = null;
let farthest = 146;
let expanded = 0;
const MAX = 3_000_000;

while (q.length && expanded < MAX) {
  const { r, path } = q.shift()!;
  expanded++;

  if (r.playerState.chipsRemainingOnMap < farthest) {
    farthest = r.playerState.chipsRemainingOnMap;
    if (farthest % 10 === 0 || farthest <= 20) {
      console.log(
        "chips",
        farthest,
        "pos",
        `${r.gx},${r.gy}`,
        "mb",
        r.buttonPressCtx.moveBoundary,
        "rem",
        msSecondsRemaining(210, r.buttonPressCtx.moveBoundary),
        "exp",
        expanded,
        "q",
        q.length,
      );
    }
  }

  if (r.completed) {
    const rem = msSecondsRemaining(210, r.buttonPressCtx.moveBoundary);
    console.log("WIN", path.length, "rem", rem, "mb", r.buttonPressCtx.moveBoundary);
    if (!bestWin || Math.abs(rem - 171) < Math.abs(bestWin.rem - 171) || rem > bestWin.rem) {
      bestWin = { path, rem, mb: r.buttonPressCtx.moveBoundary };
    }
    if (rem === 171) break;
    continue;
  }

  if (r.playerDied) continue;
  if (path.length > 220) continue;
  if (r.buttonPressCtx.moveBoundary > 210) continue;

  // Order neighbors: chip-collecting first, then others
  const neigh: Array<{ d: Direction; nr: MsCc1SimulationRunner; pri: number }> = [];
  for (const d of DIRS) {
    const nr = apply(r, d);
    if (nr.playerDied) continue;
    if (nr.gx === r.gx && nr.gy === r.gy) continue;
    const collected = nr.playerState.chipsRemainingOnMap < r.playerState.chipsRemainingOnMap;
    const destChip = isChip(getCompositeTile(r.level, nr.gx, nr.gy)); // already collected though
    let pri = 2;
    if (collected) pri = 0;
    else if (nr.completed) pri = 0;
    else pri = 1;
    // Soft prefer staying near chips / lower y when going for exit
    void destChip;
    neigh.push({ d, nr, pri });
  }
  neigh.sort((a, b) => a.pri - b.pri);

  for (const { d, nr, pri } of neigh) {
    const k = key(nr);
    if (seen.has(k)) continue;
    seen.add(k);
    const item = { r: nr, path: [...path, d] };
    if (pri === 0) q.unshift(item);
    else q.push(item);
  }
}

console.log({
  expanded,
  seen: seen.size,
  farthest,
  bestWin,
});

if (bestWin) {
  const v = createMsCc1SimulationRunner(structuredClone(level));
  v.buttonPressCtx.stepParity = PARITY;
  for (const d of bestWin.path) {
    stepMsCc1Simulation(v, d);
    if (v.playerDied || v.completed) break;
  }
  const rem = msSecondsRemaining(210, v.buttonPressCtx.moveBoundary);
  console.log("verify", { done: v.completed, rem, mb: v.buttonPressCtx.moveBoundary });
  const existing = JSON.parse(readFileSync(webSol, "utf8")) as Record<string, unknown>;
  writeFileSync(
    webSol,
    JSON.stringify(
      {
        ...existing,
        moves: bestWin.path.map((d) => LETTER[d]),
        walkthroughUrl: "https://strategywiki.org/wiki/Chip%27s_Challenge/Levels_1-20",
        boldRouteHint: "Odd step; chip-corridor priority search → exit",
        moveVerified: v.completed && !v.playerDied,
        meetsBoldBudget: rem >= 171,
        moveSource: `Engine chip-priority BFS Digger odd; ${rem}s remaining (bold 171)`,
        simulatedTicks: v.buttonPressCtx.moveBoundary,
        simulatedSecondsRemaining: rem,
        stepParity: PARITY,
      },
      null,
      2,
    ) + "\n",
  );
  console.log("WROTE rem", rem, "exact", rem === 171);
} else {
  console.log("NO WIN");
}
