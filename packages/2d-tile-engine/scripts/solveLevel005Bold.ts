/**
 * Lesson 5 segmented solver → U/D/L/R/W letters, exact bold 85.
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
  console.error("BFS exhausted", n, "nodes");
  return null;
}

function toLetters(seq: Action[]): string[] {
  return seq.map((a) => (a === "wait" ? "W" : LETTER[a]));
}

const goals: {
  label: string;
  depth: number;
  nodes: number;
  allowWait?: boolean;
  done: (r: Runner) => boolean;
}[] = [
  {
    label: "toggle open",
    depth: 20,
    nodes: 200_000,
    allowWait: false,
    done: (r) => getCompositeTile(r.level, 16, 15) === "block_toggle_open",
  },
  {
    label: "ball west of toggle",
    depth: 30,
    nodes: 400_000,
    done: (r) => {
      const ball = r.monsters.find((m) => m.alive && m.kind === "ball_pink");
      return !!ball && ball.x < 16;
    },
  },
  {
    label: "toggle closed (ball trapped)",
    depth: 20,
    nodes: 300_000,
    done: (r) => {
      const ball = r.monsters.find((m) => m.alive && m.kind === "ball_pink");
      return (
        getCompositeTile(r.level, 16, 15) === "block_toggle_closed" &&
        !!ball &&
        ball.x < 16
      );
    },
  },
  {
    label: "red key",
    depth: 40,
    nodes: 800_000,
    done: (r) => r.playerState.keys.includes("red"),
  },
  {
    label: "through red door (north room)",
    depth: 30,
    nodes: 500_000,
    done: (r) => r.gy <= 11,
  },
  {
    label: "trap 18,7 open",
    depth: 20,
    nodes: 400_000,
    done: (r) => isTrapOpen(r.buttonPressCtx, 18, 7),
  },
  {
    label: "trap 18,10 open",
    depth: 25,
    nodes: 500_000,
    done: (r) => isTrapOpen(r.buttonPressCtx, 18, 10),
  },
  {
    label: "win",
    depth: 40,
    nodes: 800_000,
    done: (r) => r.completed,
  },
];

let r = createMsCc1SimulationRunner(structuredClone(level));
const full: Action[] = [];

for (const g of goals) {
  console.log("seeking", g.label, "from", r.gx, r.gy);
  const seg = bfs(r, g.depth, g.nodes, g.done, g.allowWait !== false);
  if (!seg) {
    console.error("FAIL", g.label);
    const fires = r.monsters.filter((m) => m.alive && m.kind === "fireball");
    console.error({
      keys: r.playerState.keys,
      toggle: getCompositeTile(r.level, 16, 15),
      fires: fires.map((f) => `${f.x},${f.y}`),
      ball: r.monsters.find((m) => m.kind === "ball_pink"),
    });
    process.exit(1);
  }
  console.log(
    "  ok",
    seg.length,
    "waits",
    seg.filter((a) => a === "wait").length,
    toLetters(seg).join(""),
  );
  full.push(...seg);
  r = apply(r, seg);
  console.log(
    "  ->",
    r.gx,
    r.gy,
    "keys",
    r.playerState.keys,
    "rem",
    msSecondsRemaining(100, r.buttonPressCtx.moveBoundary),
  );
}

const letters = toLetters(full);
const rem = msSecondsRemaining(100, r.buttonPressCtx.moveBoundary);
console.log({
  completed: r.completed,
  rem,
  boldExact: rem === 85,
  letters: letters.length,
  chipMoves: letters.filter((c) => c !== "W").length,
  waits: letters.filter((c) => c === "W").length,
});
writeFileSync("scripts/level005-letters.json", JSON.stringify(letters, null, 2) + "\n");
console.log("wrote scripts/level005-letters.json");
