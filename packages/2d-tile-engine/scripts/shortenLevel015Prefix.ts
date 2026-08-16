/**
 * Shave 6 ticks from Elementary TWS prefix before chips0, then reuse fastest exit.
 */
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import {
  cloneMsCc1SimulationRunner,
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { decodeSolutionMoves, encodeSolutionMoves } from "../engine/solutionMoves.js";
import type { Direction, LevelData } from "../engine/types.js";
import { readLevelSolution } from "../integration/solutionStorage.js";

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
const DIRS: Direction[] = ["up", "down", "left", "right"];
const OPP: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};
type Runner = ReturnType<typeof createMsCc1SimulationRunner>;

const EXIT: Direction[] = [
  "down", "down", "down", "down", "right", "right", "right", "right",
  "up", "up", "left", "left", "up", "up", "up", "up", "left", "left",
  "up", "up", "up", "up", "up", "up", "up", "up", "up", "up", "up", "up",
  "up", "down", "down", "right", "right", "up", "up", "up",
  "down", "down", "down", "down", "down", "down", "down", "down",
];

function tools(r: Runner) {
  return [...r.playerState.tools].sort().join("+");
}
function keys(r: Runner) {
  return [...r.playerState.keys].sort().join("+");
}
function block(r: Runner) {
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++)
      if (getCompositeTile(r.level, x, y) === "block_movable") return `${x},${y}`;
  return "gone";
}

function run(moves: Direction[]) {
  const r = createMsCc1SimulationRunner(structuredClone(level));
  for (const d of moves) {
    stepMsCc1Simulation(r, d);
    if (r.playerDied || r.completed) break;
  }
  return r;
}

const tws = decodeSolutionMoves(readLevelSolution<{ moves: string[] }>(15)!.moves) as Direction[];
let prefix = tws.slice(0, 761);
const goal = run(prefix);
console.log("goal chips0", {
  pos: `${goal.gx},${goal.gy}`,
  chips: goal.playerState.chipsRemainingOnMap,
  tools: tools(goal),
  keys: keys(goal),
  block: block(goal),
  ticks: goal.buttonPressCtx.moveBoundary,
});

function atGoal(r: Runner): boolean {
  return (
    r.gx === goal.gx &&
    r.gy === goal.gy &&
    r.playerState.chipsRemainingOnMap === 0 &&
    tools(r) === tools(goal) &&
    keys(r) === keys(goal) &&
    block(r) === block(goal) &&
    !r.playerDied
  );
}

function prefixOk(p: Direction[]): boolean {
  return atGoal(run(p));
}

{
  let removed = 0;
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < prefix.length - 1; i++) {
      if (OPP[prefix[i]!] !== prefix[i + 1]) continue;
      const trial = [...prefix.slice(0, i), ...prefix.slice(i + 2)];
      if (prefixOk(trial)) {
        prefix = trial;
        removed += 2;
        changed = true;
        break;
      }
    }
  }
  console.log("pairs", removed, "len", prefix.length, "ticks", run(prefix).buttonPressCtx.moveBoundary);
}

{
  let removed = 0;
  for (let i = 0; i < prefix.length; ) {
    const trial = [...prefix.slice(0, i), ...prefix.slice(i + 1)];
    if (prefixOk(trial)) {
      prefix = trial;
      removed++;
      continue;
    }
    i++;
  }
  console.log("singles", removed, "len", prefix.length, "ticks", run(prefix).buttonPressCtx.moveBoundary);
}

function tryStep(r: Runner, d: Direction): Runner | null {
  const n = cloneMsCc1SimulationRunner(r);
  stepMsCc1Simulation(n, d);
  return n.playerDied ? null : n;
}
function sig(r: Runner): string {
  return `${r.gx},${r.gy}|${r.playerState.chipsRemainingOnMap}|${keys(r)}|${tools(r)}|${block(r)}`;
}

for (const win of [6, 10, 14]) {
  let improved = true;
  let passes = 0;
  while (improved && passes < 4) {
    improved = false;
    passes++;
    const prefixes: Runner[] = [];
    let r = createMsCc1SimulationRunner(structuredClone(level));
    prefixes.push(cloneMsCc1SimulationRunner(r));
    for (const d of prefix) {
      const n = tryStep(r, d);
      if (!n) break;
      r = n;
      prefixes.push(cloneMsCc1SimulationRunner(r));
    }
    outer: for (let i = 0; i < prefixes.length - 3; i += 2) {
      for (let len = 4; len <= win && i + len < prefixes.length; len++) {
        const start = prefixes[i]!;
        const goalSig = sig(prefixes[i + len]!);
        const q: { seq: Direction[]; r: Runner }[] = [{ seq: [], r: start }];
        const seen = new Set([sig(start)]);
        let found: Direction[] | null = null;
        let nodes = 0;
        while (q.length && nodes < 8_000) {
          const f = q.shift()!;
          nodes++;
          if (f.seq.length > 0 && sig(f.r) === goalSig) {
            found = f.seq;
            break;
          }
          if (f.seq.length >= len - 1) continue;
          for (const d of DIRS) {
            const n = tryStep(f.r, d);
            if (!n) continue;
            const k = sig(n);
            if (seen.has(k)) continue;
            seen.add(k);
            if (k === goalSig) {
              found = [...f.seq, d];
              q.length = 0;
              break;
            }
            q.push({ seq: [...f.seq, d], r: n });
          }
        }
        if (found && found.length < len) {
          const trial = [...prefix.slice(0, i), ...found, ...prefix.slice(i + len)];
          if (prefixOk(trial) && trial.length < prefix.length) {
            console.log("win", win, i, len, "->", found.length, "len", trial.length);
            prefix = trial;
            improved = true;
            break outer;
          }
        }
      }
    }
  }
  console.log("after win", win, "len", prefix.length, "ticks", run(prefix).buttonPressCtx.moveBoundary);
}

const full = [...prefix, ...EXIT];
const done = run(full);
const rem = msSecondsRemaining(250, done.buttonPressCtx.moveBoundary);
console.log("FULL", {
  completed: done.completed,
  died: done.playerDied,
  ticks: done.buttonPressCtx.moveBoundary,
  rem,
  prefixLen: prefix.length,
  prefixTicks: run(prefix).buttonPressCtx.moveBoundary,
});

if (done.completed && rem >= 89) {
  const webPath = path.join(
    root,
    "../../apps/chips-challenge-web/public/games/chips-challenge-1/data/cc1-ms-solutions/level-015.json",
  );
  const entry = JSON.parse(readFileSync(webPath, "utf8"));
  writeFileSync(
    webPath,
    `${JSON.stringify(
      {
        ...entry,
        moves: encodeSolutionMoves(full),
        moveVerified: rem === 89,
        meetsBoldBudget: rem >= 89,
        simulatedTicks: done.buttonPressCtx.moveBoundary,
        simulatedSecondsRemaining: rem,
        moveSource: `TWS prefix shortened + thief-slide exit; rem ${rem} (bold 89)`,
        boldGapNote: rem === 89 ? undefined : `rem ${rem} vs bold 89`,
      },
      null,
      2,
    )}\n`,
  );
  console.log("WROTE", rem);
}
