import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { decodeSolutionMoves } from "../engine/solutionMoves.js";
import type { LevelData } from "../engine/types.js";

const bold = JSON.parse(
  readFileSync("integration/data/cc1-ms-bold-times.json", "utf8"),
) as { levels: Array<{ level: number; confirmedTimeRemaining: number }> };

const rows: unknown[] = [];
for (let n = 3; n <= 20; n++) {
  const id = String(n).padStart(3, "0");
  const p = `integration/data/cc1-ms-solutions/level-${id}.json`;
  const b = bold.levels.find((l) => l.level === n);
  if (!existsSync(p)) {
    rows.push({ n, status: "NO_SOL", bold: b?.confirmedTimeRemaining });
    continue;
  }
  const sol = JSON.parse(readFileSync(p, "utf8")) as {
    timeLimitSeconds?: number;
    meetsBoldBudget?: boolean;
    moveVerified?: boolean;
    moves?: string[];
  };
  const levelPath = `../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-${id}.json`;
  const level = JSON.parse(readFileSync(levelPath, "utf8")) as LevelData;
  normalizeLevelLayers(level);
  const moves = decodeSolutionMoves(sol.moves ?? []);
  const runner = createMsCc1SimulationRunner(structuredClone(level));
  for (const d of moves) {
    if (stepMsCc1Simulation(runner, d)) break;
  }
  const limit = sol.timeLimitSeconds ?? level.timeLimit ?? 0;
  const ticks = runner.buttonPressCtx.moveBoundary;
  const rem = msSecondsRemaining(limit, ticks);
  const row = {
    n,
    bold: b?.confirmedTimeRemaining,
    limit,
    meets: !!sol.meetsBoldBudget,
    verified: !!sol.moveVerified,
    simDone: !!runner.completed,
    rem,
    ticks,
    moves: moves.length,
    gap: (b?.confirmedTimeRemaining ?? 0) - rem,
  };
  rows.push(row);
  console.log(JSON.stringify(row));
}
writeFileSync(".tmp/levels-03-20-audit.json", JSON.stringify(rows, null, 2));
