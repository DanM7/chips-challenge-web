/**
 * Level 5: segmented BFS with idle waits (trap + clone choreography).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { Direction, LevelData } from "../engine/types.js";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  cloneMsCc1SimulationRunner,
  createMsCc1SimulationRunner,
  msCc1RunnerStateKey,
  simulateMsCc1AutoplayLevel,
  simulateMsCc1Level,
  stepMsCc1Simulation,
  stepMsCc1Wait,
} from "../engine/msCc1/msCc1Simulation.js";
import { isTrapOpen } from "../engine/msCc1/msCc1Traps.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dirs: Direction[] = ["up", "down", "left", "right"];
const WAIT = "__wait__" as const;
type Action = Direction | typeof WAIT;
const actions: Action[] = [...dirs, WAIT];

const level = JSON.parse(
  fs.readFileSync(
    path.join(
      __dirname,
      "../../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-005.json",
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

type Runner = ReturnType<typeof createMsCc1SimulationRunner>;

function apply(start: Runner, seq: Action[]): Runner {
  const r = cloneMsCc1SimulationRunner(start);
  for (const a of seq) {
    if (a === WAIT) stepMsCc1Wait(r);
    else stepMsCc1Simulation(r, a);
    if (r.completed || r.playerDied) break;
  }
  return r;
}

function segmentBfs(
  start: Runner,
  maxDepth: number,
  maxNodes: number,
  done: (r: Runner) => boolean,
): Action[] | null {
  const q: { seq: Action[]; runner: Runner }[] = [{ seq: [], runner: start }];
  const seen = new Set<string>([msCc1RunnerStateKey(start)]);
  let n = 0;
  while (q.length && n < maxNodes) {
    const f = q.shift()!;
    n++;
    if (done(f.runner)) return f.seq;
    if (f.seq.length >= maxDepth || f.runner.playerDied) continue;
    for (const a of actions) {
      const next = cloneMsCc1SimulationRunner(f.runner);
      const before = msCc1RunnerStateKey(next);
      if (a === WAIT) stepMsCc1Wait(next);
      else stepMsCc1Simulation(next, a);
      if (next.playerDied) continue;
      const after = msCc1RunnerStateKey(next);
      if (after === before || seen.has(after)) continue;
      seen.add(after);
      q.push({ seq: [...f.seq, a], runner: next });
    }
  }
  return null;
}

function trapOpen(r: Runner, x: number, y: number): boolean {
  return isTrapOpen(r.buttonPressCtx, x, y);
}

const goals: { label: string; depth: number; nodes: number; done: (r: Runner) => boolean }[] = [
  {
    label: "trap1 open",
    depth: 12,
    nodes: 400_000,
    done: (r) => trapOpen(r, 18, 7),
  },
  {
    label: "trap2 open",
    depth: 20,
    nodes: 800_000,
    done: (r) => trapOpen(r, 18, 10),
  },
  {
    label: "clone spawned",
    depth: 25,
    nodes: 800_000,
    done: (r) => r.monsters.filter((m) => m.alive && m.kind === "fireball").length >= 2,
  },
  {
    label: "exit",
    depth: 40,
    nodes: 1_500_000,
    done: (r) => r.completed,
  },
];

let r = createMsCc1SimulationRunner(structuredClone(level));
const full: Action[] = [];

for (const g of goals) {
  const seg = segmentBfs(r, g.depth, g.nodes, g.done);
  if (!seg) {
    console.error("FAIL", g.label, "pos", r.gx, r.gy);
    process.exit(1);
  }
  console.log(g.label, "actions", seg.length, "waits", seg.filter((a) => a === WAIT).length);
  full.push(...seg);
  r = apply(r, seg);
  console.log("  -> pos", r.gx, r.gy, "completed", r.completed);
}

const chipMoves = full.filter((a): a is Direction => a !== WAIT);
fs.writeFileSync(path.join(__dirname, "level005-solution.json"), `${JSON.stringify(chipMoves)}\n`);

const verify = simulateMsCc1Level(structuredClone(level), chipMoves);
const autoplay = simulateMsCc1AutoplayLevel(structuredClone(level), chipMoves);
console.log("chip moves", chipMoves.length, verify.completed, autoplay.completed);
console.log(JSON.stringify(chipMoves));
