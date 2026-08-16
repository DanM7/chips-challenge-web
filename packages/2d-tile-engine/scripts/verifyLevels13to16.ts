import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { encodeSolutionMoves } from "../engine/solutionMoves.js";
import { decodeSolutionMoves } from "../engine/solutionMoves.js";
import type { Direction, LevelData } from "../engine/types.js";
import { readLevelSolution } from "../integration/solutionStorage.js";
import { replayTwsRecords } from "../engine/twsReplay.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const levelsDir = path.join(
  root,
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels",
);

function loadLevel(n: number): LevelData {
  const level = JSON.parse(
    readFileSync(path.join(levelsDir, `level-${String(n).padStart(3, "0")}.json`), "utf8"),
  ) as LevelData;
  normalizeLevelLayers(level);
  return level;
}

function expandRoute(route: string): Direction[] {
  const dirs: Direction[] = [];
  const re = /(\d+)?([UDLR])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(route)) !== null) {
    const count = m[1] ? Number.parseInt(m[1], 10) : 1;
    const letter = m[2]!;
    const map: Record<string, Direction> = {
      U: "up",
      D: "down",
      L: "left",
      R: "right",
    };
    for (let i = 0; i < count; i += 1) {
      dirs.push(map[letter]!);
    }
  }
  return dirs;
}

function simulateMoves(
  level: LevelData,
  moves: Direction[],
  timeLimit: number,
) {
  const runner = createMsCc1SimulationRunner(structuredClone(level));
  for (const direction of moves) {
    if (stepMsCc1Simulation(runner, direction)) {
      break;
    }
  }
  const ticks = runner.buttonPressCtx.moveBoundary;
  return {
    completed: runner.completed,
    died: runner.playerDied,
    deathMessage: runner.deathMessage,
    pos: { x: runner.gx, y: runner.gy },
    ticks,
    chipMoves: runner.chipMoves,
    remaining: msSecondsRemaining(timeLimit, ticks),
    moves: encodeSolutionMoves(moves.slice(0, runner.chipMoves)),
  };
}

for (const n of [13, 14, 15, 16] as const) {
  console.log(`\n=== Level ${n} ===`);
  const level = loadLevel(n);
  const sol = readLevelSolution<{
    timeLimitSeconds: number | null;
    boldTimeRemaining: number;
    moves: string[] | null;
    twsRecords?: { tick: number; direction: number }[];
  }>(n)!;

  const timeLimit =
    sol.timeLimitSeconds && sol.timeLimitSeconds > 0
      ? sol.timeLimitSeconds
      : 999;

  if (n === 13) {
    for (const route of ["5D", "RDL2U3D", "RDL 2U 3D"]) {
      const moves = expandRoute(route.replace(/\s/g, ""));
      const r = simulateMoves(level, moves, timeLimit);
      console.log(`route ${route}:`, r);
    }
  }

  if (n === 16) {
    const route =
      "4R12D4R4U4R8D4R8U4L4U20L4D4L16D4R8D20R4U4R4D";
    const r = simulateMoves(level, expandRoute(route), timeLimit);
    console.log("StrategyWiki route:", r);
  }

  if (sol.moves?.length) {
    const r = simulateMoves(level, decodeSolutionMoves(sol.moves), timeLimit);
    console.log("stored moves:", r);
  }

  if (sol.twsRecords?.length) {
    const tws = replayTwsRecords(structuredClone(level), sol.twsRecords);
    const remaining = msSecondsRemaining(timeLimit, tws.moveBoundary);
    console.log("TWS replay:", {
      completed: tws.completed,
      died: tws.playerDied,
      chipMoves: tws.chipMoves.length,
      ticks: tws.moveBoundary,
      remaining,
      bold: sol.boldTimeRemaining,
      meets: remaining >= sol.boldTimeRemaining,
    });
    if (tws.completed) {
      console.log(
        "TWS encoded moves count:",
        encodeSolutionMoves(tws.chipMoves).length,
      );
    }
  }
}
