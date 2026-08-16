#!/usr/bin/env node
/** Apply StrategyWiki Brushfire bold route to level 10 solution files. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { decodeSolutionMoves, encodeSolutionMoves } from "../engine/solutionMoves.js";
import { readLevelSolution, writeLevelSolution } from "../integration/solutionStorage.js";
import type { LevelData } from "../engine/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const levelsDir = path.join(
  root,
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels",
);
const webSolutionsDir = path.join(
  root,
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/data/cc1-ms-solutions",
);

const WALKTHROUGH =
  "4D 4R 4U 12R 3D 3L U 7L 7D L 3D 8R U 10R 10D 4R 2U L 3U R 2U L 6U 3R 18D 5L 2U 10L 7U 5R";

function expandWalkthrough(notation: string): string[] {
  const moves: string[] = [];
  for (const tok of notation.split(/\s+/)) {
    const m = tok.match(/^(\d+)?([UDLR])$/);
    if (!m) {
      throw new Error(`bad token: ${tok}`);
    }
    const n = m[1] ? Number.parseInt(m[1], 10) : 1;
    for (let i = 0; i < n; i += 1) {
      moves.push(m[2]!);
    }
  }
  return moves;
}

const entry = readLevelSolution<Record<string, unknown>>(10)!;
const level = JSON.parse(
  fs.readFileSync(path.join(levelsDir, "level-010.json"), "utf8"),
) as LevelData;
normalizeLevelLayers(level);

const moves = expandWalkthrough(WALKTHROUGH);
const runner = createMsCc1SimulationRunner(structuredClone(level));
for (const d of decodeSolutionMoves(moves)) {
  if (stepMsCc1Simulation(runner, d)) {
    break;
  }
}
const rem = msSecondsRemaining(entry.timeLimitSeconds as number, runner.buttonPressCtx.moveBoundary);
console.log({ completed: runner.completed, rem, bold: entry.boldTimeRemaining, ticks: runner.buttonPressCtx.moveBoundary });
if (!runner.completed || rem < (entry.boldTimeRemaining as number)) {
  process.exit(1);
}

const updated = {
  ...entry,
  moves: encodeSolutionMoves(moves),
  moveVerified: true,
  meetsBoldBudget: true,
  moveSource: "StrategyWiki Levels 1-20 Brushfire bold route (51 remaining)",
  walkthroughUrl: "https://strategywiki.org/wiki/Chip%27s_Challenge/Levels_1-20",
};
writeLevelSolution(10, updated);
const { twsRecords, twsRecordSource, ...webEntry } = updated;
fs.mkdirSync(webSolutionsDir, { recursive: true });
fs.writeFileSync(
  path.join(webSolutionsDir, "level-010.json"),
  `${JSON.stringify(webEntry, null, 2)}\n`,
);
console.log("Wrote level-010.json");
