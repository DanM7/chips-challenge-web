import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { encodeSolutionMoves } from "../engine/solutionMoves.js";
import type { Direction, LevelData } from "../engine/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const level = JSON.parse(
  readFileSync(
    path.join(root, "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-018.json"),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

const dirMap: Record<string, Direction> = {
  L: "left",
  R: "right",
  U: "up",
  D: "down",
};

function run(letters: string) {
  const runner = createMsCc1SimulationRunner(structuredClone(level));
  const dirs: Direction[] = [];
  for (const ch of letters.replace(/\s/g, "")) {
    const d = dirMap[ch];
    if (!d) continue;
    dirs.push(d);
    const before = { x: runner.gx, y: runner.gy };
    stepMsCc1Simulation(runner, d);
    console.log(
      ch,
      `${before.x},${before.y}->${runner.gx},${runner.gy}`,
      getCompositeTile(runner.level, runner.gx, runner.gy),
      runner.playerState.hasFlippers ? "FLIP" : "",
    );
    if (runner.playerDied || runner.completed) break;
  }
  return {
    completed: runner.completed,
    pos: `${runner.gx},${runner.gy}`,
    flippers: runner.playerState.hasFlippers,
    rem: msSecondsRemaining(600, runner.buttonPressCtx.moveBoundary),
    ticks: runner.buttonPressCtx.moveBoundary,
    moves: encodeSolutionMoves(dirs.slice(0, runner.chipMoves)),
  };
}

for (const route of [
  "RRRRRRRRRRRRRRRRRRRRRRRRRRR",
  "RRRRRRRRRRRRRRRRRRRRRRRRRRRD",
  "RRRRRRRRRRRRRRRRRRRRRRRRRRRDR",
  "L",
  "LL",
  "LLL",
  "LLLL",
  "LLLLU",
  "LLLLUU",
  "LLLLUUU",
  "LLLLUUUU",
  "LLLLUUUUU",
  "LLLLUUUUUU",
  "LLLLUUUUUUU",
  "LLLLUUUUUUUU",
  "LLLLUUUUUUUUU",
  "LLLLUUUUUUUUUU",
  "LLLLUUUUUUUUUUU",
  "LLLLUUUUUUUUUUUU",
  "LLLLUUUUUUUUUUUUU",
  "LLLLUUUUUUUUUUUUUU",
  "LLLLUUUUUUUUUUUUUUU",
  "LLLLUUUUUUUUUUUUUUUU",
  "LLLLUUUUUUUUUUUUUUUUU",
  "LLLLUUUUUUUUUUUUUUUUUU",
  "LLLLUUUUUUUUUUUUUUUUUUU",
  "LLLLUUUUUUUUUUUUUUUUUUUU",
]) {
  const r = run(route);
  console.log(route.length, route.slice(-8), "->", r.pos, r.flippers ? "FLIP" : "", "ticks", r.ticks);
}
