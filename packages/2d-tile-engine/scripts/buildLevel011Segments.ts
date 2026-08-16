#!/usr/bin/env node
/** Segment BFS for level 11 StrategyWiki route (bold 211). */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { Direction, LevelData } from "../engine/types.js";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  cloneMsCc1SimulationRunner,
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { encodeSolutionMoves } from "../engine/solutionMoves.js";
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
type Act = Direction | "wait";

function bfsKey(r: Runner): string {
  return [
    r.gx,
    r.gy,
    r.playerState.chipsRemainingOnMap,
    r.playerState.keys.join("+"),
    r.playerState.tools.join("+"),
    r.monsters.map((m) => `${m.alive ? 1 : 0}:${m.x},${m.y},${m.direction}`).join(";"),
    [...r.buttonPressCtx.openTraps].sort().join(";"),
  ].join("|");
}

function loadLevel(): LevelData {
  const level = JSON.parse(
    fs.readFileSync(path.join(levelsDir, "level-011.json"), "utf8"),
  ) as LevelData;
  normalizeLevelLayers(level);
  return level;
}

function applyMoves(start: Runner, seq: Act[]): Runner {
  const r = cloneMsCc1SimulationRunner(start);
  for (const m of seq) {
    if (m === "wait") {
      if (stepMsCc1Wait(r)) break;
    } else if (stepMsCc1Simulation(r, m)) {
      break;
    }
  }
  return r;
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

function segmentBfs(
  start: Runner,
  maxDepth: number,
  maxNodes: number,
  done: (r: Runner) => boolean,
  opts: { waits?: boolean } = {},
): Act[] | null {
  const q: { seq: Act[]; runner: Runner }[] = [{ seq: [], runner: start }];
  const seen = new Set<string>([bfsKey(start)]);
  let nodes = 0;
  while (q.length && nodes < maxNodes) {
    const f = q.shift()!;
    nodes += 1;
    if (done(f.runner)) return f.seq;
    if (f.runner.playerDied || f.seq.length >= maxDepth) continue;
    const acts: Act[] = opts.waits ? ["wait", ...dirs] : dirs;
    for (const a of acts) {
      const next = cloneMsCc1SimulationRunner(f.runner);
      const before = bfsKey(next);
      if (a === "wait") stepMsCc1Wait(next);
      else stepMsCc1Simulation(next, a);
      if (next.playerDied) continue;
      const after = bfsKey(next);
      if (after === before || seen.has(after)) continue;
      seen.add(after);
      q.push({ seq: [...f.seq, a], runner: next });
    }
  }
  console.error("segment fail nodes", nodes, "seen", seen.size);
  return null;
}

const level = loadLevel();
let runner = createMsCc1SimulationRunner(level);
const route: Act[] = [];

function append(label: string, seq: Act[] | null): void {
  if (!seq) {
    console.error("failed", label, "at", runner.gx, runner.gy, "chips", runner.playerState.chipsRemainingOnMap, "tools", runner.playerState.tools.join("+"));
    console.error("route so far", encodeSolutionMoves(route).join(""));
    process.exit(1);
  }
  route.push(...seq);
  runner = applyMoves(runner, seq);
  console.log(
    label,
    "+",
    seq.length,
    "->",
    runner.gx,
    runner.gy,
    "chips",
    runner.playerState.chipsRemainingOnMap,
    "keys",
    runner.playerState.keys.join("+") || "-",
    "tools",
    runner.playerState.tools.join("+") || "-",
  );
}

append("open", expand("D 3L D"));
append(
  "red-key",
  segmentBfs(runner, 80, 600_000, (r) => r.playerState.keys.includes("key_red")),
);
append(
  "yellow-key",
  segmentBfs(runner, 100, 800_000, (r) => r.playerState.keys.includes("key_yellow")),
);
append(
  "blue-key",
  segmentBfs(runner, 120, 1_000_000, (r) => r.playerState.keys.includes("key_blue")),
);
append(
  "ice-skates",
  segmentBfs(runner, 80, 600_000, (r) => r.playerState.tools.includes("ice_skates")),
);
append(
  "ice-chip-and-leave",
  segmentBfs(
    runner,
    80,
    800_000,
    (r) =>
      r.playerState.chipsRemainingOnMap <= 2 &&
      !(r.gx === 1 && r.gy === 1),
  ),
);
{
  const chipsBeforeFlip = runner.playerState.chipsRemainingOnMap;
  append(
    "flippers+chip",
    segmentBfs(
      runner,
      100,
      800_000,
      (r) =>
        r.playerState.tools.includes("flippers") &&
        r.playerState.chipsRemainingOnMap < chipsBeforeFlip,
    ),
  );
}
{
  const chipsBeforeFire = runner.playerState.chipsRemainingOnMap;
  append(
    "fire-boots+chip",
    segmentBfs(
      runner,
      100,
      800_000,
      (r) =>
        r.playerState.tools.includes("fire_boots") &&
        r.playerState.chipsRemainingOnMap < chipsBeforeFire,
    ),
  );
}
if (runner.playerState.chipsRemainingOnMap > 0) {
  append(
    "last-chip",
    segmentBfs(runner, 120, 1_000_000, (r) => r.playerState.chipsRemainingOnMap === 0, {
      waits: true,
    }),
  );
}
append("exit", segmentBfs(runner, 140, 1_200_000, (r) => r.completed, { waits: true }));

const entry = readLevelSolution<{ timeLimitSeconds: number; boldTimeRemaining: number }>(11)!;
const verify = applyMoves(createMsCc1SimulationRunner(structuredClone(level)), route);
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
  ...readLevelSolution(11),
  moves: encodeSolutionMoves(route),
  moveVerified: rem === entry.boldTimeRemaining,
  meetsBoldBudget: rem >= entry.boldTimeRemaining,
  simulatedTicks: verify.buttonPressCtx.moveBoundary,
  simulatedSecondsRemaining: rem,
  moveSource: `Segment BFS from StrategyWiki Trinity outline; rem ${rem} (bold ${entry.boldTimeRemaining})`,
  walkthroughUrl: "https://strategywiki.org/wiki/Chip%27s_Challenge/Levels_1-20",
  boldGapNote:
    rem >= entry.boldTimeRemaining
      ? undefined
      : `Verified complete; ${rem} remaining vs bold ${entry.boldTimeRemaining}`,
};
writeLevelSolution(11, updated);
const { twsRecords, twsRecordSource, ...webEntry } = updated as Record<string, unknown> & {
  twsRecords?: unknown;
  twsRecordSource?: unknown;
};
fs.mkdirSync(webSolutionsDir, { recursive: true });
fs.writeFileSync(path.join(webSolutionsDir, "level-011.json"), `${JSON.stringify(webEntry, null, 2)}\n`);
