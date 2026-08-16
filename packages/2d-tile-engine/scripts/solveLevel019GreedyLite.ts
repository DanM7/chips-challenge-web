/**
 * Memory-light greedy: always take adjacent chip if safe; else short BFS to nearest chip/exit.
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

function sk(r: MsCc1SimulationRunner): string {
  const m = r.monsters
    .filter((x) => x.alive)
    .map((x) => `${x.x},${x.y}${x.direction[0]}`)
    .join(";");
  return `${r.gx},${r.gy}|${r.playerState.chipsRemainingOnMap}|${m}|${r.buttonPressCtx.moveBoundary % 2}`;
}

function findPath(
  start: MsCc1SimulationRunner,
  goal: (r: MsCc1SimulationRunner) => boolean,
  maxLen = 50,
  maxExp = 80_000,
): Direction[] | null {
  type Item = { r: MsCc1SimulationRunner; path: Direction[] };
  const q: Item[] = [{ r: start, path: [] }];
  const seen = new Set([sk(start)]);
  let exp = 0;
  while (q.length && exp < maxExp) {
    const { r, path } = q.shift()!;
    exp++;
    if (path.length && goal(r)) return path;
    if (path.length >= maxLen) continue;
    // Prefer chip-collecting moves
    const opts: Array<{ d: Direction; nr: MsCc1SimulationRunner; pri: number }> = [];
    for (const d of DIRS) {
      const nr = apply(r, d);
      if (nr.playerDied) continue;
      if (nr.gx === r.gx && nr.gy === r.gy) continue;
      const pri =
        nr.playerState.chipsRemainingOnMap < r.playerState.chipsRemainingOnMap || nr.completed
          ? 0
          : 1;
      opts.push({ d, nr, pri });
    }
    opts.sort((a, b) => a.pri - b.pri);
    for (const { d, nr, pri } of opts) {
      const k = sk(nr);
      if (seen.has(k)) continue;
      seen.add(k);
      const item = { r: nr, path: [...path, d] };
      if (pri === 0) q.unshift(item);
      else q.push(item);
    }
  }
  return null;
}

for (const PARITY of ["odd", "even"] as const) {
  const r = createMsCc1SimulationRunner(structuredClone(level));
  r.buttonPressCtx.stepParity = PARITY;
  const moves: Direction[] = [];
  let failed = false;

  while (!r.completed && !failed) {
    const chipsLeft = r.playerState.chipsRemainingOnMap;

    // 1) Adjacent chip?
    let stepped = false;
    for (const d of DIRS) {
      const nr = apply(r, d);
      if (nr.playerDied) continue;
      if (nr.playerState.chipsRemainingOnMap < chipsLeft) {
        stepMsCc1Simulation(r, d);
        moves.push(d);
        stepped = true;
        break;
      }
    }
    if (stepped) {
      if (moves.length % 25 === 0) {
        console.log(
          PARITY,
          "adj",
          moves.length,
          `${r.gx},${r.gy}`,
          "chips",
          r.playerState.chipsRemainingOnMap,
          "rem",
          msSecondsRemaining(210, r.buttonPressCtx.moveBoundary),
        );
      }
      continue;
    }

    // 2) Path to next chip or exit
    const path =
      chipsLeft === 0
        ? findPath(r, (x) => x.completed, 60, 120_000)
        : findPath(
            r,
            (x) => x.playerState.chipsRemainingOnMap < chipsLeft || x.completed,
            55,
            100_000,
          );

    if (!path || path.length === 0) {
      console.log(
        PARITY,
        "STUCK",
        `${r.gx},${r.gy}`,
        "chips",
        chipsLeft,
        "mb",
        r.buttonPressCtx.moveBoundary,
        "rem",
        msSecondsRemaining(210, r.buttonPressCtx.moveBoundary),
      );
      failed = true;
      break;
    }

    for (const d of path) {
      stepMsCc1Simulation(r, d);
      moves.push(d);
      if (r.playerDied) {
        console.log(PARITY, "DIED on path", `${r.gx},${r.gy}`);
        failed = true;
        break;
      }
      if (r.completed) break;
    }

    console.log(
      PARITY,
      "seg",
      path.length,
      "total",
      moves.length,
      `${r.gx},${r.gy}`,
      "chips",
      r.playerState.chipsRemainingOnMap,
      "rem",
      msSecondsRemaining(210, r.buttonPressCtx.moveBoundary),
    );
  }

  if (r.completed) {
    const rem = msSecondsRemaining(210, r.buttonPressCtx.moveBoundary);
    console.log(PARITY, "WIN rem", rem, "mb", r.buttonPressCtx.moveBoundary, "moves", moves.length);
    const existing = JSON.parse(readFileSync(webSol, "utf8")) as Record<string, unknown>;
    writeFileSync(
      webSol,
      JSON.stringify(
        {
          ...existing,
          moves: moves.map((d) => LETTER[d]),
          walkthroughUrl: "https://strategywiki.org/wiki/Chip%27s_Challenge/Levels_1-20",
          boldRouteHint: `${PARITY} step; greedy chip-corridor routing → exit`,
          moveVerified: true,
          meetsBoldBudget: rem >= 171,
          moveSource: `Engine greedy Digger ${PARITY}; ${rem}s remaining (bold 171)`,
          simulatedTicks: r.buttonPressCtx.moveBoundary,
          simulatedSecondsRemaining: rem,
          stepParity: PARITY,
        },
        null,
        2,
      ) + "\n",
    );
    console.log("WROTE", rem === 171 ? "EXACT_171" : rem);
    if (rem === 171) break;
  }
}
