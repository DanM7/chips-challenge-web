import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { decodeSolutionMoves } from "../engine/solutionMoves.js";
import type { LevelData } from "../engine/types.js";
import { readLevelSolution } from "../integration/solutionStorage.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const boldTimesPath = path.join(root, "integration/data/cc1-ms-bold-times.json");
const level001Path = path.join(
  root,
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-001.json",
);

interface BoldTimesFile {
  sourceUrl: string;
  walkthroughUrl?: string;
  levels: Array<{
    level: number;
    confirmedTimeRemaining: number;
    confirmedBy: string;
    isTChip: boolean;
  }>;
}

describe("CC1 MS bold times catalog", () => {
  const catalog = JSON.parse(readFileSync(boldTimesPath, "utf8")) as BoldTimesFile;

  it("points at BitBusters CC1 MS scores and has 149 levels", () => {
    expect(catalog.sourceUrl).toBe("https://scores.bitbusters.club/scores/cc1/ms");
    expect(catalog.walkthroughUrl).toBe(
      "https://strategywiki.org/wiki/Chip%27s_Challenge/Levels_1-20",
    );
    expect(catalog.levels).toHaveLength(149);
    expect(catalog.levels[0]).toMatchObject({
      level: 1,
      confirmedTimeRemaining: 83,
      confirmedBy: "Alice Voith",
    });
  });
});

describe("level 1 bold route", () => {
  it("verified solution finishes with bold 83 remaining", () => {
    const bold = (
      JSON.parse(readFileSync(boldTimesPath, "utf8")) as BoldTimesFile
    ).levels[0]!;
    expect(bold.confirmedTimeRemaining).toBe(83);

    const sol = readLevelSolution<{
      timeLimitSeconds: number;
      boldTimeRemaining: number;
      moves: string[];
      moveVerified: boolean;
      meetsBoldBudget: boolean;
    }>(1)!;
    expect(sol.moveVerified).toBe(true);
    expect(sol.meetsBoldBudget).toBe(true);
    expect(sol.boldTimeRemaining).toBe(83);
    expect(sol.timeLimitSeconds).toBe(100);

    const level = JSON.parse(readFileSync(level001Path, "utf8")) as LevelData;
    normalizeLevelLayers(level);
    const moves = decodeSolutionMoves(sol.moves);
    const runner = createMsCc1SimulationRunner(level);
    for (const action of moves) {
      if (action === "wait") {
        continue;
      }
      if (stepMsCc1Simulation(runner, action)) {
        break;
      }
    }

    expect(runner.completed).toBe(true);
    const remaining = msSecondsRemaining(
      sol.timeLimitSeconds,
      runner.buttonPressCtx.moveBoundary,
    );

    // 89 ticks → 17s elapsed → 83 left (BitBusters / StrategyWiki bold).
    expect(runner.buttonPressCtx.moveBoundary).toBeLessThanOrEqual(89);
    expect(remaining).toBe(83);
    expect(remaining).toBe(bold.confirmedTimeRemaining);
  });
});
