/**
 * Level 15: run one segmented BFS milestone (pass milestone name as argv[2]).
 */
import { readFileSync, writeFileSync } from "node:fs";
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
import { decodeSolutionMoves, encodeSolutionMoves } from "../engine/solutionMoves.js";
import type { Direction, LevelData } from "../engine/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const progressPath = path.join(root, ".tmp/level015-bold-progress.json");
const milestoneName = process.argv[2] ?? "flippers";

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

const TIME_LIMIT = 250;
const BOLD = 89;
const MAX_TICKS = (TIME_LIMIT - BOLD) * 5 + 4;
const dirs: Direction[] = ["up", "down", "left", "right"];
type Runner = ReturnType<typeof createMsCc1SimulationRunner>;

const milestones: Record<
  string,
  { depth: number; nodes: number; done: (r: Runner) => boolean }
> = {
  flippers: {
    depth: 40,
    nodes: 300_000,
    done: (r) => r.playerState.tools.includes("flippers"),
  },
  suction: {
    depth: 50,
    nodes: 400_000,
    done: (r) => r.playerState.tools.includes("suction_boots"),
  },
  chips9: {
    depth: 120,
    nodes: 600_000,
    done: (r) => r.playerState.chipsRemainingOnMap <= 9,
  },
  fire: {
    depth: 80,
    nodes: 500_000,
    done: (r) => r.playerState.tools.includes("fire"),
  },
  skates: {
    depth: 80,
    nodes: 500_000,
    done: (r) => r.playerState.tools.includes("ice_skates"),
  },
  chips2: {
    depth: 120,
    nodes: 800_000,
    done: (r) => r.playerState.chipsRemainingOnMap <= 2,
  },
  exit: {
    depth: 100,
    nodes: 800_000,
    done: (r) =>
      r.completed &&
      msSecondsRemaining(TIME_LIMIT, r.buttonPressCtx.moveBoundary) >= BOLD,
  },
};

const order = ["flippers", "suction", "chips9", "fire", "skates", "chips2", "exit"];

function segmentBfs(start: Runner, spec: (typeof milestones)[string]) {
  type Frame = { seq: Direction[]; runner: Runner };
  const q: Frame[] = [{ seq: [], runner: start }];
  const seen = new Set<string>([msCc1RunnerStateKey(start)]);
  let n = 0;
  while (q.length && n < spec.nodes) {
    q.sort(
      (a, b) =>
        a.runner.playerState.chipsRemainingOnMap -
          b.runner.playerState.chipsRemainingOnMap ||
        a.runner.buttonPressCtx.moveBoundary -
          b.runner.buttonPressCtx.moveBoundary,
    );
    const f = q.shift()!;
    n++;
    if (spec.done(f.runner)) return { seg: f.seq, nodes: n };
    if (
      f.seq.length >= spec.depth ||
      f.runner.playerDied ||
      f.runner.buttonPressCtx.moveBoundary > MAX_TICKS
    ) {
      continue;
    }
    for (const d of dirs) {
      const next = cloneMsCc1SimulationRunner(f.runner);
      stepMsCc1Simulation(next, d);
      if (next.playerDied || next.buttonPressCtx.moveBoundary > MAX_TICKS) continue;
      const key = msCc1RunnerStateKey(next);
      if (seen.has(key)) continue;
      seen.add(key);
      q.push({ seq: [...f.seq, d], runner: next });
    }
  }
  return null;
}

function apply(start: Runner, seq: Direction[]): Runner {
  const r = cloneMsCc1SimulationRunner(start);
  for (const d of seq) stepMsCc1Simulation(r, d);
  return r;
}

let prefix: string[] = [];
let start = createMsCc1SimulationRunner(structuredClone(level));
try {
  const saved = JSON.parse(readFileSync(progressPath, "utf8")) as {
    prefix: string[];
  };
  prefix = saved.prefix;
  start = apply(start, decodeSolutionMoves(prefix));
} catch {
  // fresh
}

const idx = order.indexOf(milestoneName);
if (idx < 0) {
  console.error("Unknown milestone", milestoneName);
  process.exit(1);
}

for (let i = prefix.length > 0 ? order.findIndex((m, j) => j > 0 && !milestones[m]!.done(start)) : 0; i <= idx; i += 1) {
  const name = order[i]!;
  const spec = milestones[name]!;
  if (spec.done(start) && name !== milestoneName) continue;
  console.log("Searching", name, "from ticks", start.buttonPressCtx.moveBoundary);
  const result = segmentBfs(start, spec);
  if (!result) {
    console.error("FAIL", name);
    process.exit(1);
  }
  prefix.push(...encodeSolutionMoves(result.seg));
  start = apply(start, result.seg);
  console.log("OK", name, {
    segLen: result.seg.length,
    total: prefix.length,
    ticks: start.buttonPressCtx.moveBoundary,
    rem: msSecondsRemaining(TIME_LIMIT, start.buttonPressCtx.moveBoundary),
    chips: start.playerState.chipsRemainingOnMap,
    tools: start.playerState.tools,
    completed: start.completed,
    nodes: result.nodes,
  });
  writeFileSync(progressPath, JSON.stringify({ prefix }, null, 2));
  if (name === milestoneName) break;
}

if (start.completed) {
  console.log("FINAL", {
    rem: msSecondsRemaining(TIME_LIMIT, start.buttonPressCtx.moveBoundary),
    moves: prefix.length,
  });
}
