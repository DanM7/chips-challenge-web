/**
 * Headless replay of Auto Play routes (U/D/L/R + W waits).
 * Waits tick monsters without advancing moveBoundary (PlayScene idle clock).
 */
import type { LevelData } from "@engine/types";
import {
  createMsCc1SimulationRunner,
  runnerToResult,
  stepMsCc1Simulation,
  stepMsCc1Wait,
  type MsCc1SimulationResult,
} from "@engine/msCc1/msCc1Simulation";
import { msSecondsRemaining } from "@engine/msCc1/msCc1Timing";
import {
  decodeSolutionMoves,
  isWaitAction,
  type SolutionAction,
} from "../../src/data/solutionMoves";

export function simulateSolutionActions(
  level: LevelData,
  actions: readonly SolutionAction[],
): MsCc1SimulationResult & { moveBoundary: number } {
  const runner = createMsCc1SimulationRunner(structuredClone(level));
  for (const action of actions) {
    if (isWaitAction(action)) {
      stepMsCc1Wait(runner);
    } else {
      stepMsCc1Simulation(runner, action);
    }
    if (runner.completed || runner.playerDied) {
      break;
    }
  }
  return {
    ...runnerToResult(runner),
    moveBoundary: runner.buttonPressCtx.moveBoundary,
  };
}

export function simulateSolutionLetters(
  level: LevelData,
  letters: readonly string[],
): MsCc1SimulationResult & { moveBoundary: number; secondsRemaining: number | null } {
  const result = simulateSolutionActions(level, decodeSolutionMoves(letters));
  const limit = level.timeLimit;
  return {
    ...result,
    secondsRemaining:
      limit != null && limit > 0 ? msSecondsRemaining(limit, result.moveBoundary) : null,
  };
}
