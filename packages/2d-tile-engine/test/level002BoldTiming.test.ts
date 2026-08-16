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
const level002Path = path.join(
  root,
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-002.json",
);

describe("level 2 bold route (StrategyWiki)", () => {
  it("verified solution finishes with bold 90 remaining", () => {
    const catalog = JSON.parse(readFileSync(boldTimesPath, "utf8")) as {
      levels: Array<{ level: number; confirmedTimeRemaining: number }>;
    };
    expect(catalog.levels[1]).toMatchObject({
      level: 2,
      confirmedTimeRemaining: 90,
    });

    const sol = readLevelSolution<{
      timeLimitSeconds: number;
      boldTimeRemaining: number;
      moves: string[];
      moveVerified: boolean;
      meetsBoldBudget: boolean;
      walkthroughUrl?: string;
    }>(2)!;
    expect(sol.moveVerified).toBe(true);
    expect(sol.meetsBoldBudget).toBe(true);
    expect(sol.boldTimeRemaining).toBe(90);
    expect(sol.timeLimitSeconds).toBe(100);
    expect(sol.walkthroughUrl).toBe(
      "https://strategywiki.org/wiki/Chip%27s_Challenge/Levels_1-20",
    );

    const level = JSON.parse(readFileSync(level002Path, "utf8")) as LevelData;
    normalizeLevelLayers(level);
    const moves = decodeSolutionMoves(sol.moves);
    const runner = createMsCc1SimulationRunner(level);
    for (const direction of moves) {
      if (stepMsCc1Simulation(runner, direction)) {
        break;
      }
    }

    expect(runner.completed).toBe(true);
    expect(runner.playerDied).toBe(false);
    const remaining = msSecondsRemaining(
      sol.timeLimitSeconds,
      runner.buttonPressCtx.moveBoundary,
    );

    // StrategyWiki: east chips, blocks 2&1 over top water, top then bottom chip, west exit → 90.
    expect(runner.buttonPressCtx.moveBoundary).toBeLessThanOrEqual(54);
    expect(remaining).toBe(90);
  });
});
