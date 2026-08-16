import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
} from "../engine/msCc1/msCc1Simulation.js";
import { readLevelSolution } from "../integration/solutionStorage.js";
import type { Direction, LevelData } from "../engine/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const n = Number.parseInt(process.argv[2] ?? "20", 10);
const parity = (process.argv[3] as "even" | "odd") ?? "even";
const TWS_DIR: Direction[] = ["up", "left", "down", "right"];

const level = JSON.parse(
  readFileSync(
    path.join(
      root,
      `../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-${String(n).padStart(3, "0")}.json`,
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);
const sol = readLevelSolution<{ twsRecords: { tick: number; direction: number }[] }>(n)!;

const runner = createMsCc1SimulationRunner(structuredClone(level));
runner.buttonPressCtx.stepParity = parity;
let prevTick = 0;
let chipStep = 0;

for (const rec of sol.twsRecords) {
  const dir = TWS_DIR[rec.direction];
  if (!dir) continue;
  const gap = Math.max(0, rec.tick - prevTick - 1);
  for (let i = 0; i < gap; i += 1) {
    stepMsCc1Wait(runner);
    if (runner.playerDied) {
      console.log(`died during wait before step ${chipStep + 1}, tick gap ${gap}, pos ${runner.gx},${runner.gy}`);
      process.exit(0);
    }
  }
  stepMsCc1Wait(runner);
  chipStep += 1;
  stepMsCc1Simulation(runner, dir);
  const monsters = runner.monsters
    .filter((m) => m.alive)
    .map((m) => `${m.kind}@${m.x},${m.y}${m.direction[0]}`);
  if (chipStep <= 8 || runner.playerDied || runner.completed) {
    console.log(
      `#${chipStep} ${dir[0]!.toUpperCase()} tick=${rec.tick} pos=${runner.gx},${runner.gy} tile=${getCompositeTile(runner.level, runner.gx, runner.gy)} mb=${runner.buttonPressCtx.moveBoundary} monsters=${monsters.slice(0, 6).join(";")}`,
    );
  }
  if (runner.playerDied || runner.completed) break;
  prevTick = rec.tick;
}
console.log({ completed: runner.completed, died: runner.playerDied, death: runner.deathMessage, chipStep });
