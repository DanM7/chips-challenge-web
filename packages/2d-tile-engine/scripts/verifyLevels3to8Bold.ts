/**
 * Verify levels 3–8 solutions against bold targets; update metadata when passing.
 */
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { decodeSolutionMoves, encodeSolutionMoves } from "../engine/solutionMoves.js";
import type { LevelData } from "../engine/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webLevels = path.join(
  root,
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels",
);
const webSolDir = path.join(
  root,
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/data/cc1-ms-solutions",
);
const walkthroughUrl =
  "https://strategywiki.org/wiki/Chip%27s_Challenge/Levels_1-20";

const boldHints: Record<number, string> = {
  3: "Flippers → ice skates → fire boots → suction boots + chip → exit → 89",
  4: "Three rooms; east: top chips, bottom chips, center exit → 116",
  5: "Release pink ball, red key, glider into bomb via brown buttons → 85",
  6: "Opener 3L 3U 3L D, collect reachable chips, exit → 94",
  7: "Teleport route; don't take both boots before thief → 139",
  8: "4R, U or D, east to chip, east to exit (odd step for 96)",
};

function simLevel(n: number, moves: string[]) {
  const level = JSON.parse(
    readFileSync(path.join(webLevels, `level-${String(n).padStart(3, "0")}.json`), "utf8"),
  ) as LevelData;
  normalizeLevelLayers(level);
  const runner = createMsCc1SimulationRunner(level);
  for (const d of decodeSolutionMoves(moves)) {
    if (stepMsCc1Simulation(runner, d)) break;
  }
  const sol = JSON.parse(
    readFileSync(
      path.join(root, "integration/data/cc1-ms-solutions", `level-${String(n).padStart(3, "0")}.json`),
      "utf8",
    ),
  ) as { timeLimitSeconds: number; boldTimeRemaining: number };
  const rem = msSecondsRemaining(sol.timeLimitSeconds, runner.buttonPressCtx.moveBoundary);
  return { runner, rem, bold: sol.boldTimeRemaining };
}

function updateSolution(n: number, moves: string[], rem: number, ticks: number) {
  const enginePath = path.join(
    root,
    "integration/data/cc1-ms-solutions",
    `level-${String(n).padStart(3, "0")}.json`,
  );
  const sol = JSON.parse(readFileSync(enginePath, "utf8")) as Record<string, unknown>;
  const bold = sol.boldTimeRemaining as number;
  const out = {
    ...sol,
    moves: encodeSolutionMoves(decodeSolutionMoves(moves)),
    walkthroughUrl,
    boldRouteHint: boldHints[n],
    moveVerified: true,
    meetsBoldBudget: rem >= bold,
    moveSource: `StrategyWiki Lesson ${n} bold; engine-verified ${rem}s left (bold ${bold})`,
    simulatedTicks: ticks,
    simulatedSecondsRemaining: rem,
  };
  writeFileSync(enginePath, `${JSON.stringify(out, null, 2)}\n`);
  copyFileSync(enginePath, path.join(webSolDir, `level-${String(n).padStart(3, "0")}.json`));
  return out;
}

const args = process.argv.slice(2);
const update = args.includes("--update");
const levels = args.filter((a) => /^\d+$/.test(a)).map(Number);
const toCheck = levels.length ? levels : [3, 4, 5, 6, 7, 8];

console.log("level\tremaining\tbold\tmeets\tcompleted\tticks\tmoves");
for (const n of toCheck) {
  const enginePath = path.join(
    root,
    "integration/data/cc1-ms-solutions",
    `level-${String(n).padStart(3, "0")}.json`,
  );
  const sol = JSON.parse(readFileSync(enginePath, "utf8")) as {
    moves: string[] | null;
    boldTimeRemaining: number;
  };
  if (!sol.moves?.length) {
    console.log(`${n}\t-\t${sol.boldTimeRemaining}\tno\t-\t-\t0`);
    continue;
  }
  const { runner, rem, bold } = simLevel(n, sol.moves);
  const meets = rem >= bold;
  console.log(
    `${n}\t${rem}\t${bold}\t${meets ? "yes" : "no"}\t${runner.completed}\t${runner.buttonPressCtx.moveBoundary}\t${sol.moves.length}`,
  );
  if (update && runner.completed && meets) {
    updateSolution(n, sol.moves, rem, runner.buttonPressCtx.moveBoundary);
    console.log(`  → updated level-${String(n).padStart(3, "0")}.json`);
  }
}
