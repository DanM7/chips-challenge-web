#!/usr/bin/env node
/** BFS suffix from level 11 TWS end state (2 chips left) to exit. */
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
  stepMsCc1Wait,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { encodeSolutionMoves } from "../engine/solutionMoves.js";
import { replayTwsRecords } from "../engine/twsReplay.js";
import { readLevelSolution, writeLevelSolution } from "../integration/solutionStorage.js";

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

const TWS_DIR: Direction[] = ["up", "left", "down", "right"];
const dirs: Direction[] = ["up", "down", "left", "right"];

function loadLevel(): LevelData {
  const level = JSON.parse(
    fs.readFileSync(path.join(levelsDir, "level-011.json"), "utf8"),
  ) as LevelData;
  normalizeLevelLayers(level);
  return level;
}

function replayTwsPrefix(
  level: LevelData,
  records: { tick: number; direction: number }[],
): ReturnType<typeof createMsCc1SimulationRunner> {
  const runner = createMsCc1SimulationRunner(structuredClone(level));
  let prevTick = 0;
  for (const rec of records) {
    const dir = TWS_DIR[rec.direction];
    if (!dir) {
      continue;
    }
    const gap = Math.max(0, rec.tick - prevTick - 1);
    for (let i = 0; i < gap; i += 1) {
      if (stepMsCc1Wait(runner)) {
        return runner;
      }
    }
    if (stepMsCc1Wait(runner)) {
      return runner;
    }
    if (stepMsCc1Simulation(runner, dir)) {
      return runner;
    }
    prevTick = rec.tick;
  }
  return runner;
}

function bfsFinish(
  start: ReturnType<typeof createMsCc1SimulationRunner>,
  maxDepth: number,
  maxNodes: number,
): Direction[] | null {
  const q: { seq: Direction[]; runner: ReturnType<typeof createMsCc1SimulationRunner> }[] = [
    { seq: [], runner: start },
  ];
  const seen = new Set<string>([msCc1RunnerStateKey(start)]);
  let nodes = 0;
  while (q.length > 0 && nodes < maxNodes) {
    const frame = q.shift()!;
    nodes += 1;
    if (frame.runner.completed) {
      return frame.seq;
    }
    if (frame.runner.playerDied || frame.seq.length >= maxDepth) {
      continue;
    }
    for (const d of dirs) {
      const next = cloneMsCc1SimulationRunner(frame.runner);
      const before = msCc1RunnerStateKey(next);
      if (frame.seq.length > 0) {
        stepMsCc1Wait(next);
      }
      stepMsCc1Simulation(next, d);
      if (next.playerDied) {
        continue;
      }
      const after = msCc1RunnerStateKey(next);
      if (after === before || seen.has(after)) {
        continue;
      }
      seen.add(after);
      q.push({ seq: [...frame.seq, d], runner: next });
    }
  }
  console.error("BFS expanded", nodes, "without completion");
  return null;
}

const entry = readLevelSolution<{
  levelId: string;
  timeLimitSeconds: number;
  boldTimeRemaining: number;
  twsRecords: { tick: number; direction: number }[];
}>(11)!;
const level = loadLevel();
const prefixRunner = replayTwsPrefix(level, entry.twsRecords);
console.log(
  "TWS prefix:",
  prefixRunner.gx,
  prefixRunner.gy,
  "chips",
  prefixRunner.playerState.chipsRemainingOnMap,
  "rem",
  msSecondsRemaining(entry.timeLimitSeconds, prefixRunner.buttonPressCtx.moveBoundary),
);

const suffix = bfsFinish(prefixRunner, 80, 500_000);
if (!suffix) {
  process.exit(1);
}

const twsReplay = replayTwsRecords(structuredClone(level), entry.twsRecords);
const allMoves = [...twsReplay.chipMoves, ...suffix];

const verifyRunner = createMsCc1SimulationRunner(structuredClone(level));
for (const move of allMoves) {
  if (stepMsCc1Simulation(verifyRunner, move)) {
    break;
  }
}

const rem = msSecondsRemaining(entry.timeLimitSeconds, verifyRunner.buttonPressCtx.moveBoundary);
console.log(
  "Full route:",
  allMoves.length,
  "moves, completed",
  verifyRunner.completed,
  "rem",
  rem,
  "bold",
  entry.boldTimeRemaining,
);

if (!verifyRunner.completed) {
  process.exit(1);
}

const updated = {
  ...entry,
  moves: encodeSolutionMoves(allMoves),
  moveVerified: true,
  meetsBoldBudget: rem >= entry.boldTimeRemaining,
  moveSource: "CC1-ms TWS prefix + BFS suffix; StrategyWiki bold 211",
  walkthroughUrl: "https://strategywiki.org/wiki/Chip%27s_Challenge/Levels_1-20",
};
writeLevelSolution(11, updated);
const { twsRecords, twsRecordSource, ...webEntry } = updated as Record<string, unknown> & {
  twsRecords?: unknown;
  twsRecordSource?: unknown;
};
fs.mkdirSync(webSolutionsDir, { recursive: true });
fs.writeFileSync(
  path.join(webSolutionsDir, "level-011.json"),
  `${JSON.stringify(webEntry, null, 2)}\n`,
);
console.log("Wrote level-011.json", { rem, meetsBold: rem >= entry.boldTimeRemaining });
