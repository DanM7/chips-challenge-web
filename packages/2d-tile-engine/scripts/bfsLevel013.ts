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
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { encodeSolutionMoves } from "../engine/solutionMoves.js";
import type { Direction, LevelData } from "../engine/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const level = JSON.parse(
  readFileSync(
    path.join(
      root,
      "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-013.json",
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

const DIRS: Direction[] = ["up", "down", "left", "right"];
const MAX_DEPTH = 120;
const MAX_STATES = 500_000;

type Frame = { moves: Direction[]; runner: ReturnType<typeof createMsCc1SimulationRunner> };
const q: Frame[] = [{ moves: [], runner: createMsCc1SimulationRunner(structuredClone(level)) }];
const seen = new Set<string>();
let best: Frame | null = null;

while (q.length > 0 && seen.size < MAX_STATES) {
  const frame = q.shift()!;
  if (frame.runner.completed) {
    best = frame;
    break;
  }
  if (frame.moves.length >= MAX_DEPTH || frame.runner.playerDied) {
    continue;
  }
  const key = msCc1RunnerStateKey(frame.runner);
  if (seen.has(key)) {
    continue;
  }
  seen.add(key);

  for (const dir of DIRS) {
    const next = cloneMsCc1SimulationRunner(frame.runner);
    if (stepMsCc1Simulation(next, dir)) {
      if (next.completed) {
        best = { moves: [...frame.moves, dir], runner: next };
        q.length = 0;
        break;
      }
      continue;
    }
    if (!next.playerDied) {
      q.push({ moves: [...frame.moves, dir], runner: next });
    }
  }
}

if (!best) {
  console.log("No solution found within limits", { states: seen.size, queue: q.length });
  process.exit(1);
}

const ticks = best.runner.buttonPressCtx.moveBoundary;
const rem = msSecondsRemaining(999, ticks);
console.log({
  moves: best.moves.length,
  ticks,
  rem,
  bold: 982,
  meets: rem >= 982,
  pos: { x: best.runner.gx, y: best.runner.gy },
  encoded: encodeSolutionMoves(best.moves),
  route: encodeSolutionMoves(best.moves).join(""),
});
