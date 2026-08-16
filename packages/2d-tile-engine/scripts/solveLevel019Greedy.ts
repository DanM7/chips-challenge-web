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
const DELTA: Record<Direction, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
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
    `pos=${r.gx},${r.gy} chips=${r.playerState.chipsRemainingOnMap} mb=${r.buttonPressCtx.moveBoundary} rem=${msSecondsRemaining(210, r.buttonPressCtx.moveBoundary)} died=${r.playerDied} done=${r.completed}`,
  );
}

const base = "11D8R9U6L3D3U11R4DR5U5L5D8RL7D8L2U";
const escapes = [
  "5D5LUD8LDU3R5U5L3U",
  "4D5LU2D8LDU3R5U5L3U",
  "4D5LD8LDU3R5U5L3U",
  "3D5LUD8LDU3R5U5L3U",
  "2D5LUD8LDU3R5U5L3U",
  "5D5LUD8LDU3R5U5L3U",
  "4D5LD8LDU3R5U5L3U",
];

const starts: Array<{ label: string; moves: Direction[]; r: MsCc1SimulationRunner }> = [];
for (const esc of escapes) {
  const moves = expand(base + esc);
  const r = run(moves);
  summary("esc " + esc, r);
  if (!r.playerDied) starts.push({ label: esc, moves, r });
}

console.log("live starts", starts.length);

/**
 * From a live state, greedy: BFS to nearest chip (or exit if chips=0),
 * rejecting paths that die. Replan each time.
 */
function greedyFinish(
  startMoves: Direction[],
  startR: MsCc1SimulationRunner,
  maxSteps = 250,
): Direction[] | null {
  let cur = cloneMsCc1SimulationRunner(startR);
  const extra: Direction[] = [];

  while (!cur.completed && extra.length < maxSteps) {
    const chipsLeft = cur.playerState.chipsRemainingOnMap;
    // Find targets
    const targets: Array<{ x: number; y: number }> = [];
    if (chipsLeft === 0) {
      targets.push({ x: 12, y: 15 });
    } else {
      for (let y = 0; y < cur.level.height; y++) {
        for (let x = 0; x < cur.level.width; x++) {
          const t = getCompositeTile(cur.level, x, y);
          if (t && t.startsWith("chip")) targets.push({ x, y });
        }
      }
    }

    // BFS from cur over short paths, simulate with teeth
    type Q = { r: MsCc1SimulationRunner; path: Direction[] };
    const q: Q[] = [{ r: cur, path: [] }];
    const seen = new Set<string>();
    const sk = (rr: MsCc1SimulationRunner) =>
      `${rr.gx},${rr.gy}|${rr.playerState.chipsRemainingOnMap}|${rr.buttonPressCtx.moveBoundary}`;
    seen.add(sk(cur));
    let found: Direction[] | null = null;
    let expanded = 0;
    while (q.length && expanded < 50_000) {
      const { r, path } = q.shift()!;
      expanded++;
      if (path.length > 40) continue;
      const hitTarget =
        chipsLeft === 0
          ? r.completed || (r.gx === 12 && r.gy === 15)
          : r.playerState.chipsRemainingOnMap < chipsLeft;
      if (hitTarget && path.length > 0) {
        found = path;
        break;
      }
      for (const d of DIRS) {
        const nr = apply(r, d);
        if (nr.playerDied) continue;
        if (nr.gx === r.gx && nr.gy === r.gy) continue;
        const k = sk(nr);
        if (seen.has(k)) continue;
        seen.add(k);
        q.push({ r: nr, path: [...path, d] });
      }
    }
    if (!found) {
      console.log(
        "greedy stuck",
        `${cur.gx},${cur.gy}`,
        "chips",
        chipsLeft,
        "extra",
        extra.length,
      );
      return null;
    }
    for (const d of found) {
      stepMsCc1Simulation(cur, d);
      extra.push(d);
      if (cur.playerDied) return null;
      if (cur.completed) return startMoves.concat(extra);
    }
  }
  return cur.completed ? startMoves.concat(extra) : null;
}

let best: { moves: Direction[]; rem: number } | null = null;
for (const s of starts) {
  console.log("greedy from", s.label);
  const finished = greedyFinish(s.moves, s.r);
  if (!finished) continue;
  const v = run(finished);
  const rem = msSecondsRemaining(210, v.buttonPressCtx.moveBoundary);
  summary("finished " + s.label, v);
  if (v.completed && (!best || rem > best.rem)) {
    best = { moves: finished, rem };
  }
}

if (best) {
  console.log("BEST rem", best.rem, "len", best.moves.length, "exact", best.rem === 171);
  const existing = JSON.parse(readFileSync(webSol, "utf8")) as Record<string, unknown>;
  const letters = best.moves.map((d) => LETTER[d]);
  const out = {
    ...existing,
    moves: letters,
    walkthroughUrl: "https://strategywiki.org/wiki/Chip%27s_Challenge/Levels_1-20",
    boldRouteHint:
      "Odd step; SW hybrid teeth dodges; greedy chip cleanup CCW-ish → exit",
    moveVerified: true,
    meetsBoldBudget: best.rem >= 171,
    moveSource: `Engine SW+greedy Digger odd-step; ${best.rem}s remaining (bold 171)`,
    simulatedTicks: best.moves.length, // approx; overwrite from verify
    simulatedSecondsRemaining: best.rem,
    stepParity: "odd",
  };
  const v = run(best.moves);
  out.simulatedTicks = v.buttonPressCtx.moveBoundary;
  out.simulatedSecondsRemaining = msSecondsRemaining(210, v.buttonPressCtx.moveBoundary);
  writeFileSync(webSol, JSON.stringify(out, null, 2) + "\n");
  console.log("WROTE", webSol, letters.length);
} else {
  console.log("no finish found");
}
