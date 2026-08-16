import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { decodeSolutionMoves, encodeSolutionMoves } from "../engine/solutionMoves.js";
import type { Direction, LevelData } from "../engine/types.js";
import { readLevelSolution, writeLevelSolution } from "../integration/solutionStorage.js";
import { replayTwsRecords } from "../engine/twsReplay.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const levelsDir = path.join(
  root,
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels",
);
const walkthroughUrl = "https://strategywiki.org/wiki/Chip%27s_Challenge/Levels_1-20";

function loadLevel(n: number): LevelData {
  const level = JSON.parse(
    readFileSync(path.join(levelsDir, `level-${String(n).padStart(3, "0")}.json`), "utf8"),
  ) as LevelData;
  normalizeLevelLayers(level);
  return level;
}

function simulateMoves(level: LevelData, moves: Direction[]) {
  const runner = createMsCc1SimulationRunner(structuredClone(level));
  for (const direction of moves) {
    if (stepMsCc1Simulation(runner, direction)) {
      break;
    }
  }
  return runner;
}

function scoreLimit(sol: { timeLimitSeconds: number | null }): number {
  return sol.timeLimitSeconds && sol.timeLimitSeconds > 0 ? sol.timeLimitSeconds : 999;
}

function report(levelNumber: number) {
  const level = loadLevel(levelNumber);
  const sol = readLevelSolution<{
    levelId: string;
    passwordMs: string;
    title: string;
    timeLimitSeconds: number | null;
    boldTimeRemaining: number;
    minChipMoves: number | null;
    moves: string[] | null;
    source: string;
    twsRecords?: { tick: number; direction: number }[];
    twsRecordSource?: string;
  }>(levelNumber)!;
  const limit = scoreLimit(sol);

  let moves: string[] | null = null;
  let ticks = 0;
  let completed = false;
  let moveSource = "";

  if (sol.twsRecords?.length) {
    const tws = replayTwsRecords(structuredClone(level), sol.twsRecords);
    if (tws.completed && !tws.playerDied) {
      moves = encodeSolutionMoves(tws.chipMoves);
      const runner = simulateMoves(level, tws.chipMoves);
      ticks = runner.buttonPressCtx.moveBoundary;
      completed = true;
      moveSource = `CC1-ms TWS records (${sol.passwordMs}); engine-verified`;
    }
  }

  if (!completed && sol.moves?.length) {
    const runner = simulateMoves(level, decodeSolutionMoves(sol.moves));
    if (runner.completed && !runner.playerDied) {
      moves = sol.moves;
      ticks = runner.buttonPressCtx.moveBoundary;
      completed = true;
      moveSource = sol.moves === moves ? "stored moves" : moveSource;
    }
  }

  const remaining = msSecondsRemaining(limit, ticks);
  const meets = completed && remaining >= sol.boldTimeRemaining;

  return {
    levelNumber,
    completed,
    remaining,
    bold: sol.boldTimeRemaining,
    meets,
    ticks,
    moveCount: moves?.length ?? 0,
    limit,
    entry: {
      ...sol,
      timeLimitSeconds: limit === 999 ? 999 : sol.timeLimitSeconds,
      moves,
      moveVerified: completed,
      meetsBoldBudget: meets,
      moveSource,
      walkthroughUrl,
      simulatedTicks: ticks,
      simulatedSecondsRemaining: remaining,
    },
  };
}

const results = [13, 14, 15, 16].map(report);
for (const r of results) {
  console.log(
    `L${r.levelNumber}: rem=${r.remaining} bold=${r.bold} meets=${r.meets} ticks=${r.ticks} moves=${r.moveCount}`,
  );
}

// Level 13: use BFS-found route if TWS fails
const l13 = results[0]!;
if (!l13.completed) {
  const level = loadLevel(13);
  const route: Direction[] = ["down", "up", "up", "right"];
  const runner = simulateMoves(level, route);
  if (runner.completed) {
    const limit = 999;
    const ticks = runner.buttonPressCtx.moveBoundary;
    const remaining = msSecondsRemaining(limit, ticks);
    console.log("L13 fallback DUUR:", { ticks, remaining, meets: remaining >= 982 });
    writeLevelSolution(13, {
      levelId: "level-013",
      passwordMs: "OCKS",
      title: "Southpole",
      timeLimitSeconds: 999,
      boldTimeRemaining: 982,
      minChipMoves: route.length,
      moves: encodeSolutionMoves(route),
      source: "https://scores.bitbusters.club/levels/cc1/13/ms",
      walkthroughUrl,
      boldRouteHint: "StrategyWiki faster RDL 2U 3D or hold 5D; engine BFS DUUR (T-Chip 999)",
      moveVerified: true,
      meetsBoldBudget: remaining >= 982,
      moveSource: "Engine BFS; StrategyWiki T-Chip bold 982",
      simulatedTicks: ticks,
      simulatedSecondsRemaining: remaining,
    });
  }
} else {
  writeLevelSolution(13, l13.entry);
}

for (const n of [14, 15, 16]) {
  const r = results.find((x) => x.levelNumber === n)!;
  if (r.completed) {
    writeLevelSolution(n, r.entry);
  }
}

console.log("Updated solution JSON files");
