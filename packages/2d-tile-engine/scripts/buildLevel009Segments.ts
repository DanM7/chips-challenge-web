#!/usr/bin/env node
/** Segment BFS for level 9 from StrategyWiki / GameFAQs milestones. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { Direction, LevelData } from "../engine/types.js";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import { COLLECTIBLE_CHIP_TILE_ID } from "../tile-engine/tiles.js";
import {
  cloneMsCc1SimulationRunner,
  createMsCc1SimulationRunner,
  msCc1RunnerStateKey,
  stepMsCc1Simulation,
  stepMsCc1Wait,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { decodeSolutionMoves, encodeSolutionMoves } from "../engine/solutionMoves.js";
import { readLevelSolution, writeLevelSolution } from "../integration/solutionStorage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const levelsDir = path.join(
  root,
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels",
);
const webSolutionsDir = path.join(
  root,
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/data/cc1-ms-solutions",
);
const dirs: Direction[] = ["up", "down", "left", "right"];
type Runner = ReturnType<typeof createMsCc1SimulationRunner>;

function loadLevel(): LevelData {
  const level = JSON.parse(
    fs.readFileSync(path.join(levelsDir, "level-009.json"), "utf8"),
  ) as LevelData;
  normalizeLevelLayers(level);
  return level;
}

function applyMoves(start: Runner, seq: Direction[], withWaits: boolean): Runner {
  const r = cloneMsCc1SimulationRunner(start);
  for (let i = 0; i < seq.length; i += 1) {
    if (withWaits && i > 0) stepMsCc1Wait(r);
    stepMsCc1Simulation(r, seq[i]!);
    if (r.completed || r.playerDied) break;
  }
  return r;
}

function segmentBfs(
  start: Runner,
  maxDepth: number,
  maxNodes: number,
  done: (r: Runner) => boolean,
  withWaits: boolean,
): Direction[] | null {
  const q: { seq: Direction[]; runner: Runner }[] = [{ seq: [], runner: start }];
  const seen = new Set<string>([msCc1RunnerStateKey(start)]);
  let nodes = 0;
  while (q.length && nodes < maxNodes) {
    const f = q.shift()!;
    nodes += 1;
    if (done(f.runner)) return f.seq;
    if (f.runner.playerDied || f.seq.length >= maxDepth) continue;
    for (const d of dirs) {
      const next = cloneMsCc1SimulationRunner(f.runner);
      const before = msCc1RunnerStateKey(next);
      if (withWaits && f.seq.length > 0) stepMsCc1Wait(next);
      stepMsCc1Simulation(next, d);
      if (next.playerDied) continue;
      const after = msCc1RunnerStateKey(next);
      if (after === before || seen.has(after)) continue;
      seen.add(after);
      q.push({ seq: [...f.seq, d], runner: next });
    }
  }
  console.error("segment fail nodes", nodes);
  return null;
}

function expand(notation: string): Direction[] {
  const map: Record<string, Direction> = { U: "up", D: "down", L: "left", R: "right" };
  const out: Direction[] = [];
  for (const tok of notation.split(/\s+/)) {
    const m = tok.match(/^(\d+)?([UDLR])$/);
    if (!m) throw new Error(tok);
    const n = m[1] ? Number.parseInt(m[1], 10) : 1;
    for (let i = 0; i < n; i += 1) out.push(map[m[2]!]!);
  }
  return out;
}

const level = loadLevel();
let runner = createMsCc1SimulationRunner(level);
const route: Direction[] = [];

function append(seq: Direction[]): void {
  route.push(...seq);
  runner = applyMoves(runner, seq, false);
  console.log(
    "seg +",
    seq.length,
    "->",
    runner.gx,
    runner.gy,
    "chips",
    runner.playerState.chipsRemainingOnMap,
    "keys",
    runner.playerState.keys.length,
    "tools",
    runner.playerState.tools.join("+") || "-",
  );
}

// GameFAQs / StrategyWiki early: chip, yellow key, through lock, hold east on force floors
append(
  segmentBfs(
    runner,
    40,
    400_000,
    (r) => r.playerState.keys.some((k) => k.includes("yellow")),
    false,
  ) ?? process.exit(1),
);

append(
  segmentBfs(
    runner,
    80,
    800_000,
    (r) => r.playerState.keys.some((k) => k.includes("red")),
    false,
  ) ?? process.exit(1),
);

// Ice path from GameFAQs: R D L U L D R U L D R R D L U L U
append(expand("R D L U L D R U L D R R D L U L U"));

// Toggle / key chain area
append(
  segmentBfs(
    runner,
    120,
    1_000_000,
    (r) => r.playerState.chipsRemainingOnMap <= 3,
    false,
  ) ?? process.exit(1),
);

// Bug room + bombs + socket
append(
  segmentBfs(
    runner,
    200,
    2_000_000,
    (r) => r.playerState.chipsRemainingOnMap === 0,
    false,
  ) ?? process.exit(1),
);

// Final trap room
append(
  segmentBfs(
    runner,
    40,
    500_000,
    (r) => r.completed,
    false,
  ) ?? process.exit(1),
);

const verify = createMsCc1SimulationRunner(structuredClone(level));
for (const m of route) {
  if (stepMsCc1Simulation(verify, m)) break;
}
const entry = readLevelSolution<{
  timeLimitSeconds: number;
  boldTimeRemaining: number;
}>(9)!;
const rem = msSecondsRemaining(entry.timeLimitSeconds, verify.buttonPressCtx.moveBoundary);
console.log({
  moves: route.length,
  completed: verify.completed,
  rem,
  bold: entry.boldTimeRemaining,
  meets: rem >= entry.boldTimeRemaining,
});
if (!verify.completed) process.exit(1);

const updated = {
  ...readLevelSolution(9),
  moves: encodeSolutionMoves(route),
  moveVerified: true,
  meetsBoldBudget: rem >= entry.boldTimeRemaining,
  moveSource: "Segment BFS + GameFAQs/StrategyWiki ice path",
  walkthroughUrl: "https://strategywiki.org/wiki/Chip%27s_Challenge/Levels_1-20",
  boldGapNote:
    rem >= entry.boldTimeRemaining
      ? undefined
      : `Verified complete; ${rem} remaining vs bold ${entry.boldTimeRemaining}`,
};
writeLevelSolution(9, updated);
const { twsRecords, twsRecordSource, ...webEntry } = updated as Record<string, unknown> & {
  twsRecords?: unknown;
  twsRecordSource?: unknown;
};
fs.mkdirSync(webSolutionsDir, { recursive: true });
fs.writeFileSync(path.join(webSolutionsDir, "level-009.json"), `${JSON.stringify(webEntry, null, 2)}\n`);
