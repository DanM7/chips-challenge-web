/**
 * Replay TWS (even) until just before death, then BFS to exit for rem>=171.
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
const sol = JSON.parse(
  readFileSync(path.join(root, "integration/data/cc1-ms-solutions/level-019.json"), "utf8"),
) as { twsRecords: { direction: number }[] };
const TWS_DIR: Direction[] = ["up", "left", "down", "right"];
const tws = sol.twsRecords
  .map((r) => TWS_DIR[r.direction])
  .filter((d): d is Direction => !!d);

function apply(r: MsCc1SimulationRunner, d: Direction): MsCc1SimulationRunner {
  const n = cloneMsCc1SimulationRunner(r);
  stepMsCc1Simulation(n, d);
  return n;
}

const PARITY: "even" | "odd" = "even";
const CUT = 200; // before death at 216

const prefix: Direction[] = [];
let start = createMsCc1SimulationRunner(structuredClone(level));
start.buttonPressCtx.stepParity = PARITY;
for (let i = 0; i < CUT; i++) {
  stepMsCc1Simulation(start, tws[i]!);
  prefix.push(tws[i]!);
  if (start.playerDied) {
    console.log("died in prefix at", i + 1);
    process.exit(1);
  }
}
console.log("BFS start", {
  pos: `${start.gx},${start.gy}`,
  chips: start.playerState.chipsRemainingOnMap,
  mb: start.buttonPressCtx.moveBoundary,
  rem: msSecondsRemaining(210, start.buttonPressCtx.moveBoundary),
});

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
const MAX = 1_500_000;

while (queue.length && expanded < MAX) {
  const { r, path } = queue.shift()!;
  expanded++;
  if (r.playerState.chipsRemainingOnMap < farthest) {
    farthest = r.playerState.chipsRemainingOnMap;
    if (farthest % 5 === 0 || farthest < 10) {
      console.log("chips", farthest, "path", path.length, "mb", r.buttonPressCtx.moveBoundary, "exp", expanded);
    }
  }
  if (r.completed) {
    const rem = msSecondsRemaining(210, r.buttonPressCtx.moveBoundary);
    console.log("WIN", prefix.length + path.length, "rem", rem);
    const moves = prefix.concat(path);
    if (!best || rem > best.rem) best = { moves, rem };
    if (rem >= 171) break;
    continue;
  }
  if (r.playerDied || path.length > 200) continue;
  if (r.buttonPressCtx.moveBoundary > 240) continue;

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

console.log({ expanded, seen: seen.size, farthest, best: best ? { len: best.moves.length, rem: best.rem } : null });

if (best) {
  const v = createMsCc1SimulationRunner(structuredClone(level));
  v.buttonPressCtx.stepParity = PARITY;
  for (const d of best.moves) {
    stepMsCc1Simulation(v, d);
    if (v.playerDied || v.completed) break;
  }
  const rem = msSecondsRemaining(210, v.buttonPressCtx.moveBoundary);
  console.log("verify", { done: v.completed, died: v.playerDied, rem, mb: v.buttonPressCtx.moveBoundary });
  if (v.completed) {
    const existing = JSON.parse(readFileSync(webSol, "utf8")) as Record<string, unknown>;
    const letters = best.moves.map((d) => LETTER[d]);
    const out = {
      ...existing,
      moves: letters,
      walkthroughUrl: "https://strategywiki.org/wiki/Chip%27s_Challenge/Levels_1-20",
      boldRouteHint: `Even step; TWS prefix ${CUT} + BFS finish`,
      moveVerified: true,
      meetsBoldBudget: rem >= 171,
      moveSource: `Engine TWS+BFS Digger; ${rem}s remaining (bold 171)`,
      simulatedTicks: v.buttonPressCtx.moveBoundary,
      simulatedSecondsRemaining: rem,
      stepParity: PARITY,
    };
    writeFileSync(webSol, JSON.stringify(out, null, 2) + "\n");
    console.log("WROTE", letters.length, "exact", rem === 171);
  }
}
