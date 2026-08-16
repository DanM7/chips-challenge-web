#!/usr/bin/env node
/** Trace TWS replay failure for a level (tools, position, death). */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import type { Direction, LevelData } from "../engine/types.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
} from "../engine/msCc1/msCc1Simulation.js";
import { readLevelSolution } from "../integration/solutionStorage.js";

const levelNum = Number.parseInt(process.argv[2] ?? "21", 10);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const levelsDir = path.join(
  root,
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels",
);

const TWS_DIR: Direction[] = ["up", "left", "down", "right"];
const entry = readLevelSolution<{ levelId: string; twsRecords: { tick: number; direction: number }[] }>(
  levelNum,
);
const level = JSON.parse(
  fs.readFileSync(path.join(levelsDir, `${entry!.levelId}.json`), "utf8"),
) as LevelData;
normalizeLevelLayers(level);

const runner = createMsCc1SimulationRunner(structuredClone(level));
let prevTick = 0;
let moveIndex = 0;

function log(event: string): void {
  const tools = runner.playerState.tools.join("+") || "-";
  const tile = getCompositeTile(runner.level, runner.gx, runner.gy);
  console.log(
    `${event.padEnd(12)} @ ${runner.gx},${runner.gy} tile=${tile} tools=${tools} chips=${runner.playerState.chipsRemainingOnMap}`,
  );
}

log("start");
for (const rec of entry!.twsRecords) {
  const dir = TWS_DIR[rec.direction];
  if (!dir) continue;
  const gap = Math.max(0, rec.tick - prevTick - 1);
  for (let i = 0; i < gap; i += 1) {
    stepMsCc1Wait(runner);
    if (runner.playerDied || runner.completed) {
      log(`wait-death gap=${gap} i=${i}`);
      console.log("death:", runner.deathMessage);
      process.exit(0);
    }
  }
  stepMsCc1Wait(runner);
  if (runner.playerDied || runner.completed) {
    log("pre-move-death");
    console.log("death:", runner.deathMessage);
    process.exit(0);
  }
  moveIndex += 1;
  stepMsCc1Simulation(runner, dir);
  log(`move #${moveIndex} ${dir} tick=${rec.tick}`);
  prevTick = rec.tick;
  if (runner.playerDied || runner.completed) {
    console.log("death:", runner.deathMessage, "completed:", runner.completed);
    process.exit(0);
  }
}
console.log("finished without win", runner.gx, runner.gy);
