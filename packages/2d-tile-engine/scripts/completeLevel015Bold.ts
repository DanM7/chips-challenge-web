/**
 * Level 15 Elementary: segmented BFS toward bold 89 (ticks <= 809).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  cloneMsCc1SimulationRunner,
  createMsCc1SimulationRunner,
  msCc1RunnerStateKey,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { encodeSolutionMoves } from "../engine/solutionMoves.js";
import type { Direction, LevelData } from "../engine/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const level = JSON.parse(
  readFileSync(
    path.join(
      root,
      "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-015.json",
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

const dirs: Direction[] = ["up", "down", "left", "right"];
const TIME_LIMIT = 250;
const BOLD = 89;
const MAX_TICKS = (TIME_LIMIT - BOLD) * 5 + 4;

type Runner = ReturnType<typeof createMsCc1SimulationRunner>;

function segmentBfs(
  start: Runner,
  maxDepth: number,
  maxNodes: number,
  done: (r: Runner) => boolean,
  maxTicks: number,
): Direction[] | null {
  type Frame = { seq: Direction[]; runner: Runner; ticks: number };
  const q: Frame[] = [{ seq: [], runner: start, ticks: start.buttonPressCtx.moveBoundary }];
  const seen = new Set<string>([msCc1RunnerStateKey(start)]);
  let n = 0;
  while (q.length && n < maxNodes) {
    q.sort(
      (a, b) =>
        a.runner.playerState.chipsRemainingOnMap -
        b.runner.playerState.chipsRemainingOnMap ||
        a.ticks - b.ticks,
    );
    const f = q.shift()!;
    n++;
    if (done(f.runner)) return f.seq;
    if (f.seq.length >= maxDepth || f.runner.playerDied || f.ticks > maxTicks) continue;
    for (const d of dirs) {
      const next = cloneMsCc1SimulationRunner(f.runner);
      stepMsCc1Simulation(next, d);
      if (next.playerDied) continue;
      const ticks = next.buttonPressCtx.moveBoundary;
      if (ticks > maxTicks) continue;
      const key = msCc1RunnerStateKey(next);
      if (seen.has(key)) continue;
      seen.add(key);
      q.push({ seq: [...f.seq, d], runner: next, ticks });
    }
  }
  return null;
}

function apply(start: Runner, seq: Direction[]): Runner {
  const r = cloneMsCc1SimulationRunner(start);
  for (const d of seq) stepMsCc1Simulation(r, d);
  return r;
}

const goals: {
  label: string;
  depth: number;
  nodes: number;
  done: (r: Runner) => boolean;
}[] = [
  {
    label: "flippers",
    depth: 40,
    nodes: 300_000,
    done: (r) => r.playerState.tools.includes("flippers"),
  },
  {
    label: "suction",
    depth: 50,
    nodes: 400_000,
    done: (r) => r.playerState.tools.includes("suction"),
  },
  {
    label: "chips<=9",
    depth: 120,
    nodes: 800_000,
    done: (r) => r.playerState.chipsRemainingOnMap <= 9,
  },
  {
    label: "fire boots",
    depth: 80,
    nodes: 600_000,
    done: (r) => r.playerState.tools.includes("fire"),
  },
  {
    label: "skates",
    depth: 80,
    nodes: 600_000,
    done: (r) => r.playerState.tools.includes("skates"),
  },
  {
    label: "chips<=2",
    depth: 120,
    nodes: 1_000_000,
    done: (r) => r.playerState.chipsRemainingOnMap <= 2,
  },
  {
    label: "exit bold",
    depth: 80,
    nodes: 800_000,
    done: (r) =>
      r.completed &&
      msSecondsRemaining(TIME_LIMIT, r.buttonPressCtx.moveBoundary) >= BOLD,
  },
];

let r = createMsCc1SimulationRunner(structuredClone(level));
const full: Direction[] = [];

for (const g of goals) {
  const seg = segmentBfs(r, g.depth, g.nodes, g.done, MAX_TICKS);
  if (!seg) {
    console.error("FAIL", g.label, {
      pos: { x: r.gx, y: r.gy },
      chips: r.playerState.chipsRemainingOnMap,
      tools: r.playerState.tools,
      ticks: r.buttonPressCtx.moveBoundary,
      rem: msSecondsRemaining(TIME_LIMIT, r.buttonPressCtx.moveBoundary),
    });
    process.exit(1);
  }
  console.log(g.label, "len", seg.length, "total", full.length + seg.length);
  full.push(...seg);
  r = apply(r, seg);
  console.log(" ->", {
    pos: { x: r.gx, y: r.gy },
    chips: r.playerState.chipsRemainingOnMap,
    tools: r.playerState.tools,
    ticks: r.buttonPressCtx.moveBoundary,
    rem: msSecondsRemaining(TIME_LIMIT, r.buttonPressCtx.moveBoundary),
    completed: r.completed,
  });
}

console.log(
  "DONE",
  full.length,
  msSecondsRemaining(TIME_LIMIT, r.buttonPressCtx.moveBoundary),
);
console.log(JSON.stringify(encodeSolutionMoves(full)));
