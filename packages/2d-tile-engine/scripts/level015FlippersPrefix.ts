import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  cloneMsCc1SimulationRunner,
  createMsCc1SimulationRunner,
  msCc1RunnerStateKey,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import { encodeSolutionMoves } from "../engine/solutionMoves.js";
import type { Direction, LevelData } from "../engine/types.js";

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

const dirs: Direction[] = ["up", "down", "left", "right"];
type Runner = ReturnType<typeof createMsCc1SimulationRunner>;

function segmentBfs(start: Runner, maxDepth: number, maxNodes: number, done: (r: Runner) => boolean) {
  type Frame = { seq: Direction[]; runner: Runner };
  const q: Frame[] = [{ seq: [], runner: start }];
  const seen = new Set<string>([msCc1RunnerStateKey(start)]);
  let n = 0;
  while (q.length && n < maxNodes) {
    const f = q.shift()!;
    n++;
    if (done(f.runner)) return f.seq;
    if (f.seq.length >= maxDepth || f.runner.playerDied) continue;
    for (const d of dirs) {
      const next = cloneMsCc1SimulationRunner(f.runner);
      stepMsCc1Simulation(next, d);
      if (next.playerDied) continue;
      const key = msCc1RunnerStateKey(next);
      if (seen.has(key)) continue;
      seen.add(key);
      q.push({ seq: [...f.seq, d], runner: next });
    }
  }
  return null;
}

const start = createMsCc1SimulationRunner(structuredClone(level));
const seg = segmentBfs(
  start,
  40,
  300_000,
  (r) => r.playerState.tools.includes("flippers"),
);
console.log("moves", seg?.length, encodeSolutionMoves(seg ?? []));
