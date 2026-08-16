/**
 * Level 5 walkthrough segments (chip moves + autoplay idle between steps).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { Direction, LevelData } from "../engine/types.js";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import {
  cloneMsCc1SimulationRunner,
  createMsCc1SimulationRunner,
  msCc1RunnerStateKey,
  simulateMsCc1AutoplayLevel,
  stepMsCc1Simulation,
  stepMsCc1Wait,
} from "../engine/msCc1/msCc1Simulation.js";
import { isTrapOpen } from "../engine/msCc1/msCc1Traps.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dirs: Direction[] = ["up", "down", "left", "right"];

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

function applyChipMoves(start: Runner, seq: Direction[]): Runner {
  const r = cloneMsCc1SimulationRunner(start);
  for (let i = 0; i < seq.length; i++) {
    if (i > 0) stepMsCc1Wait(r);
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
): Direction[] | null {
  const q: { seq: Direction[]; runner: Runner }[] = [{ seq: [], runner: start }];
  const seen = new Set<string>([msCc1RunnerStateKey(start)]);
  let n = 0;
  while (q.length && n < maxNodes) {
    const f = q.shift()!;
    n++;
    if (done(f.runner)) return f.seq;
    if (f.seq.length >= maxDepth || f.runner.playerDied) continue;
    for (const d of dirs) {
      const next = cloneMsCc1SimulationRunner(f.runner);
      const before = msCc1RunnerStateKey(next);
      if (f.seq.length > 0) stepMsCc1Wait(next);
      stepMsCc1Simulation(next, d);
      if (next.playerDied) continue;
      const after = msCc1RunnerStateKey(next);
      if (after === before || seen.has(after)) continue;
      seen.add(after);
      q.push({ seq: [...f.seq, d], runner: next });
    }
  }
  console.error("segment expanded", n);
  return null;
}

const goals: { label: string; depth: number; nodes: number; done: (r: Runner) => boolean }[] = [
  {
    label: "toggle open",
    depth: 15,
    nodes: 200_000,
    done: (r) => getCompositeTile(r.level, 16, 15) === "block_toggle_open",
  },
  {
    label: "toggle closed (ball trap)",
    depth: 8,
    nodes: 100_000,
    done: (r) => getCompositeTile(r.level, 16, 15) === "block_toggle_closed",
  },
  {
    label: "red key",
    depth: 35,
    nodes: 600_000,
    done: (r) => r.playerState.keys.includes("red"),
  },
  {
    label: "north of door",
    depth: 20,
    nodes: 300_000,
    done: (r) => r.gy <= 12 && r.gx <= 18,
  },
  {
    label: "trap1",
    depth: 15,
    nodes: 300_000,
    done: (r) => isTrapOpen(r.buttonPressCtx, 18, 7),
  },
  {
    label: "trap2",
    depth: 15,
    nodes: 300_000,
    done: (r) => isTrapOpen(r.buttonPressCtx, 18, 10),
  },
  {
    label: "win",
    depth: 25,
    nodes: 400_000,
    done: (r) => r.completed,
  },
];

let r = createMsCc1SimulationRunner(structuredClone(level));
const full: Direction[] = [];

for (const g of goals) {
  const seg = segmentBfs(r, g.depth, g.nodes, g.done);
  if (!seg) {
    console.error("FAIL", g.label, "pos", r.gx, r.gy, "keys", r.playerState.keys);
    process.exit(1);
  }
  console.log(g.label, seg.length);
  full.push(...seg);
  r = applyChipMoves(r, seg);
}

fs.writeFileSync(path.join(__dirname, "level005-solution.json"), `${JSON.stringify(full)}\n`);
console.log("SOLVED", full.length, simulateMsCc1AutoplayLevel(structuredClone(level), full).completed);
