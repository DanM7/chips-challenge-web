/**
 * Level 5: manual StrategyWiki prefix + segmented BFS.
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
  stepMsCc1Simulation,
  stepMsCc1Wait,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
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

function applyChipMoves(start: Runner, seq: Direction[], withWait = false): Runner {
  const r = cloneMsCc1SimulationRunner(start);
  for (let i = 0; i < seq.length; i++) {
    if (withWait && i > 0) stepMsCc1Wait(r);
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
  withWait = false,
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
      if (withWait && f.seq.length > 0) stepMsCc1Wait(next);
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

// StrategyWiki: release pink ball (toggle), red key, glider into bomb via brown buttons
const prefix: Direction[] = [
  "up", "up", "right", "up", "up", "up", "up",
  "left", "left", "left", "left", "left",
  "right", "left",
  "right", "right", "right", "right", "right",
  "down", "down", "down", "down", "down", "down",
];

const goals: { label: string; depth: number; nodes: number; withWait?: boolean; done: (r: Runner) => boolean }[] = [
  {
    label: "toggle closed (ball released)",
    depth: 8,
    nodes: 50_000,
    done: (r) => getCompositeTile(r.level, 16, 15) === "block_toggle_closed",
  },
  {
    label: "red key",
    depth: 30,
    nodes: 400_000,
    withWait: true,
    done: (r) => r.playerState.keys.includes("red"),
  },
  {
    label: "north of door",
    depth: 18,
    nodes: 200_000,
    done: (r) => r.gy <= 12 && r.gx <= 18,
  },
  {
    label: "trap1 open",
    depth: 12,
    nodes: 200_000,
    done: (r) => isTrapOpen(r.buttonPressCtx, 18, 7),
  },
  {
    label: "trap2 open",
    depth: 12,
    nodes: 200_000,
    done: (r) => isTrapOpen(r.buttonPressCtx, 18, 10),
  },
  {
    label: "win",
    depth: 20,
    nodes: 300_000,
    done: (r) => r.completed,
  },
];

let r = applyChipMoves(createMsCc1SimulationRunner(structuredClone(level)), prefix);
console.log("after prefix", r.gx, r.gy, getCompositeTile(r.level, 16, 15));
if (r.playerDied) {
  console.error("prefix died");
  process.exit(1);
}

const full = [...prefix];
for (const g of goals) {
  const seg = segmentBfs(r, g.depth, g.nodes, g.done, g.withWait);
  if (!seg) {
    console.error("FAIL", g.label, "pos", r.gx, r.gy, "keys", r.playerState.keys);
    process.exit(1);
  }
  console.log(g.label, seg.length, seg.map((d) => d[0]).join(""));
  full.push(...seg);
  r = applyChipMoves(r, seg, g.withWait);
}

const verify = applyChipMoves(createMsCc1SimulationRunner(structuredClone(level)), full);
const rem = msSecondsRemaining(100, verify.buttonPressCtx.moveBoundary);
console.log({
  moves: full.length,
  ticks: verify.buttonPressCtx.moveBoundary,
  rem,
  bold: rem >= 85,
  completed: verify.completed,
});
console.log(full.map((d) => d[0]!.toUpperCase()).join(" "));

if (verify.completed && rem >= 85) {
  fs.writeFileSync(path.join(__dirname, "level005-solution.json"), JSON.stringify(full) + "\n");
}
