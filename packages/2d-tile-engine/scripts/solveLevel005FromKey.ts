/**
 * Lesson 5 bold route with known trap→key prefix, then BFS for the rest.
 */
import { readFileSync, writeFileSync } from "fs";
import type { Direction, LevelData } from "../engine/types.js";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import {
  cloneMsCc1SimulationRunner,
  createMsCc1SimulationRunner,
  msCc1RunnerStateKey,
  stepMsCc1Simulation,
  stepMsCc1Wait,
  type MsCc1SimulationRunner,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { isTrapOpen } from "../engine/msCc1/msCc1Traps.js";

type Action = Direction | "wait";
const DIRS: Direction[] = ["up", "down", "left", "right"];
const ACTIONS: Action[] = [...DIRS, "wait"];
const LETTER: Record<Direction, string> = {
  up: "U",
  down: "D",
  left: "L",
  right: "R",
};

const level = JSON.parse(
  readFileSync(
    "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-005.json",
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

type Runner = MsCc1SimulationRunner;

function apply(start: Runner, seq: Action[]): Runner {
  const r = cloneMsCc1SimulationRunner(start);
  for (const a of seq) {
    if (a === "wait") stepMsCc1Wait(r);
    else stepMsCc1Simulation(r, a);
    if (r.completed || r.playerDied) break;
  }
  return r;
}

function bfs(
  start: Runner,
  maxDepth: number,
  maxNodes: number,
  done: (r: Runner) => boolean,
  allowWait = true,
): Action[] | null {
  const q: { seq: Action[]; runner: Runner }[] = [{ seq: [], runner: start }];
  const seen = new Set<string>([msCc1RunnerStateKey(start)]);
  let n = 0;
  while (q.length && n < maxNodes) {
    const f = q.shift()!;
    n += 1;
    if (done(f.runner)) return f.seq;
    if (f.seq.length >= maxDepth || f.runner.playerDied) continue;
    const acts = allowWait ? ACTIONS : DIRS;
    for (const a of acts) {
      // Prefer moves before waits in BFS ordering for shallower solutions.
      const next = cloneMsCc1SimulationRunner(f.runner);
      const before = msCc1RunnerStateKey(next);
      if (a === "wait") stepMsCc1Wait(next);
      else stepMsCc1Simulation(next, a);
      if (next.playerDied) continue;
      const after = msCc1RunnerStateKey(next);
      if (after === before || seen.has(after)) continue;
      seen.add(after);
      q.push({ seq: [...f.seq, a], runner: next });
    }
  }
  console.error("BFS exhausted", n);
  return null;
}

function toLetters(seq: Action[]): string[] {
  return seq.map((a) => (a === "wait" ? "W" : LETTER[a]));
}

/** Trap ball + grab red key (verified manually). */
const prefix: Action[] = [
  "up",
  "up",
  "right",
  "up",
  "up",
  "up",
  "up",
  "left",
  "left",
  "left",
  "left",
  "left",
  "left",
  "left",
  "right",
  "right",
  "right",
  "right",
  "right",
  "right",
  "right",
  "down",
  "down",
  "down",
  "down",
  "down",
  "down",
  "down",
  "left",
  "left",
  "left",
  "left",
  "left",
  "left",
  "left",
  "up",
  "up",
  "up",
];

let r = apply(createMsCc1SimulationRunner(structuredClone(level)), prefix);
console.log("after prefix", {
  pos: `${r.gx},${r.gy}`,
  keys: r.playerState.keys,
  died: r.playerDied,
  rem: msSecondsRemaining(100, r.buttonPressCtx.moveBoundary),
});
if (r.playerDied || !r.playerState.keys.some((k) => k === "red" || k === "key_red")) {
  console.error("prefix failed", r.playerState.keys, r.deathMessage);
  process.exit(1);
}

const full: Action[] = [...prefix];

const goals: {
  label: string;
  depth: number;
  nodes: number;
  allowWait?: boolean;
  done: (r: Runner) => boolean;
}[] = [
  {
    label: "north of red door",
    depth: 25,
    nodes: 500_000,
    allowWait: false,
    done: (r) => r.gy <= 11 && r.gx >= 13 && r.gx <= 19,
  },
  {
    label: "brown1 / trap 18,7",
    depth: 20,
    nodes: 400_000,
    done: (r) => isTrapOpen(r.buttonPressCtx, 18, 7),
  },
  {
    label: "brown2 / trap 18,10",
    depth: 25,
    nodes: 600_000,
    done: (r) => isTrapOpen(r.buttonPressCtx, 18, 10),
  },
  {
    label: "exit bomb gone",
    depth: 50,
    nodes: 1_200_000,
    done: (r) => r.completed || getCompositeTile(r.level, 11, 5) === "exit",
  },
  {
    label: "win",
    depth: 30,
    nodes: 800_000,
    allowWait: false,
    done: (r) => r.completed,
  },
];

for (const g of goals) {
  if (g.done(r)) {
    console.log("already", g.label);
    continue;
  }
  console.log("seeking", g.label, "from", r.gx, r.gy);
  const seg = bfs(r, g.depth, g.nodes, g.done, g.allowWait !== false);
  if (!seg) {
    console.error("FAIL", g.label);
    process.exit(1);
  }
  console.log("  ok", toLetters(seg).join(""), "len", seg.length);
  full.push(...seg);
  r = apply(r, seg);
  console.log("  ->", r.gx, r.gy, "completed", r.completed, "rem", msSecondsRemaining(100, r.buttonPressCtx.moveBoundary));
}

const letters = toLetters(full);
const rem = msSecondsRemaining(100, r.buttonPressCtx.moveBoundary);
console.log({
  completed: r.completed,
  rem,
  boldExact: rem === 85,
  chipMoves: letters.filter((c) => c !== "W").length,
  waits: letters.filter((c) => c === "W").length,
});
writeFileSync("scripts/level005-letters.json", JSON.stringify(letters, null, 2) + "\n");

if (r.completed && rem === 85) {
  console.log("SUCCESS exact bold");
} else if (r.completed) {
  console.log("completed but rem", rem, "need 85 — pad or trim waits");
}
