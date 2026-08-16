import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import { COLLECTIBLE_CHIP_TILE_ID } from "../tile-engine/tiles.js";
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
const levelNumber = Number.parseInt(process.argv[2] ?? "14", 10);
const boldTarget = Number.parseInt(process.argv[3] ?? "204", 10);
const timeLimit = Number.parseInt(process.argv[4] ?? "250", 10);
const maxDepth = Number.parseInt(process.argv[5] ?? "400", 10);
const maxTicks = (timeLimit - boldTarget) * 5 + 4;

const level = JSON.parse(
  readFileSync(
    path.join(
      root,
      `../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-${String(levelNumber).padStart(3, "0")}.json`,
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

const dirs: Direction[] = ["up", "down", "left", "right"];

function scoreRunner(runner: ReturnType<typeof createMsCc1SimulationRunner>): number {
  const chips = runner.playerState.chipsRemainingOnMap;
  if (chips === 0) {
    return 10_000 - runner.buttonPressCtx.moveBoundary;
  }
  let nearest = 999;
  for (let y = 0; y < runner.level.height; y += 1) {
    for (let x = 0; x < runner.level.width; x += 1) {
      if (getCompositeTile(runner.level, x, y) === COLLECTIBLE_CHIP_TILE_ID) {
        const d = Math.abs(x - runner.gx) + Math.abs(y - runner.gy);
        if (d < nearest) nearest = d;
      }
    }
  }
  return (100 - chips) * 100 - nearest * 3 - runner.buttonPressCtx.moveBoundary;
}

type Frame = { moves: Direction[]; runner: ReturnType<typeof createMsCc1SimulationRunner> };
const q: Frame[] = [{ moves: [], runner: createMsCc1SimulationRunner(structuredClone(level)) }];
const seen = new Set<string>();
let bestComplete: Frame | null = null;

while (q.length > 0 && seen.size < 2_000_000) {
  q.sort((a, b) => scoreRunner(b.runner) - scoreRunner(a.runner));
  const frame = q.shift()!;
  const ticks = frame.runner.buttonPressCtx.moveBoundary;
  if (ticks > maxTicks) {
    continue;
  }

  if (frame.runner.completed) {
    const rem = msSecondsRemaining(timeLimit, ticks);
    if (rem >= boldTarget && (!bestComplete || ticks < bestComplete.runner.buttonPressCtx.moveBoundary)) {
      bestComplete = frame;
      console.log("candidate", { rem, ticks, moves: frame.moves.length });
    }
    continue;
  }

  if (frame.runner.playerDied || frame.moves.length >= maxDepth) {
    continue;
  }

  const key = msCc1RunnerStateKey(frame.runner);
  if (seen.has(key)) continue;
  seen.add(key);

  for (const dir of dirs) {
    const next = cloneMsCc1SimulationRunner(frame.runner);
    if (stepMsCc1Simulation(next, dir)) {
      if (next.completed) {
        const rem = msSecondsRemaining(timeLimit, next.buttonPressCtx.moveBoundary);
        if (rem >= boldTarget) {
          bestComplete = { moves: [...frame.moves, dir], runner: next };
          console.log("candidate", {
            rem,
            ticks: next.buttonPressCtx.moveBoundary,
            moves: bestComplete.moves.length,
          });
        }
      }
      continue;
    }
    if (!next.playerDied && next.buttonPressCtx.moveBoundary <= maxTicks) {
      q.push({ moves: [...frame.moves, dir], runner: next });
    }
  }
}

if (!bestComplete) {
  console.log("No bold solution found", { states: seen.size, maxTicks, boldTarget });
  process.exit(1);
}

const ticks = bestComplete.runner.buttonPressCtx.moveBoundary;
const rem = msSecondsRemaining(timeLimit, ticks);
console.log({
  levelNumber,
  boldTarget,
  rem,
  ticks,
  moves: bestComplete.moves.length,
  encoded: encodeSolutionMoves(bestComplete.moves),
});
