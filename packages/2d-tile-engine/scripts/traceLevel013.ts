import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
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

const route: Direction[] = ["down", "up", "up", "right"];
const runner = createMsCc1SimulationRunner(structuredClone(level));
console.log("start", runner.gx, runner.gy, getCompositeTile(runner.level, runner.gx, runner.gy));
for (const d of route) {
  const bx = runner.gx;
  const by = runner.gy;
  stepMsCc1Simulation(runner, d);
  console.log(
    d,
    "->",
    runner.gx,
    runner.gy,
    getCompositeTile(runner.level, runner.gx, runner.gy),
    "completed",
    runner.completed,
  );
}

console.log("exit?", runner.completed, "ticks", runner.buttonPressCtx.moveBoundary);
