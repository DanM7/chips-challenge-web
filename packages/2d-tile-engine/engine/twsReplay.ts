import type { Direction, LevelData } from "./types.js";
import {
  createMsCc1SimulationRunner,
  runnerToResult,
  type MsCc1SimulationResult,
  stepMsCc1Simulation,
  stepMsCc1Wait,
} from "./msCc1/msCc1Simulation.js";

const MS_DIR: Record<string, Direction> = {
  L: "left",
  R: "right",
  U: "up",
  D: "down",
};

/** CCTools / Tile World orthogonal direction index (N=0, W=1, S=2, E=3). */
const TWS_DIR_INDEX: Direction[] = ["up", "left", "down", "right"];

export interface TwsTickMove {
  tick: number;
  direction: number;
}

export interface TwsReplayResult extends MsCc1SimulationResult {
  chipMoves: Direction[];
  waitTicks: number;
}

/**
 * Replay decoded TWS tick records (from exportCc1MsTwsRecords.py).
 * One monster idle tick per game tick between chip inputs.
 */
export function replayTwsRecords(level: LevelData, records: TwsTickMove[]): TwsReplayResult {
  const runner = createMsCc1SimulationRunner(structuredClone(level));
  const chipMoves: Direction[] = [];
  let waitTicks = 0;
  let prevTick = 0;

  for (const rec of records) {
    const dir = TWS_DIR_INDEX[rec.direction];
    if (!dir) {
      continue;
    }
    const gap = Math.max(0, rec.tick - prevTick - 1);
    for (let i = 0; i < gap; i += 1) {
      stepMsCc1Wait(runner);
      waitTicks += 1;
      if (runner.completed || runner.playerDied) {
        return { ...runnerToResult(runner), chipMoves, waitTicks };
      }
    }
    stepMsCc1Wait(runner);
    waitTicks += 1;
    if (runner.completed || runner.playerDied) {
      return { ...runnerToResult(runner), chipMoves, waitTicks };
    }
    stepMsCc1Simulation(runner, dir);
    chipMoves.push(dir);
    prevTick = rec.tick;
    if (runner.completed || runner.playerDied) {
      break;
    }
  }

  return { ...runnerToResult(runner), chipMoves, waitTicks };
}

/**
 * MS TWS replay: commas/dots and lowercase lrud = idle monster ticks;
 * uppercase LRUD (with repeat counts) = chip steps (idle tick before each).
 */
export function replayTwsMs(level: LevelData, tws: string): TwsReplayResult {
  const runner = createMsCc1SimulationRunner(structuredClone(level));
  const chipMoves: Direction[] = [];
  let waitTicks = 0;
  let i = 0;

  while (i < tws.length) {
    while (i < tws.length && (tws[i] === " " || tws[i] === "," || tws[i] === ".")) {
      stepMsCc1Wait(runner);
      waitTicks += 1;
      i += 1;
      if (runner.completed || runner.playerDied) break;
    }
    if (i >= tws.length || runner.completed || runner.playerDied) break;

    const numMatch = /^\d+/.exec(tws.slice(i));
    let count = 1;
    if (numMatch) {
      count = Number.parseInt(numMatch[0], 10);
      i += numMatch[0].length;
      while (i < tws.length && (tws[i] === " " || tws[i] === "," || tws[i] === ".")) {
        stepMsCc1Wait(runner);
        waitTicks += 1;
        i += 1;
        if (runner.completed || runner.playerDied) break;
      }
      if (i >= tws.length || runner.completed || runner.playerDied) break;
    }

    const ch = tws[i]!;
    const upper = MS_DIR[ch];
    if (upper) {
      for (let n = 0; n < count; n += 1) {
        stepMsCc1Wait(runner);
        waitTicks += 1;
        if (runner.playerDied || runner.completed) break;
        stepMsCc1Simulation(runner, upper);
        chipMoves.push(upper);
        if (runner.playerDied || runner.completed) break;
      }
      i += 1;
      if (tws[i] === "3" && tws[i + 1] === ",") {
        i += 2;
      }
      continue;
    }
    if (ch === "l" || ch === "r" || ch === "u" || ch === "d") {
      stepMsCc1Wait(runner);
      waitTicks += 1;
      i += 1;
      continue;
    }
    i += 1;
  }

  return { ...runnerToResult(runner), chipMoves, waitTicks };
}
