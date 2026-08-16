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
      "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-014.json",
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

const dirs: Direction[] = ["up", "down", "left", "right"];
const start = createMsCc1SimulationRunner(structuredClone(level));

type Frame = { seq: Direction[]; runner: ReturnType<typeof createMsCc1SimulationRunner> };
const q: Frame[] = [{ seq: [], runner: start }];
const seen = new Set<string>([msCc1RunnerStateKey(start)]);

while (q.length && seen.size < 100_000) {
  const f = q.shift()!;
  if (f.runner.playerState.keys.length > 0 && f.runner.gx > 5) {
    console.log("found", encodeSolutionMoves(f.seq), f.runner.buttonPressCtx.moveBoundary);
    break;
  }
  if (f.seq.length >= 12) continue;
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

for (const opener of ["LLD", "DLRLD", "LRLU", "LDLRLD"]) {
  const r = createMsCc1SimulationRunner(structuredClone(level));
  const map: Record<string, Direction> = { L: "left", R: "right", U: "up", D: "down" };
  for (const c of opener) stepMsCc1Simulation(r, map[c]!);
  console.log(opener, {
    x: r.gx,
    y: r.gy,
    keys: r.playerState.keys,
    ticks: r.buttonPressCtx.moveBoundary,
  });
}
