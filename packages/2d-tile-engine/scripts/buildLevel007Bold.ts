/**
 * Level 7: segmented search — fire boots only before thief (StrategyWiki).
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
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dirs: Direction[] = ["up", "down", "left", "right"];

const level = JSON.parse(
  fs.readFileSync(
    path.join(
      __dirname,
      "../../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-007.json",
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

type Runner = ReturnType<typeof createMsCc1SimulationRunner>;

function apply(start: Runner, seq: Direction[]): Runner {
  const r = cloneMsCc1SimulationRunner(start);
  for (const d of seq) {
    stepMsCc1Simulation(r, d);
    if (r.completed || r.playerDied) break;
  }
  return r;
}

function bfs(
  start: Runner,
  maxDepth: number,
  maxNodes: number,
  done: (r: Runner) => boolean,
  prune?: (r: Runner) => boolean,
): { seq: Direction[]; ticks: number } | null {
  const q: { seq: Direction[]; runner: Runner }[] = [{ seq: [], runner: start }];
  const seen = new Map<string, number>();
  seen.set(msCc1RunnerStateKey(start), start.buttonPressCtx.moveBoundary);
  let n = 0;
  let best: { seq: Direction[]; ticks: number; rem: number } | null = null;
  while (q.length && n < maxNodes) {
    const f = q.shift()!;
    n++;
    if (done(f.runner)) {
      const ticks = f.runner.buttonPressCtx.moveBoundary;
      const rem = msSecondsRemaining(150, ticks);
      if (!best || rem > best.rem || (rem === best.rem && ticks < best.ticks)) {
        best = { seq: f.seq, ticks, rem };
        console.log("goal", f.seq.length, "ticks", ticks, "rem", rem);
      }
      continue;
    }
    if (f.seq.length >= maxDepth || f.runner.playerDied) continue;
    if (prune?.(f.runner)) continue;
    for (const d of dirs) {
      const next = cloneMsCc1SimulationRunner(f.runner);
      const before = msCc1RunnerStateKey(next);
      stepMsCc1Simulation(next, d);
      if (next.playerDied) continue;
      const after = msCc1RunnerStateKey(next);
      if (after === before) continue;
      const ticks = next.buttonPressCtx.moveBoundary;
      const prev = seen.get(after);
      if (prev !== undefined && prev <= ticks) continue;
      seen.set(after, ticks);
      q.push({ seq: [...f.seq, d], runner: next });
    }
  }
  return best;
}

// Phase 1: reach first chip with at most fire boots (no flippers before thief area)
const phase1 = bfs(
  createMsCc1SimulationRunner(structuredClone(level)),
  25,
  500_000,
  (r) => r.playerState.chipsRemainingOnMap === 2 && r.gx >= 12 && r.gy >= 12,
  (r) => r.playerState.tools.includes("flippers"),
);
if (!phase1) {
  console.error("phase1 fail");
  process.exit(1);
}
console.log("phase1", phase1.seq.map((d) => d[0]).join(""));

let r = apply(createMsCc1SimulationRunner(structuredClone(level)), phase1.seq);
const full = [...phase1.seq];

// Phase 2: through thief to 1 chip left, still no flippers before thief
const phase2 = bfs(
  r,
  30,
  800_000,
  (r) => r.playerState.chipsRemainingOnMap === 1 && !r.playerState.tools.includes("flippers"),
);
if (!phase2) {
  console.error("phase2 fail at", r.gx, r.gy);
  process.exit(1);
}
console.log("phase2", phase2.seq.map((d) => d[0]).join(""));
full.push(...phase2.seq);
r = apply(r, phase2.seq);

// Phase 3: win
const phase3 = bfs(r, 25, 500_000, (r) => r.completed);
if (!phase3) {
  console.error("phase3 fail at", r.gx, r.gy);
  process.exit(1);
}
console.log("phase3", phase3.seq.map((d) => d[0]).join(""));
full.push(...phase3.seq);

const verify = apply(createMsCc1SimulationRunner(structuredClone(level)), full);
const rem = msSecondsRemaining(150, verify.buttonPressCtx.moveBoundary);
console.log("TOTAL", full.length, "ticks", verify.buttonPressCtx.moveBoundary, "rem", rem, "bold", rem >= 139);
console.log(full.map((d) => d[0]!.toUpperCase()).join(" "));
fs.writeFileSync(path.join(__dirname, "level007-bold.json"), JSON.stringify({ seq: full, rem }, null, 2));
